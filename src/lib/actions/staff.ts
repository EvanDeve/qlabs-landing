"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarTelefonoCR } from "@/lib/whatsapp/twilio";
import { enviarRecordatorioDiario } from "@/lib/ugc/recordatorios";
import type { StaffRole } from "@/lib/database.types";

export type InviteStaffState = { error: string } | { message: string } | null;

// Invita a un colaborador nuevo por email: crea el auth.users (rol admin vía
// metadata, mismo trigger handle_new_user que el signup normal) y le manda el
// correo de invitación de Supabase para que defina su contraseña en
// /ugc/auth/set-password. Ya queda asignado a un staff_role en el mismo paso.
export async function inviteStaffAction(
  _prevState: InviteStaffState,
  formData: FormData
): Promise<InviteStaffState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const staffRole = String(formData.get("staff_role") ?? "") as StaffRole;
  const color = String(formData.get("color") ?? "#705CF6").trim() || "#705CF6";

  if (!email || !displayName || !staffRole) {
    return { error: "Nombre, email y rol son obligatorios." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role: "admin", full_name: displayName },
    redirectTo: `${siteUrl}/ugc/auth/set-password`,
  });

  if (error || !data.user) {
    return {
      error: error?.message.includes("already been registered")
        ? "Ese email ya tiene una cuenta."
        : "No se pudo enviar la invitación. Intentá de nuevo.",
    };
  }

  await admin
    .from("staff_members")
    .upsert({ profile_id: data.user.id, staff_role: staffRole, color }, { onConflict: "profile_id" });

  revalidatePath("/ugc/admin/equipo");
  return { message: `Invitación enviada a ${email}.` };
}

export async function upsertStaffMemberAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profileId = String(formData.get("profile_id") ?? "");
  const staffRole = String(formData.get("staff_role") ?? "") as StaffRole;
  const color = String(formData.get("color") ?? "#705CF6").trim() || "#705CF6";
  if (!profileId || !staffRole) return;

  await supabase
    .from("staff_members")
    .upsert({ profile_id: profileId, staff_role: staffRole, color }, { onConflict: "profile_id" });

  revalidatePath("/ugc/admin/equipo");
}

// Borra la cuenta completa del colaborador (auth.users), lo que cascadea a
// profiles/staff_members vía FK on delete cascade. Usado para limpiar data
// de prueba, no para desactivar a alguien temporalmente (para eso está
// setStaffActiveAction).
export async function deleteStaffMemberAction(profileId: string) {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(profileId);

  revalidatePath("/ugc/admin/equipo");
}

export type WhatsAppSettingsState = { error: string } | { message: string } | null;

/**
 * Guarda el teléfono, el consentimiento y la hora del recordatorio de un
 * miembro. Va con el cliente de sesión a propósito: `staff_members_all_admin`
 * es la que decide si esto puede escribir, y así no hay una segunda copia de
 * esa regla en el código.
 */
export async function saveWhatsAppSettingsAction(
  _prevState: WhatsAppSettingsState,
  formData: FormData
): Promise<WhatsAppSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida." };

  const profileId = String(formData.get("profile_id") ?? "");
  const telefonoRaw = String(formData.get("phone_e164") ?? "").trim();
  const optIn = formData.get("wa_opt_in") === "on";
  const reminderHour = Number(formData.get("reminder_hour") ?? 7);
  if (!profileId) return { error: "Falta el colaborador." };

  let telefono: string | null = null;
  if (telefonoRaw) {
    telefono = normalizarTelefonoCR(telefonoRaw);
    if (!telefono) return { error: `No pude leer "${telefonoRaw}" como número. Probá 8888-7777 o +506 8888 7777.` };
  }

  // El opt-in sin número no significa nada y dejaría al cron intentando mandar
  // a la nada todos los días.
  if (optIn && !telefono) return { error: "Para activar los recordatorios hace falta un número." };

  const { data: actual } = await supabase
    .from("staff_members")
    .select("wa_opt_in")
    .eq("profile_id", profileId)
    .maybeSingle();

  const { error } = await supabase
    .from("staff_members")
    .update({
      phone_e164: telefono,
      wa_opt_in: optIn,
      // Solo se estampa en el momento en que pasa de no a sí. Si se reescribiera
      // en cada guardado se perdería cuándo consintió, que es justo el dato que
      // hay que poder mostrar si alguien reclama.
      ...(optIn && !actual?.wa_opt_in ? { wa_opt_in_at: new Date().toISOString() } : {}),
      reminder_hour: Number.isInteger(reminderHour) && reminderHour >= 0 && reminderHour <= 23 ? reminderHour : 7,
    })
    .eq("profile_id", profileId);

  if (error) return { error: "No se pudo guardar. Intentá de nuevo." };

  revalidatePath("/ugc/admin/equipo");
  return { message: optIn ? "Guardado. Recibe recordatorios." : "Guardado. Recordatorios apagados." };
}

/**
 * Manda el recordatorio de hoy ahora mismo, salteándose la hora programada.
 *
 * Usa exactamente el mismo camino que el cron —incluido el dedupe— para que lo
 * que se prueba acá sea lo que va a pasar en producción. Consecuencia esperada:
 * si el de hoy ya salió, esto avisa que ya salió en vez de mandar un duplicado.
 */
export async function testReminderAction(
  _prevState: WhatsAppSettingsState,
  formData: FormData
): Promise<WhatsAppSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida." };

  // Acá sí hace falta el chequeo explícito: lo que sigue corre con el cliente
  // service-role, que se saltea RLS.
  const { data: quienLlama } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (quienLlama?.role !== "admin") return { error: "Solo el equipo puede hacer esto." };

  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Falta el colaborador." };

  const admin = createAdminClient();
  const { data: miembro } = await admin
    .from("staff_members")
    .select("profile_id, phone_e164, reminder_hour")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!miembro?.phone_e164) return { error: "Ese colaborador todavía no tiene número guardado." };

  const { data: perfil } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", profileId)
    .maybeSingle();

  const resultado = await enviarRecordatorioDiario(admin, {
    profileId,
    nombre: perfil?.display_name ?? "equipo",
    telefono: miembro.phone_e164,
    reminderHour: miembro.reminder_hour,
  });

  revalidatePath("/ugc/admin/equipo");

  if (resultado.estado === "enviado") return { message: "Enviado. Revisá el WhatsApp." };
  if (resultado.estado === "salteado") {
    return {
      message:
        resultado.motivo === "sin_pendientes"
          ? "No tiene nada pendiente hoy, así que no se manda nada."
          : "El recordatorio de hoy ya se había enviado.",
    };
  }
  return { error: `No se pudo enviar — ${resultado.error}` };
}

export async function setStaffActiveAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profileId = String(formData.get("profile_id") ?? "");
  const active = formData.get("active") === "true";
  if (!profileId) return;

  await supabase.from("staff_members").update({ active }).eq("profile_id", profileId);

  revalidatePath("/ugc/admin/equipo");
}
