"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SERVICES_CATALOG, ADDONS_CATALOG } from "@/lib/ugc/catalog";

export type UpdateCreatorProfileDetailsState = { error: string } | null;

export async function updateCreatorProfileDetailsAction(
  _prevState: UpdateCreatorProfileDetailsState,
  formData: FormData
): Promise<UpdateCreatorProfileDetailsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const skillNames = formData.getAll("skill_name").map((v) => String(v).trim());
  const skillLevels = formData.getAll("skill_level").map((v) => Number(v));
  const skills = skillNames
    .map((name, i) => ({ name, level: skillLevels[i] }))
    .filter((s) => s.name && s.level >= 1 && s.level <= 5);

  const services = formData
    .getAll("services")
    .map((v) => String(v))
    .filter((v) => (SERVICES_CATALOG as readonly string[]).includes(v));

  const addons = formData
    .getAll("addons")
    .map((v) => String(v))
    .filter((v) => (ADDONS_CATALOG as readonly string[]).includes(v));

  const brandCategories = formData.getAll("brand_category").map((v) => String(v).trim());
  const brandNames = formData.getAll("brand_name").map((v) => String(v).trim());
  const pastBrands = brandCategories
    .map((category, i) => ({ category, brand_name: brandNames[i] }))
    .filter((b) => b.category && b.brand_name);

  const avgViews = formData.get("avg_views") ? Number(formData.get("avg_views")) : null;
  const engagementRate = formData.get("engagement_rate") ? Number(formData.get("engagement_rate")) : null;
  const avgReach = formData.get("avg_reach") ? Number(formData.get("avg_reach")) : null;

  const { error: metricsError } = await supabase
    .from("creator_profiles")
    .update({ avg_views: avgViews, engagement_rate: engagementRate, avg_reach: avgReach })
    .eq("profile_id", user.id);

  if (metricsError) {
    return { error: "No se pudieron guardar las métricas. Intentá de nuevo." };
  }

  await supabase.from("creator_skills").delete().eq("creator_id", user.id);
  await supabase.from("creator_services").delete().eq("creator_id", user.id);
  await supabase.from("creator_addons").delete().eq("creator_id", user.id);
  await supabase.from("creator_past_brands").delete().eq("creator_id", user.id);

  if (skills.length > 0) {
    await supabase.from("creator_skills").insert(
      skills.map((s, i) => ({ creator_id: user.id, name: s.name, level: s.level, position: i }))
    );
  }

  if (services.length > 0) {
    await supabase
      .from("creator_services")
      .insert(services.map((service) => ({ creator_id: user.id, service })));
  }

  if (addons.length > 0) {
    await supabase.from("creator_addons").insert(addons.map((addon) => ({ creator_id: user.id, addon })));
  }

  if (pastBrands.length > 0) {
    await supabase.from("creator_past_brands").insert(
      pastBrands.map((b, i) => ({
        creator_id: user.id,
        category: b.category,
        brand_name: b.brand_name,
        position: i,
      }))
    );
  }

  revalidatePath("/ugc/creador/perfil");

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("profile_id", user.id)
    .single();

  if (creatorProfile) {
    revalidatePath(`/ugc/creadores/${creatorProfile.handle}`);
  }

  return null;
}
