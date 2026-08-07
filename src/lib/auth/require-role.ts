import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RUTA_PENDIENTE } from "@/lib/ugc/estado-cuenta";
import { ROLE_DASHBOARD } from "@/lib/ugc/roles";
import type { AppRole } from "@/lib/database.types";

// UI-level gate for the role dashboards: RLS is the real security boundary
// at the data level, so a bug here can never leak another role's data.
export async function requireRole(role: AppRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role) {
    redirect("/ugc/onboarding");
  }

  if (profile.role !== role) {
    redirect(ROLE_DASHBOARD[profile.role]);
  }

  // Gate de verificación. Va acá y no en cada pantalla porque los tres layouts
  // pasan por esta función: es el único punto por el que se entra al panel.
  //
  // Admin queda exento — no tiene fila en creator_profiles/brand_profiles, y su
  // acceso lo da `profiles.role`, que solo puede cambiar otro admin
  // (trigger `protect_role_change`).
  if (role === "creator" || role === "brand") {
    const tabla = role === "creator" ? "creator_profiles" : "brand_profiles";
    const { data: fila } = await supabase
      .from(tabla)
      .select("verified")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!fila) {
      redirect("/ugc/onboarding");
    }

    if (!fila.verified) {
      redirect(RUTA_PENDIENTE);
    }
  }

  return { user, supabase };
}
