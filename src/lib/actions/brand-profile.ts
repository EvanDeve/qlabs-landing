"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarUrl } from "@/lib/ugc/url";
import { BRAND_LOGO_BUCKET } from "@/lib/ugc/brand-logos";

// `ok` existe para que el formulario pueda cantar "guardado": antes la acción
// devolvía null tanto al guardar bien como al no hacer nada, así que la
// pantalla no tenía forma de distinguirlos.
export type UpdateBrandProfileState = { error: string } | { ok: true } | null;

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
  // Se normaliza al guardar: sin esto, un "negocio.cr" sin esquema deja el
  // <input type="url"> del propio formulario en inválido y el guardado siguiente
  // no llega nunca a dispararse. Ver normalizarUrl().
  const website = normalizarUrl(String(formData.get("website") ?? ""));
  const instagramHandle = String(formData.get("instagram_handle") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!brandName) {
    return { error: "El nombre del negocio es obligatorio." };
  }

  // Logo (opcional). Llega como RUTA de Storage, no como archivo.
  //
  // ⚠️ Hasta el 2026-08-26 el archivo viajaba por acá adentro del FormData, con
  // un tope propio de 5 MB contra el de ~4.5 MB que tiene el body de una
  // función en Vercel: un logo de 4.6 MB pasaba la validación de este action y
  // moría en producción, andando perfecto en local. Es el mismo bug que ya se
  // había arreglado en la foto del creador; a este lo tapaba que casi nadie
  // sube un logo pesado. Ahora el navegador sube DIRECTO a Storage y acá solo
  // llega la ruta.
  const logoPath = String(formData.get("logo_path") ?? "").trim();
  let logoUrl: string | undefined;
  if (logoPath) {
    // La ruta siempre arranca con el uuid de quien sube, que es lo que exige la
    // policy del bucket. Sin este chequeo, un usuario podría mandar la carpeta
    // de otro y quedarse con su logo en el perfil.
    if (!logoPath.startsWith(`${user.id}/`)) {
      return { error: "No se pudo guardar el logo. Probá de nuevo." };
    }
    logoUrl = supabase.storage.from(BRAND_LOGO_BUCKET).getPublicUrl(logoPath).data.publicUrl;
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
  return { ok: true };
}
