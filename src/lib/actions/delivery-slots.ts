"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail, getUserEmail } from "@/lib/email/resend";
import { DELIVERIES_BUCKET } from "@/lib/ugc/deliveries";
import { slotsDeCampana } from "@/lib/ugc/delivery-slots";

export type ResultadoSlot = { error: string } | { ok: true };

/**
 * La hoja de entrega guarda cada archivo apenas termina de subir, y recién al
 * final "Enviar entrega" pasa la aplicación a `delivered`. Por eso son dos
 * actions y no uno: entre el primer archivo y el envío puede pasar un rato, y
 * si el creador cierra la hoja tiene que poder volver y encontrar lo que ya
 * había subido.
 *
 * El archivo NO viaja por acá: el navegador lo sube directo a Storage y esto
 * recibe solo la ruta. Ver `@/lib/ugc/uploads` — mandarlo dentro del FormData
 * choca con el tope de body de ~4.5 MB de Vercel, que no existe en local y
 * aparece recién en producción.
 */
type Taller =
  | { error: string }
  | {
      error?: undefined;
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: { id: string };
      application: { id: string; campaign_id: string; status: string };
    };

async function aplicacionEnTaller(applicationId: string): Promise<Taller> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Se venció la sesión. Volvé a entrar." };

  const { data: application } = await supabase
    .from("applications")
    .select("id, campaign_id, status")
    .eq("id", applicationId)
    .eq("creator_id", user.id)
    .single();

  // 'accepted' y no 'delivered': una vez entregada, la pieza es lo que la marca
  // va a aprobar y lo que respalda el pago del creador. No se toca más.
  if (!application || application.status !== "accepted") {
    return { error: "No podés entregar en esta aplicación." };
  }

  return { supabase, user, application };
}

/** Registra un archivo ya subido en la caja que le toca. */
export async function guardarArchivoDeSlotAction(formData: FormData): Promise<ResultadoSlot> {
  const applicationId = String(formData.get("application_id") ?? "");
  const slot = String(formData.get("slot") ?? "").trim();
  const storagePath = String(formData.get("storage_path") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim() || null;

  if (!applicationId || !slot || !storagePath) return { error: "Datos incompletos." };

  const ctx = await aplicacionEnTaller(applicationId);
  if (ctx.error !== undefined) return { error: ctx.error };
  const { supabase, user, application } = ctx;

  // La ruta la arma el navegador, así que no se le cree sin chequear: nada le
  // impediría a un creador mandar acá la ruta de OTRA entrega suya y colgarla
  // de esta aplicación.
  if (!storagePath.startsWith(`${applicationId}/`) || storagePath.includes("..")) {
    return { error: "El archivo subido no corresponde a esta entrega." };
  }

  // Que la caja exista de verdad en esta campaña: sin esto, un slot inventado
  // quedaría guardado y no se dibujaría en ninguna parte.
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("deliverables")
    .eq("id", application.campaign_id)
    .single();

  if (!slotsDeCampana(campaign?.deliverables ?? null).some((s) => s.id === slot)) {
    return { error: "Ese entregable no es parte de la campaña." };
  }

  // Que el objeto exista: si la subida se cortó a mitad, sin este chequeo
  // quedaría una entrega apuntando a un archivo que no está, y la marca vería
  // un botón de descarga roto.
  const archivo = storagePath.slice(applicationId.length + 1);
  const { data: encontrados } = await supabase.storage
    .from(DELIVERIES_BUCKET)
    .list(applicationId, { search: archivo });

  if (!encontrados?.some((o) => o.name === archivo)) {
    return { error: "No se encontró el archivo subido. Probá de nuevo." };
  }

  // "Cambiar" reemplaza la caja: se borra lo anterior antes de escribir, o el
  // índice único (application_id, slot) rechaza la fila nueva.
  const { data: previo } = await supabase
    .from("application_deliveries")
    .select("id, storage_path")
    .eq("application_id", applicationId)
    .eq("slot", slot)
    .maybeSingle();

  if (previo) {
    await supabase.from("application_deliveries").delete().eq("id", previo.id);
    if (previo.storage_path) {
      await supabase.storage.from(DELIVERIES_BUCKET).remove([previo.storage_path]);
    }
  }

  const { error } = await supabase.from("application_deliveries").insert({
    application_id: applicationId,
    creator_id: user.id,
    kind: "file",
    storage_path: storagePath,
    external_url: null,
    note: nombre,
    slot,
  });

  if (error) {
    // Con service role a propósito: el creador puede borrar del bucket solo
    // mientras la aplicación sigue en 'accepted', y este camino tiene que
    // limpiar igual aunque esa condición cambie entre medio.
    await createAdminClient().storage.from(DELIVERIES_BUCKET).remove([storagePath]);
    return { error: "No se pudo guardar el archivo. Probá de nuevo." };
  }

  revalidatePath("/ugc/creador/aplicaciones");
  return { ok: true };
}

/** Saca un archivo de su caja: el creador cambió de idea antes de enviar. */
export async function quitarArchivoDeSlotAction(formData: FormData): Promise<ResultadoSlot> {
  const applicationId = String(formData.get("application_id") ?? "");
  const slot = String(formData.get("slot") ?? "").trim();
  if (!applicationId || !slot) return { error: "Datos incompletos." };

  const ctx = await aplicacionEnTaller(applicationId);
  if (ctx.error !== undefined) return { error: ctx.error };
  const { supabase } = ctx;

  const { data: fila } = await supabase
    .from("application_deliveries")
    .select("id, storage_path")
    .eq("application_id", applicationId)
    .eq("slot", slot)
    .maybeSingle();

  if (fila) {
    await supabase.from("application_deliveries").delete().eq("id", fila.id);
    if (fila.storage_path) {
      await supabase.storage.from(DELIVERIES_BUCKET).remove([fila.storage_path]);
    }
  }

  revalidatePath("/ugc/creador/aplicaciones");
  return { ok: true };
}

/**
 * Cierra la entrega: guarda los links y la nota, y pasa la aplicación a
 * `delivered`. Desde acá la marca la ve y el creador ya no puede tocarla.
 */
export async function enviarEntregaAction(formData: FormData): Promise<ResultadoSlot> {
  const applicationId = String(formData.get("application_id") ?? "");
  const nota = String(formData.get("nota") ?? "").trim() || null;
  const confirma = String(formData.get("confirma") ?? "") === "on";
  const links = formData.getAll("link").map((l) => String(l).trim()).filter(Boolean);

  if (!applicationId) return { error: "Aplicación inválida." };
  if (!confirma) {
    return { error: "Confirmá que la pieza cumple el brief y los derechos acordados." };
  }

  const ctx = await aplicacionEnTaller(applicationId);
  if (ctx.error !== undefined) return { error: ctx.error };
  const { supabase, user, application } = ctx;

  for (const link of links) {
    try {
      new URL(link);
    } catch {
      return { error: `"${link}" no es una URL válida.` };
    }
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("title, brand_id, budget_amount, deliverables")
    .eq("id", application.campaign_id)
    .single();

  const slots = slotsDeCampana(campaign?.deliverables ?? null);

  const { data: subidos } = await supabase
    .from("application_deliveries")
    .select("slot")
    .eq("application_id", applicationId)
    .eq("kind", "file");

  const llenos = new Set((subidos ?? []).map((d) => d.slot).filter(Boolean));

  // Se revalida en el servidor y no solo en la hoja: el botón deshabilitado es
  // una comodidad, no una garantía.
  if (slots.length > 0) {
    const faltan = slots.filter((s) => !llenos.has(s.id)).length;
    if (faltan > 0) {
      return { error: `Falta${faltan > 1 ? "n" : ""} ${faltan} archivo${faltan > 1 ? "s" : ""}.` };
    }
  } else if (llenos.size === 0 && links.length === 0) {
    // Campaña sin entregables declarados: alcanza con que haya algo.
    return { error: "Subí un archivo o pegá un link antes de enviar." };
  }

  if (links.length > 0) {
    const { error } = await supabase.from("application_deliveries").insert(
      links.map((url) => ({
        application_id: applicationId,
        creator_id: user.id,
        kind: "link" as const,
        storage_path: null,
        external_url: url,
        note: null,
        slot: null,
      }))
    );
    if (error) return { error: "No se pudieron guardar los links. Probá de nuevo." };
  }

  // La nota va en el mismo UPDATE que el estado a propósito: la policy del
  // creador es `using (status='accepted') with check (status='delivered')`, así
  // que este es el único momento en que puede escribirla.
  const { error: updateError } = await supabase
    .from("applications")
    .update({ status: "delivered", delivery_note: nota })
    .eq("id", applicationId);

  if (updateError) return { error: "No se pudo enviar la entrega. Probá de nuevo." };

  revalidatePath("/ugc/creador/aplicaciones");
  revalidatePath(`/ugc/marca/campanas/${application.campaign_id}`);

  if (campaign) {
    const brandEmail = await getUserEmail(campaign.brand_id);
    if (brandEmail) {
      await sendTransactionalEmail(
        brandEmail,
        `Nueva entrega en "${campaign.title}"`,
        `<p>El creador entregó las piezas de <strong>${campaign.title}</strong>. Entrá a UGC·CRC para revisarlas.</p>
         <p>Si todo está bien, aprobalas para que sigamos con el pago de ₡${campaign.budget_amount.toLocaleString("es-CR")} a la agencia.</p>`
      );
    }
  }

  return { ok: true };
}
