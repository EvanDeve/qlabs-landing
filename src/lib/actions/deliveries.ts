"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail, getUserEmail } from "@/lib/email/resend";
import { DELIVERIES_BUCKET } from "@/lib/ugc/deliveries";

export type SubmitDeliveryState = { error: string } | null;

/**
 * El archivo NO viaja por acá: el navegador lo sube directo a Supabase Storage
 * (ver `@/lib/ugc/uploads`) y este action recibe solo `storage_path`. Mandarlo
 * por el Server Action chocaba con el tope de body de ~4.5 MB de Vercel, así
 * que la entrega andaba en local y fallaba en producción — y es justo el paso
 * por el que pasa el pago del creador.
 */
export async function submitDeliveryAction(
  _prevState: SubmitDeliveryState,
  formData: FormData
): Promise<SubmitDeliveryState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const applicationId = String(formData.get("application_id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const storagePath = String(formData.get("storage_path") ?? "").trim() || null;
  const externalUrl = String(formData.get("external_url") ?? "").trim() || null;

  if (!applicationId) {
    return { error: "Aplicación inválida." };
  }

  const { data: application } = await supabase
    .from("applications")
    .select("id, campaign_id, status")
    .eq("id", applicationId)
    .eq("creator_id", user.id)
    .single();

  if (!application || !["accepted", "delivered"].includes(application.status)) {
    return { error: "No podés entregar en esta aplicación." };
  }

  if (!storagePath && !externalUrl) {
    return { error: "Subí un archivo, pegá un link, o ambos." };
  }

  if (externalUrl) {
    try {
      new URL(externalUrl);
    } catch {
      return { error: "El link no es una URL válida." };
    }
  }

  if (storagePath) {
    // La ruta la arma el navegador, así que no se le cree sin chequear. La
    // policy de storage ya impide escribir en la carpeta de otra aplicación,
    // pero nada le impediría a un creador mandar acá la ruta de OTRA entrega
    // suya y colgarla de esta aplicación.
    if (!storagePath.startsWith(`${applicationId}/`) || storagePath.includes("..")) {
      return { error: "El archivo subido no corresponde a esta entrega." };
    }

    // Que el objeto exista de verdad: si la subida se cortó a mitad, sin este
    // chequeo quedaría una entrega registrada apuntando a un archivo que no
    // está, y la marca vería un botón de descarga roto.
    const nombre = storagePath.slice(applicationId.length + 1);
    const { data: encontrados } = await supabase.storage
      .from(DELIVERIES_BUCKET)
      .list(applicationId, { search: nombre });

    if (!encontrados?.some((o) => o.name === nombre)) {
      return { error: "No se encontró el archivo subido. Probá de nuevo." };
    }
  }

  // El creador puede entregar el archivo crudo y el link del post ya
  // publicado en la misma tanda — cada uno se guarda como su propia fila,
  // application_deliveries siempre soportó múltiples piezas por aplicación.
  const rows = [
    ...(storagePath
      ? [{ application_id: applicationId, creator_id: user.id, kind: "file" as const, storage_path: storagePath, external_url: null, note }]
      : []),
    ...(externalUrl
      ? [{ application_id: applicationId, creator_id: user.id, kind: "link" as const, storage_path: null, external_url: externalUrl, note }]
      : []),
  ];

  const { error: insertError } = await supabase.from("application_deliveries").insert(rows);

  if (insertError) {
    if (storagePath) {
      // Con service role a propósito: el bucket `deliveries` no tiene policy de
      // DELETE para el creador —y no debe tenerla, o podría borrar la pieza ya
      // entregada después de que la marca la aprobó—. Con la sesión del usuario
      // este remove no fallaba: no hacía nada, y el archivo quedaba huérfano.
      await createAdminClient().storage.from(DELIVERIES_BUCKET).remove([storagePath]);
    }
    return { error: "No se pudo guardar la entrega. Intentá de nuevo." };
  }

  if (application.status !== "delivered") {
    await supabase.from("applications").update({ status: "delivered" }).eq("id", applicationId);
  }

  revalidatePath("/ugc/creador/aplicaciones");
  revalidatePath(`/ugc/marca/campanas/${application.campaign_id}`);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("title, brand_id, budget_amount")
    .eq("id", application.campaign_id)
    .single();

  if (campaign) {
    const brandEmail = await getUserEmail(campaign.brand_id);
    if (brandEmail) {
      await sendTransactionalEmail(
        brandEmail,
        `Nueva entrega en "${campaign.title}"`,
        `<p>El creador subió una pieza en <strong>${campaign.title}</strong>. Entrá a UGC·CRC para revisarla.</p>
         <p>Si todo está bien, aprobala para que sigamos con el pago de ₡${campaign.budget_amount.toLocaleString("es-CR")} a la agencia.</p>`
      );
    }
  }

  return null;
}
