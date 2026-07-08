"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HeroRisk } from "@/lib/database.types";

export type CreateHeroState = { error: string } | null;

// Crea un Hero sin pasar por el registro público del marketplace: da de alta
// el auth.users + profiles + brand_profiles directo (sin invitar ni pedir
// contraseña todavía) y lo marca como gestionado. Si el negocio quiere acceso
// al marketplace más adelante, puede "reclamar" ese email vía reset de clave
// (no construido todavía — fuera de alcance de esta pasada).
export async function createHeroAction(
  _prevState: CreateHeroState,
  formData: FormData
): Promise<CreateHeroState> {
  const brandName = String(formData.get("brand_name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim().toLowerCase();

  if (!brandName || !contactEmail) {
    return { error: "Nombre y email de contacto son obligatorios." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: contactEmail,
    email_confirm: true,
    user_metadata: { role: "brand", full_name: brandName },
  });

  if (error || !data.user) {
    return {
      error: error?.message.includes("already been registered")
        ? "Ese email ya tiene una cuenta."
        : "No se pudo crear el Hero. Intentá de nuevo.",
    };
  }

  const profileId = data.user.id;

  await admin.from("brand_profiles").insert({ profile_id: profileId, brand_name: brandName, industry });
  await admin.from("hero_profiles").insert({ profile_id: profileId, is_managed: true });

  revalidatePath("/ugc/admin/heroes");
  redirect(`/ugc/admin/heroes/${profileId}`);
}

// Borra la cuenta completa del Hero (auth.users), lo que cascadea a
// profiles/brand_profiles/hero_profiles/campaigns/content_pieces/applications
// vía FK on delete cascade. Usado para limpiar data de prueba.
export async function deleteHeroAction(profileId: string) {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(profileId);

  revalidatePath("/ugc/admin/heroes");
  revalidatePath("/ugc/admin/pipeline");
  revalidatePath("/ugc/admin/calendario");
  revalidatePath("/ugc/admin");
}

export async function setHeroManagedAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profileId = String(formData.get("profile_id") ?? "");
  const isManaged = formData.get("is_managed") === "true";
  if (!profileId) return;

  await supabase
    .from("hero_profiles")
    .upsert({ profile_id: profileId, is_managed: isManaged }, { onConflict: "profile_id" });

  revalidatePath("/ugc/admin/heroes");
  revalidatePath(`/ugc/admin/heroes/${profileId}`);
}

export async function updateHeroProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return;

  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;
  const contacts = String(formData.get("contacts") ?? "").trim() || null;
  const risk = String(formData.get("risk") ?? "onboarding") as HeroRisk;
  const clientSinceRaw = String(formData.get("client_since") ?? "").trim();
  const clientSince = clientSinceRaw || null;
  const servicios = String(formData.get("servicios") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await supabase.from("hero_profiles").upsert(
    {
      profile_id: profileId,
      is_managed: true,
      objetivo,
      contacts,
      risk,
      client_since: clientSince,
      servicios,
    },
    { onConflict: "profile_id" }
  );

  revalidatePath("/ugc/admin/heroes");
  revalidatePath(`/ugc/admin/heroes/${profileId}`);
}
