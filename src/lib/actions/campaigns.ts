"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DELIVERABLE_TYPES } from "@/lib/ugc/deliverables";

export type CampaignActionState = { error: string } | null;

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

  await supabase
    .from("campaigns")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("brand_id", user.id);

  revalidatePath("/ugc/marca");
  revalidatePath("/ugc/marca/ugc");
}
