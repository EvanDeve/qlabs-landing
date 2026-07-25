"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DELIVERABLE_TYPES } from "@/lib/ugc/deliverables";

export type CampaignActionState = { error: string } | null;

type Client = Awaited<ReturnType<typeof createClient>>;

async function isBrandVerified(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("brand_profiles")
    .select("verified")
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.verified === true;
}

export async function createCampaignAction(
  _prevState: CampaignActionState,
  formData: FormData
): Promise<CampaignActionState> {
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
    deliverables,
    status: intent === "publish" ? "published" : "draft",
    published_at: intent === "publish" ? new Date().toISOString() : null,
  });

  if (error) {
    return { error: "No se pudo crear la campaña. Intentá de nuevo." };
  }

  revalidatePath("/ugc/marca");
  revalidatePath("/ugc/marca/ugc");
  redirect("/ugc/marca/ugc");
}

export async function publishCampaignAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!campaignId) return;

  // Publicar un borrador pasa por el mismo gate: RLS lo rechazaría igual, pero
  // se corta antes para no dejar la impresión de que "no pasó nada".
  if (!(await isBrandVerified(supabase, user.id))) {
    return;
  }

  await supabase
    .from("campaigns")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("brand_id", user.id);

  revalidatePath("/ugc/marca");
  revalidatePath("/ugc/marca/ugc");
}
