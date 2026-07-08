"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
