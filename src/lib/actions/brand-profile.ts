"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateBrandProfileState = { error: string } | null;

export async function updateBrandProfileAction(
  _prevState: UpdateBrandProfileState,
  formData: FormData
): Promise<UpdateBrandProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const brandName = String(formData.get("brand_name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const website = String(formData.get("website") ?? "").trim() || null;
  const instagramHandle = String(formData.get("instagram_handle") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!brandName) {
    return { error: "El nombre del negocio es obligatorio." };
  }

  const { error } = await supabase
    .from("brand_profiles")
    .update({
      brand_name: brandName,
      industry,
      website,
      instagram_handle: instagramHandle,
      description,
    })
    .eq("profile_id", user.id);

  if (error) {
    return { error: "No se pudo guardar el perfil. Intentá de nuevo." };
  }

  revalidatePath("/ugc/marca/perfil");
  return null;
}
