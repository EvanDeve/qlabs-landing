"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarUrl } from "@/lib/ugc/url";
import { ROLE_DASHBOARD } from "@/lib/ugc/roles";
import { notifyAdminsOfPendingVerification } from "@/lib/ugc/admin-alerts";

export type OnboardingActionState = { error: string } | null;

export async function completeOnboardingAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const role = String(formData.get("role") ?? "");
  if (role !== "creator" && role !== "brand") {
    return { error: "Elegí si sos creador o marca." };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (existingProfile?.role && existingProfile.role !== role) {
    return { error: "Tu cuenta ya tiene un rol asignado." };
  }

  if (role === "creator") {
    const handleRaw = String(formData.get("handle") ?? "").trim();
    // Se guarda siempre con "@" adelante (convención del resto del sistema y de
    // la URL pública /ugc/creadores/[handle]); si no, la vista pública da 404.
    const handle = handleRaw && !handleRaw.startsWith("@") ? `@${handleRaw}` : handleRaw;
    const city = String(formData.get("city") ?? "").trim();
    const niches = String(formData.get("niches") ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const followersCount = Number(formData.get("followers_count") ?? 0) || 0;
    const instagramHandle = String(formData.get("instagram_handle") ?? "").trim() || null;
    const tiktokHandle = String(formData.get("tiktok_handle") ?? "").trim() || null;
    const bio = String(formData.get("bio") ?? "").trim() || null;

    if (!handle) {
      return { error: "El handle es obligatorio." };
    }

    // OJO: el rol va aparte del resto. El trigger `handle_new_user` ya lo setea
    // desde el metadata del signup, así que condicionar TODA la escritura a
    // `!existingProfile?.role` hacía que city y display_name nunca se guardaran
    // (quedaba el prefijo del email que puso el trigger). El rol sí se manda
    // solo si falta, por `protect_role_change`.
    const profileUpdate: { city: string; display_name: string; role?: "creator" } = {
      city,
      display_name: handle,
    };
    if (!existingProfile?.role) {
      profileUpdate.role = "creator";
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);
    if (profileError) {
      return { error: "No se pudo guardar tu perfil. Intentá de nuevo." };
    }

    // Se mira ANTES del upsert para saber si esto es un registro nuevo o alguien
    // que vuelve a pasar por el onboarding. No sirve mirar `profiles.role`: el
    // trigger `handle_new_user` ya lo dejó puesto desde el metadata del signup,
    // así que siempre viene lleno y nunca avisaríamos a nadie.
    const { data: existingCreator } = await supabase
      .from("creator_profiles")
      .select("profile_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    const { error: creatorError } = await supabase.from("creator_profiles").upsert({
      profile_id: user.id,
      handle,
      niches,
      followers_count: followersCount,
      instagram_handle: instagramHandle,
      tiktok_handle: tiktokHandle,
    });

    if (creatorError) {
      return {
        error: creatorError.code === "23505"
          ? "Ese handle ya está en uso — probá con otro."
          : "No se pudo guardar tu perfil. Intentá de nuevo.",
      };
    }

    if (bio) {
      await supabase.from("profiles").update({ bio }).eq("id", user.id);
    }

    if (!existingCreator) {
      await notifyAdminsOfPendingVerification({
        profileId: user.id,
        role: "creator",
        name: handle,
        detail: city || null,
      });
    }
  } else {
    const brandName = String(formData.get("brand_name") ?? "").trim();
    const industry = String(formData.get("industry") ?? "").trim() || null;
    const website = normalizarUrl(String(formData.get("website") ?? ""));
    const description = String(formData.get("description") ?? "").trim() || null;
    // La zona se pide desde que el registro es un wizard: el creador la ve en
    // el detalle de cada promo, así que llegaba vacía justo donde importa.
    const location = String(formData.get("location") ?? "").trim() || null;

    if (!brandName) {
      return { error: "El nombre de la marca es obligatorio." };
    }

    // Mismo caso que en la rama de creador: display_name siempre, rol solo si falta.
    const profileUpdate: { display_name: string; role?: "brand" } = {
      display_name: brandName,
    };
    if (!existingProfile?.role) {
      profileUpdate.role = "brand";
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);
    if (profileError) {
      return { error: "No se pudo guardar tu perfil. Intentá de nuevo." };
    }

    // Ver el comentario equivalente en la rama de creador: `profiles.role` no
    // sirve como señal de "registro nuevo", la existencia de la fila sí.
    const { data: existingBrand } = await supabase
      .from("brand_profiles")
      .select("profile_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    const { error: brandError } = await supabase.from("brand_profiles").upsert({
      profile_id: user.id,
      brand_name: brandName,
      industry,
      website,
      description,
      location,
    });

    if (brandError) {
      return { error: "No se pudo guardar tu perfil. Intentá de nuevo." };
    }

    if (!existingBrand) {
      await notifyAdminsOfPendingVerification({
        profileId: user.id,
        role: "brand",
        name: brandName,
        detail: industry,
      });
    }
  }

  redirect(ROLE_DASHBOARD[role]);
}
