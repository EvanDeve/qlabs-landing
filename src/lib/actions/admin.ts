"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setCreatorVerifiedAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profileId = String(formData.get("profile_id") ?? "");
  const verified = formData.get("verified") === "true";
  if (!profileId) return;

  await supabase.from("creator_profiles").update({ verified }).eq("profile_id", profileId);

  revalidatePath("/ugc/admin/marketplace");
}

export async function setBrandVerifiedAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profileId = String(formData.get("profile_id") ?? "");
  const verified = formData.get("verified") === "true";
  if (!profileId) return;

  // El trigger protect_brand_verified rechaza esto si la sesión no es admin.
  await supabase.from("brand_profiles").update({ verified }).eq("profile_id", profileId);

  // El sello aparece en el feed, la vitrina y el perfil público de la marca.
  revalidatePath("/ugc/admin/marketplace");
  revalidatePath("/ugc/creador");
  revalidatePath("/ugc");
}

export async function markCampaignCompletedAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!campaignId) return;

  await supabase.from("campaigns").update({ status: "completed" }).eq("id", campaignId);

  revalidatePath("/ugc/admin/marketplace");
}
