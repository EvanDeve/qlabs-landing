"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tengoArea } from "@/lib/auth/areas";

/**
 * Atiende un pedido de eliminación de Close Friends: borra la cuenta entera.
 *
 * Decisión de Evan (2026-10-06): la opción legalmente correcta. Borrar
 * `auth.users` cascadea a profiles → members → consentimientos, vínculos y
 * bitácora. Lo que NO se va, por la migración 20261006130000:
 *   - los canjes, que quedan sin titular (son registros del negocio);
 *   - esta solicitud, que queda como constancia: fechas y quién la resolvió,
 *     sin el motivo, que lo escribió la persona.
 *
 * Va con service-role (borrar un usuario de Auth no se puede de otra forma),
 * así que la RLS no cubre nada acá: el chequeo de área es lo único que hay.
 */
export async function resolverEliminacionAction(requestId: string): Promise<void> {
  if (!(await tengoArea("ugc"))) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data: pedido } = await admin
    .from("member_deletion_requests")
    .select("id, member_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!pedido || pedido.status !== "pendiente" || !pedido.member_id) return;

  // Que la cuenta sea de verdad de un miembro. Una solicitud solo la crea
  // `pedir_eliminacion_miembro`, pero este action borra cuentas enteras: si
  // algún día apuntara a otra cosa, no tiene que poder llevarse a un creador o
  // a alguien del equipo.
  const { data: perfil } = await admin.from("profiles").select("role").eq("id", pedido.member_id).maybeSingle();
  if (perfil?.role !== "member") {
    console.error("[close-friends] solicitud de eliminación sobre una cuenta que no es de miembro:", requestId);
    return;
  }

  // Primero se borra y después se marca: si el borrado falla, la solicitud
  // sigue pendiente y a la vista, que es lo correcto.
  const { error } = await admin.auth.admin.deleteUser(pedido.member_id);
  if (error) {
    console.error("[close-friends] no se pudo borrar la cuenta:", error.message);
    return;
  }

  await admin
    .from("member_deletion_requests")
    .update({ status: "resuelta", resolved_at: new Date().toISOString(), resolved_by: user.id, reason: null })
    .eq("id", requestId);

  revalidatePath("/admin/close-friends");
  revalidatePath("/admin/ugc");
}
