"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const HERO_LOGO_BUCKET = "hero-logos";

export type CreateHeroState = { error: string } | null;

async function uploadHeroLogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  logo: FormDataEntryValue | null
): Promise<string | null> {
  if (!(logo instanceof File) || logo.size === 0) return null;

  const extension = logo.name.includes(".") ? logo.name.split(".").pop() : "jpg";
  const storagePath = `${randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(HERO_LOGO_BUCKET)
    .upload(storagePath, logo, { contentType: logo.type });

  if (error) return null;

  return supabase.storage.from(HERO_LOGO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export async function createHeroAction(
  _prevState: CreateHeroState,
  formData: FormData
): Promise<CreateHeroState> {
  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim().toLowerCase() || null;
  const website = String(formData.get("website") ?? "").trim() || null;
  const driveUrl = String(formData.get("drive_url") ?? "").trim() || null;

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const supabase = await createClient();
  const logoUrl = await uploadHeroLogo(supabase, formData.get("logo"));

  const { data, error } = await supabase
    .from("agency_clients")
    .insert({ name, industry, contact_email: contactEmail, website, drive_url: driveUrl, logo_url: logoUrl })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No se pudo crear el Hero. Intentá de nuevo." };
  }

  revalidatePath("/ugc/admin/heroes");
  redirect(`/ugc/admin/heroes/${data.id}`);
}

export async function deleteHeroAction(id: string) {
  const supabase = await createClient();
  await supabase.from("agency_clients").delete().eq("id", id);

  revalidatePath("/ugc/admin/heroes");
  revalidatePath("/ugc/admin/pipeline");
  revalidatePath("/ugc/admin/calendario");
  revalidatePath("/ugc/admin");
}

export async function updateHeroProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const website = String(formData.get("website") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim().toLowerCase() || null;
  const driveUrl = String(formData.get("drive_url") ?? "").trim() || null;
  const objetivo = String(formData.get("objetivo") ?? "").trim() || null;
  const contacts = String(formData.get("contacts") ?? "").trim() || null;
  const clientSinceRaw = String(formData.get("client_since") ?? "").trim();
  const clientSince = clientSinceRaw || null;
  const servicios = String(formData.get("servicios") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const logoUrl = await uploadHeroLogo(supabase, formData.get("logo"));

  await supabase
    .from("agency_clients")
    .update({
      name,
      industry,
      website,
      contact_email: contactEmail,
      drive_url: driveUrl,
      objetivo,
      contacts,
      client_since: clientSince,
      servicios,
      ...(logoUrl ? { logo_url: logoUrl } : {}),
    })
    .eq("id", id);

  revalidatePath("/ugc/admin/heroes");
  revalidatePath(`/ugc/admin/heroes/${id}`);
}
