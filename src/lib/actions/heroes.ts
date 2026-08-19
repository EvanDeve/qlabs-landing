"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { HeroContact } from "@/lib/database.types";
import { parseMes, mesCR } from "@/lib/ugc/cronograma";

const HERO_LOGO_BUCKET = "hero-logos";

function parseContacts(raw: FormDataEntryValue | null): HeroContact[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.name === "string" && c.name.trim())
      .map((c) => ({
        name: String(c.name).trim(),
        ...(c.role && String(c.role).trim() ? { role: String(c.role).trim() } : {}),
        ...(c.phone && String(c.phone).trim() ? { phone: String(c.phone).trim() } : {}),
        ...(c.email && String(c.email).trim() ? { email: String(c.email).trim() } : {}),
      }));
  } catch {
    return [];
  }
}

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

  revalidatePath("/admin/heroes");
  redirect(`/admin/heroes/${data.id}`);
}

/**
 * Archiva o desarchiva un Hero.
 *
 * Es la alternativa a `deleteHeroAction` para el caso normal —el cliente dejó
 * de serlo—, porque el delete arrastra sus piezas por el cascade de
 * `content_pieces.brand_id`. Acá no se pierde nada: deja de contar y deja de
 * aparecer donde se elige un Hero.
 */
export async function setHeroArchivedAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("agency_clients")
    .update({ archived: formData.get("archived") === "true" })
    .eq("id", id);

  // Los mismos cuatro lugares que el delete: el Dashboard cambia de KPIs y de
  // Pase de servicio, y el Pipeline y el Calendario cambian de selects.
  revalidatePath("/admin/heroes");
  revalidatePath(`/admin/heroes/${id}`);
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/calendario");
  revalidatePath("/admin");
}

export async function deleteHeroAction(id: string) {
  const supabase = await createClient();
  await supabase.from("agency_clients").delete().eq("id", id);

  revalidatePath("/admin/heroes");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/calendario");
  revalidatePath("/admin");
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
  const contacts = parseContacts(formData.get("contacts_json"));
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
      contacts,
      client_since: clientSince,
      servicios,
      ...(logoUrl ? { logo_url: logoUrl } : {}),
    })
    .eq("id", id);

  revalidatePath("/admin/heroes");
  revalidatePath(`/admin/heroes/${id}`);
  revalidatePath("/admin");
}

/**
 * Alterna el estado del cronograma de un mes (pendiente ↔ aprobado), a mano.
 *
 * Es el atajo del equipo para cuando el Hero aprueba por WhatsApp o por
 * teléfono en vez de entrar a su link. Queda registrado como `approved_by:
 * 'equipo'` justamente para poder distinguirlo después de una aprobación real
 * del cliente.
 *
 * ⚠️ El mes llega por parámetro desde el 2026-08-12. Antes se calculaba acá con
 * `now.getFullYear()/getMonth()`, que da la fecha del SERVIDOR — UTC en Vercel.
 * El 31 de agosto después de las 6 PM de Costa Rica eso ya es septiembre, así
 * que el botón aprobaba el cronograma del mes equivocado. Es el mismo bug que
 * arregló la migración 20260801000000 para las fechas de las piezas.
 */
export async function toggleCalendarMonthAction(heroId: string, monthRaw?: string) {
  const supabase = await createClient();

  const month = parseMes(monthRaw) ?? mesCR();

  const { data: existing } = await supabase
    .from("hero_calendar_months")
    .select("status")
    .eq("hero_id", heroId)
    .eq("month", month)
    .maybeSingle();

  // Sin cronograma no hay nada que aprobar. Antes esto hacía un upsert que lo
  // creaba de la nada; con la meta saliendo del cronograma, eso dejaba un mes
  // "aprobado" con cero videos y meta 0 — un Hero sin planificar figurando
  // como que cumplió. El cronograma se arma en /admin/cronogramas.
  if (!existing) return;

  const approving = existing.status !== "aprobado";

  // update y no upsert: la fila ya existe (se comprobó arriba), y un upsert acá
  // volvería a abrir la puerta a crear cronogramas de la nada.
  await supabase
    .from("hero_calendar_months")
    .update({
      status: approving ? "aprobado" : "pendiente",
      approved_at: approving ? new Date().toISOString() : null,
      // Lo marcó el equipo, no el cliente desde su link. La diferencia importa
      // a fin de mes: "el cliente aprobó" es un compromiso suyo.
      approved_by: approving ? "equipo" : null,
    })
    .eq("hero_id", heroId)
    .eq("month", month);

  revalidatePath("/admin");
  revalidatePath("/admin/cronogramas");
}
