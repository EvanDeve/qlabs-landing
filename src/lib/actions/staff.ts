"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { soyDirector } from "@/lib/auth/require-director";
import { normalizarTelefonoCR } from "@/lib/whatsapp/twilio";
import { enviarRecordatorioDiario } from "@/lib/ugc/recordatorios";
import type { StaffRole } from "@/lib/database.types";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import { generarLinkDeAcceso, botonDeCorreo } from "@/lib/auth/link-de-acceso";
import { sendTransactionalEmail } from "@/lib/email/resend";

export type InviteStaffState = { error: string } | { message: string } | null;

// Invita a un colaborador nuevo por email: crea el auth.users (el trigger
// handle_new_user deja el perfil sin rol y acá se le pone admin) y le manda
// por Resend el link para que defina su contraseña en /auth/set-password. Ya
// queda asignado a un staff_role en el mismo paso.
//
// El correo ya no lo manda Supabase (`inviteUserByEmail`): su link se gasta con
// el solo GET y los filtros de correo corporativos lo abren antes que la
// persona. Ver `generarLinkDeAcceso`.
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

  // Lo que sigue corre con service-role y crea una cuenta: la RLS no lo frena,
  // así que el permiso se chequea acá.
  if (!(await soyDirector())) return { error: "Solo un director puede invitar gente al equipo." };

  const admin = createAdminClient();
  const { error, link, user: nuevo } = await generarLinkDeAcceso(admin, {
    tipo: "invite",
    email,
    data: { role: "admin", full_name: displayName },
  });

  if (error || !link || !nuevo) {
    return {
      error: error?.includes("already been registered")
        ? "Ese email ya tiene una cuenta."
        : "No se pudo crear la invitación. Intentá de nuevo.",
    };
  }

  // El rol va aparte y con service role: `handle_new_user` ya no toma 'admin'
  // del metadata (lo manda cualquiera que llame a /auth/v1/signup), solo
  // creator o brand. Ver 20260924100000. El `role` del metadata de arriba se
  // deja porque no molesta y documenta la intención en auth.users.
  const { error: rolError } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", nuevo.id);
  if (rolError) {
    console.error("[inviteStaffAction] no se pudo poner el rol admin:", rolError.message);
    return { error: "Se mandó la invitación, pero la cuenta quedó sin acceso al panel: hay que ponerle el rol admin a mano en Supabase." };
  }

  await admin
    .from("staff_members")
    .upsert({ profile_id: nuevo.id, staff_role: staffRole, color }, { onConflict: "profile_id" });

  revalidatePath("/admin/equipo");

  // La cuenta ya existe: si el correo no sale, se arregla con "Reenviar acceso"
  // y no volviendo a invitar (eso diría "ya tiene una cuenta").
  const enviado = await mandarCorreoDeAcceso(email, link);
  if (!enviado) {
    return { error: "La cuenta quedó creada pero el correo no salió. Probá «Reenviar acceso» en su fila de Integrantes." };
  }
  return { message: `Invitación enviada a ${email}.` };
}

function mandarCorreoDeAcceso(email: string, link: string) {
  return sendTransactionalEmail(
    email,
    "Tu acceso a Q·OS",
    `<p>Te dieron acceso a Q·OS, el panel del equipo de Q Labs.</p>
     ${botonDeCorreo(link, "Definir mi contraseña")}
     <p>El link sirve una sola vez. Si vence, pedí que te reenvíen el acceso.</p>`
  );
}

export type ReenviarAccesoState = { error?: string; ok?: string } | null;

/**
 * Manda de nuevo el link para definir contraseña a alguien del equipo. Sirve
 * para quien nunca entró y para quien entró y se quedó sin contraseña (el caso
 * del link quemado por el filtro de correo, que deja la cuenta confirmada pero
 * sin clave). Va por recovery porque invite no se puede repetir sobre una
 * cuenta que ya existe.
 *
 * Supabase guarda un solo token por cuenta: este link invalida el anterior.
 */
export async function reenviarAccesoAction(
  _prev: ReenviarAccesoState,
  formData: FormData
): Promise<ReenviarAccesoState> {
  // Genera un link que entra a la cuenta de otra persona: solo directores.
  if (!(await soyDirector())) return { error: "Solo un director puede reenviar accesos." };

  const profileId = String(formData.get("profile_id") ?? "");
  const admin = createAdminClient();
  const { data: cuenta } = await admin.auth.admin.getUserById(profileId);
  const email = cuenta.user?.email;
  if (!email) return { error: "No encontré el correo de esa cuenta." };

  const { link } = await generarLinkDeAcceso(admin, { tipo: "recovery", email, comoInvitacion: true });
  if (!link) return { error: "No se pudo generar el link. Intentá de nuevo." };

  if (!(await mandarCorreoDeAcceso(email, link))) return { error: "El correo no salió. Intentá de nuevo en unos minutos." };
  return { ok: `Listo, le llegó a ${email}.` };
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

  revalidatePath("/admin/equipo");
}

// Borra la cuenta completa del colaborador (auth.users), lo que cascadea a
// profiles/staff_members vía FK on delete cascade. Usado para limpiar data
// de prueba, no para desactivar a alguien temporalmente (para eso está
// setStaffActiveAction).
export async function deleteStaffMemberAction(profileId: string) {
  // Borra un auth.users con service-role. Sin este chequeo, cualquiera con
  // sesión podía invocar el action y dejar al equipo sin una cuenta.
  if (!(await soyDirector())) return;

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(profileId);

  revalidatePath("/admin/equipo");
}

export type WhatsAppSettingsState = { error: string } | { message: string } | null;

/**
 * Guarda el teléfono, el consentimiento y la hora del recordatorio de un
 * miembro. Va con el cliente de sesión a propósito: `staff_members_all_director`
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

  const { data: filas, error } = await supabase
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
    .eq("profile_id", profileId)
    // Un UPDATE que la RLS no deja pasar no es un error: es un 204 con cero
    // filas. Sin pedir la fila de vuelta, un no-director vería "Guardado" y no
    // se habría guardado nada.
    .select("profile_id");

  if (error) return { error: "No se pudo guardar. Intentá de nuevo." };
  if (!filas?.length) return { error: "Solo un director puede cambiar estos datos." };

  revalidatePath("/admin/equipo");
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
  // service-role, que se saltea RLS. Y manda un WhatsApp de verdad.
  if (!(await soyDirector())) return { error: "Solo un director puede mandar recordatorios." };

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

  revalidatePath("/admin/equipo");

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

export type CambiarRolState = { error?: string; ok?: string } | null;

/**
 * Cambia el puesto de alguien del equipo desde Equipo. Escribe con la sesión:
 * `staff_members_all_director` ya deja solo a directores, y el chequeo de acá
 * es para devolver un error legible.
 *
 * El propio no se puede cambiar. Así un director no se baja a sí mismo por
 * error y nunca queda el equipo sin nadie que pueda volver a subirlo.
 */
export async function cambiarRolAction(_prev: CambiarRolState, formData: FormData): Promise<CambiarRolState> {
  if (!(await soyDirector())) return { error: "Solo un director puede cambiar roles." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profileId = String(formData.get("profile_id") ?? "");
  const staffRole = String(formData.get("staff_role") ?? "") as StaffRole;
  if (!profileId || !(staffRole in STAFF_ROLE_LABEL)) return { error: "Elegí un rol." };
  if (profileId === user?.id) return { error: "Tu propio rol lo tiene que cambiar otro director." };

  const { error } = await supabase.from("staff_members").update({ staff_role: staffRole }).eq("profile_id", profileId);
  if (error) return { error: "No se pudo cambiar el rol." };

  revalidatePath("/admin/equipo");
  // Cambia qué secciones ve y, si pasa a UGC o sale de director, qué boards.
  revalidatePath("/admin", "layout");
  return { ok: `Ahora es ${STAFF_ROLE_LABEL[staffRole]}.` };
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

  revalidatePath("/admin/equipo");
}
