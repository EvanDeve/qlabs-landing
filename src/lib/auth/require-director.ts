import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

/**
 * Puerta de las rutas de Sistema (Equipo, McLovin, Chat, Marketplace, Disputas).
 *
 * El corte del panel no es `profiles.role` —los cinco del equipo son 'admin'—
 * sino `staff_members.staff_role`. Un guionista entra a Q·OS igual, pero no a
 * los teléfonos del equipo ni a las conversaciones de WhatsApp.
 *
 * Esto es la capa de UI: manda a alguien de vuelta al Dashboard en vez de
 * mostrarle un 403. La que de verdad protege los datos es la RLS
 * (`is_director()`, migración 20260803000000); si esta función tuviera un bug,
 * la página cargaría vacía, no llena.
 */
export async function requireDirector() {
  const { user, supabase } = await requireRole("admin");

  // La fila propia siempre se puede leer (policy staff_members_select_self),
  // así que esta consulta funciona para cualquiera del equipo.
  const { data: staffMember } = await supabase
    .from("staff_members")
    .select("staff_role, active")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (staffMember?.staff_role !== "director" || !staffMember.active) {
    redirect("/ugc/admin");
  }

  return { user, supabase };
}

/**
 * La misma pregunta, sin redirigir. Para los server actions.
 *
 * Un server action no está protegido por el guard de la página desde la que se
 * usa: cualquiera con sesión puede invocarlo. Cuando el action escribe con el
 * cliente de sesión alcanza con la RLS, pero los que usan service-role
 * —invitar, borrar una cuenta, disparar un WhatsApp— se la saltean por
 * diseño, y ahí este chequeo es lo único que queda.
 */
export async function soyDirector(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("staff_members")
    .select("staff_role, active")
    .eq("profile_id", user.id)
    .maybeSingle();

  return data?.staff_role === "director" && data.active === true;
}
