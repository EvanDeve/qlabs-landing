"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BRAND_LOGO_BUCKET, MAX_BRAND_LOGO_FILE_BYTES } from "@/lib/ugc/brand-logos";

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
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!brandName) {
    return { error: "El nombre del negocio es obligatorio." };
  }

  // Logo (opcional) — mismo patrón que la foto del creador.
  const logoFile = formData.get("logo");
  let logoUrl: string | undefined;
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > MAX_BRAND_LOGO_FILE_BYTES) {
      return { error: "El logo supera el tamaño máximo (5 MB)." };
    }
    const ext = logoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BRAND_LOGO_BUCKET)
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
    if (uploadError) {
      return { error: "No se pudo subir el logo. Intentá de nuevo." };
    }
    logoUrl = supabase.storage.from(BRAND_LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const update: {
    brand_name: string;
    industry: string | null;
    website: string | null;
    instagram_handle: string | null;
    description: string | null;
    location: string | null;
    logo_url?: string;
  } = {
    brand_name: brandName,
    industry,
    website,
    instagram_handle: instagramHandle,
    description,
    location,
  };
  if (logoUrl) {
    update.logo_url = logoUrl;
  }

  const { error } = await supabase
    .from("brand_profiles")
    .update(update)
    .eq("profile_id", user.id);

  if (error) {
    return { error: "No se pudo guardar el perfil. Intentá de nuevo." };
  }

  // El logo y el nombre se muestran en el feed del creador y en el detalle de
  // cada promo, así que esas vistas también quedan obsoletas al guardar.
  revalidatePath("/ugc/marca/perfil");
  revalidatePath("/ugc/creador");
  revalidatePath("/ugc");
  return null;
}
