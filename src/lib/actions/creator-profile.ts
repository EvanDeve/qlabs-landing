"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET } from "@/lib/ugc/avatars";
import { parseLanguages } from "@/lib/ugc/languages";
import { MAX_BIO } from "@/lib/ugc/perfil";

// Ver el comentario gemelo en brand-profile.ts: `ok` es lo que deja avisar
// que el guardado entró.
export type UpdateCreatorProfileDetailsState = { error: string } | { ok: true } | null;

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

  const brandCategories = formData.getAll("brand_category").map((v) => String(v).trim());
  const brandNames = formData.getAll("brand_name").map((v) => String(v).trim());
  const pastBrands = brandCategories
    .map((category, i) => ({ category, brand_name: brandNames[i] }))
    .filter((b) => b.category && b.brand_name);

  // ---- Identidad (antes solo se seteaba en el onboarding, ahora editable) ----
  // El tope se aplica en el servidor y no solo en el input: `maxLength` es una
  // comodidad del navegador, y este action se puede llamar con lo que sea.
  const bio = String(formData.get("bio") ?? "").trim().slice(0, MAX_BIO) || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const niches = String(formData.get("niches") ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const languages = parseLanguages(formData.getAll("languages").map((v) => String(v)));
  const followersCount = Number(formData.get("followers_count") ?? 0) || 0;
  const instagramHandle = String(formData.get("instagram_handle") ?? "").trim() || null;
  const tiktokHandle = String(formData.get("tiktok_handle") ?? "").trim() || null;

  // ---- Foto de perfil (opcional) ----
  //
  // La foto NO viaja por acá: el navegador la sube directo a Storage y este
  // action recibe solo la ruta. Antes llegaba dentro del FormData, y el tope de
  // la app eran 5 MB contra el tope de body de ~4.5 MB que tienen las funciones
  // en Vercel: una foto de 4.6 MB pasaba la validación propia y moría en
  // producción con un error que no dice nada. Era el último lugar del proyecto
  // donde quedaba esa trampa; la entrega, el book y las portadas ya suben
  // directo.
  const avatarPath = String(formData.get("avatar_path") ?? "").trim();
  let avatarUrl: string | undefined;
  if (avatarPath) {
    // La ruta la arma el navegador. La policy del bucket ya impide escribir en
    // la carpeta de otro, pero nada impediría mandar acá la ruta de otro para
    // ponérsela de foto.
    if (!avatarPath.startsWith(`${user.id}/`) || avatarPath.includes("..")) {
      return { error: "Esa foto no es tuya." };
    }
    avatarUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath).data.publicUrl;
  }

  const profileUpdate: { bio: string | null; city: string | null; avatar_url?: string } = {
    bio,
    city,
  };
  if (avatarUrl) {
    profileUpdate.avatar_url = avatarUrl;
  }
  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (profileError) {
    return { error: "No se pudo guardar tu perfil. Intentá de nuevo." };
  }

  const { error: creatorError } = await supabase
    .from("creator_profiles")
    .update({
      niches,
      languages,
      followers_count: followersCount,
      instagram_handle: instagramHandle,
      tiktok_handle: tiktokHandle,
    })
    .eq("profile_id", user.id);

  if (creatorError) {
    return { error: "No se pudieron guardar los datos. Intentá de nuevo." };
  }

  await supabase.from("creator_skills").delete().eq("creator_id", user.id);
  await supabase.from("creator_past_brands").delete().eq("creator_id", user.id);

  if (skills.length > 0) {
    await supabase.from("creator_skills").insert(
      skills.map((s, i) => ({ creator_id: user.id, name: s.name, level: s.level, position: i }))
    );
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

  return { ok: true };
}
