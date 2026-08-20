"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DELIVERABLE_TYPES } from "@/lib/ugc/deliverables";
import { isUsageScope, isUsageDuration } from "@/lib/ugc/usage-rights";
import { CAMPAIGN_COVER_BUCKET, esUrlDePortada, rutaDePortada } from "@/lib/ugc/campaign-covers";

/**
 * Resultado de crear una campaña.
 *
 * La acción NO redirige: devuelve el desenlace y el cliente decide. Con
 * redirect() adentro, el código que limpia el borrador del navegador nunca
 * llegaba a correr —la navegación corta la ejecución— y el formulario volvía a
 * ofrecer "recuperamos lo que estabas escribiendo" sobre una campaña que ya
 * había entrado.
 */
export type CampaignActionState = { error: string } | { ok: true } | null;

type Client = Awaited<ReturnType<typeof createClient>>;

async function isBrandVerified(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("brand_profiles")
    .select("verified")
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.verified === true;
}

export async function createCampaignAction(formData: FormData): Promise<CampaignActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const title = String(formData.get("title") ?? "").trim();
  const brief = String(formData.get("brief") ?? "").trim();
  const budgetAmount = Number(formData.get("budget_amount") ?? 0);
  const targetAudience = String(formData.get("target_audience") ?? "").trim() || null;
  const deadlineDaysRaw = String(formData.get("deadline_days") ?? "").trim();
  const deadlineDays = deadlineDaysRaw ? Number(deadlineDaysRaw) : null;
  const compensationDetails = String(formData.get("compensation_details") ?? "").trim() || null;
  const intent = formData.get("intent") === "publish" ? "publish" : "draft";

  // La portada ya está en Storage cuando llega acá —el navegador la subió
  // directo— y lo que viaja es su URL pública. Se filtra por bucket: sin eso,
  // `cover_url` sería un campo de texto libre que el feed de todos los
  // creadores termina renderizando como <img src>.
  const coverRaw = String(formData.get("cover_url") ?? "").trim();
  const coverUrl = coverRaw && esUrlDePortada(coverRaw) ? coverRaw : null;

  // Los radios del formulario son `required`, pero eso solo cubre el navegador:
  // se revalida acá porque define qué derechos cede el creador.
  const scopeRaw = String(formData.get("usage_rights_scope") ?? "");
  const durationRaw = String(formData.get("usage_rights_duration") ?? "");
  const usageScope = isUsageScope(scopeRaw) ? scopeRaw : null;
  const usageDuration = isUsageDuration(durationRaw) ? durationRaw : null;
  const usageEditing = formData.get("usage_rights_editing") === "on";
  const usageNotes = String(formData.get("usage_rights_notes") ?? "").trim() || null;

  const deliverables = DELIVERABLE_TYPES.map((type) => ({
    type,
    qty: Number(formData.get(`qty_${type}`) ?? 0) || 0,
  })).filter((d) => d.qty > 0);

  if (!title || !brief || !budgetAmount || budgetAmount <= 0) {
    return { error: "Completá título, brief y un presupuesto válido." };
  }
  if (deliverables.length === 0) {
    return { error: "Elegí al menos un entregable con cantidad mayor a 0." };
  }
  if (!usageScope || !usageDuration) {
    return {
      error: "Definí los derechos de uso: dónde puede usarse el contenido y por cuánto tiempo.",
    };
  }

  // El gate real vive en RLS; esto solo convierte la negación cruda en un
  // mensaje entendible. Guardar como borrador sí está permitido sin verificar.
  if (intent === "publish" && !(await isBrandVerified(supabase, user.id))) {
    return {
      error:
        "Tu negocio todavía está en revisión, así que aún no podés publicar. Guardala como borrador y la publicás apenas te verifiquemos.",
    };
  }

  const { error } = await supabase.from("campaigns").insert({
    brand_id: user.id,
    title,
    brief,
    budget_amount: budgetAmount,
    target_audience: targetAudience,
    deadline_days: deadlineDays,
    compensation_details: compensationDetails,
    usage_rights_scope: usageScope,
    usage_rights_duration: usageDuration,
    usage_rights_editing: usageEditing,
    usage_rights_notes: usageNotes,
    cover_url: coverUrl,
    deliverables,
    status: intent === "publish" ? "published" : "draft",
    published_at: intent === "publish" ? new Date().toISOString() : null,
  });

  if (error) {
    return { error: "No se pudo crear la campaña. Intentá de nuevo." };
  }

  revalidatePath("/ugc/marca");
  revalidatePath("/ugc/marca/ugc");
  return { ok: true };
}

export async function publishCampaignAction(formData: FormData): Promise<CampaignActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!campaignId) return { error: "No encontramos la campaña." };

  // Publicar un borrador pasa por el mismo gate: RLS lo rechazaría igual, pero
  // se corta antes para no dejar la impresión de que "no pasó nada".
  //
  // Antes esto devolvía void y la pantalla no cambiaba en nada: el botón se
  // apretaba, no pasaba nada, y no había forma de saber por qué.
  if (!(await isBrandVerified(supabase, user.id))) {
    return {
      error: "Tu negocio todavía está en revisión, así que aún no podés publicar campañas.",
    };
  }

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("brand_id", user.id);

  if (error) {
    return { error: "No se pudo publicar la campaña. Intentá de nuevo." };
  }

  revalidatePath("/ugc/marca");
  revalidatePath("/ugc/marca/ugc");
  revalidatePath(`/ugc/marca/campanas/${campaignId}`);
  return { ok: true };
}

/**
 * Cambiar (o quitar) la portada de una campaña que ya existe.
 *
 * Existe aparte de `createCampaignAction` porque las campañas no tienen
 * pantalla de edición: sin esto, la portada sería un privilegio de las que se
 * creen de acá en adelante y las que ya están publicadas quedarían para
 * siempre con el degradado. El archivo sube directo del navegador; acá solo
 * llega su URL.
 */
export async function updateCampaignCoverAction(formData: FormData): Promise<CampaignActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!campaignId) return { error: "No encontramos la campaña." };

  const quitar = formData.get("quitar_portada") === "1";
  const coverRaw = String(formData.get("cover_url") ?? "").trim();
  const coverUrl = coverRaw && esUrlDePortada(coverRaw) ? coverRaw : null;
  if (!quitar && !coverUrl) return { error: "No se pudo leer la imagen. Probá de nuevo." };

  // Se lee la anterior ANTES de pisarla: es la única forma de saber qué archivo
  // quedó colgado en Storage.
  const { data: actual } = await supabase
    .from("campaigns")
    .select("cover_url")
    .eq("id", campaignId)
    .eq("brand_id", user.id)
    .maybeSingle();

  if (!actual) return { error: "No encontramos la campaña." };

  const { error } = await supabase
    .from("campaigns")
    .update({ cover_url: quitar ? null : coverUrl })
    .eq("id", campaignId)
    .eq("brand_id", user.id);

  if (error) return { error: "No se pudo guardar la portada. Intentá de nuevo." };

  // Igual que con la foto del cupón: la anterior se borra después de guardar y
  // solo si el guardado salió bien. El 1 GB de Storage es el primer techo del
  // proyecto y cada imagen reemplazada que quede colgada es deuda invisible.
  const anterior = rutaDePortada(actual.cover_url);
  if (anterior && anterior !== rutaDePortada(coverUrl)) {
    await supabase.storage.from(CAMPAIGN_COVER_BUCKET).remove([anterior]);
  }

  revalidatePath("/ugc/marca/ugc");
  revalidatePath(`/ugc/marca/campanas/${campaignId}`);
  revalidatePath("/ugc/creador/promos");
  return { ok: true };
}
