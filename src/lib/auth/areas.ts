import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import type { StaffRole } from "@/lib/database.types";

/**
 * Las dos mitades de Q·OS.
 *
 * - `agencia`: lo de Q Labs como agencia — Heroes, Pipeline, Cronogramas,
 *   Calendario, Transcripción, Voz.
 * - `ugc`: lo del marketplace y lo que cuelga de él — Marketplace, Loyalty,
 *   Disputas, Close Friends.
 *
 * El rol `ugc` (gente que entra solo a administrar el marketplace) ve
 * únicamente la segunda; el director ve las dos; el resto del equipo, la
 * primera, como hasta ahora. Esta es la capa de UI: la que protege los datos
 * es la RLS (`es_equipo_agencia()` / `es_equipo_ugc()`, migración
 * 20261006110000), con la misma regla.
 */
export type Area = "agencia" | "ugc";

export type Areas = { agencia: boolean; ugc: boolean; director: boolean };

export function areasDelRol(staff: { staff_role: StaffRole; active: boolean } | null): Areas {
  const director = staff?.staff_role === "director" && staff.active;
  if (director) return { agencia: true, ugc: true, director: true };
  // Sin fila en staff_members o dado de baja: lo mismo que veía antes de que
  // existieran las áreas. Una cuenta UGC dada de baja no gana la agencia: la
  // condición mira el rol, no `active`.
  if (staff?.staff_role === "ugc") return { agencia: false, ugc: true, director: false };
  return { agencia: true, ugc: false, director: false };
}

/** Adónde cae alguien que pide una pantalla que no es de su área. */
export function inicioDe(areas: Areas): string {
  return areas.agencia ? "/admin" : "/admin/ugc";
}

/**
 * Puerta de una pantalla de Q·OS por área. Rebota al inicio propio en vez de
 * mostrar un 403, igual que `requireDirector`.
 */
export async function requireArea(area: Area) {
  const { user, supabase } = await requireRole("admin");
  const { data: staff } = await supabase
    .from("staff_members")
    .select("staff_role, active")
    .eq("profile_id", user.id)
    .maybeSingle();

  const areas = areasDelRol(staff);
  if (!areas[area]) redirect(inicioDe(areas));

  return { user, supabase, areas };
}

/**
 * La misma pregunta sin redirigir, para server actions y route handlers que
 * escriben con service-role o gastan una API paga: la RLS no los cubre.
 */
export async function tengoArea(area: Area): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("staff_members").select("staff_role, active").eq("profile_id", user.id).maybeSingle(),
  ]);
  if (profile?.role !== "admin") return false;

  return areasDelRol(staff)[area];
}
