import { createClient } from "@/lib/supabase/server";
import { ROLE_DASHBOARD, ROLE_DASHBOARD_LABEL } from "@/lib/ugc/roles";
import PublicNavClient, { type NavSession } from "./PublicNavClient";

// Resuelve la sesión del lado del servidor y le pasa el resultado ya masticado
// al componente cliente, que es el que necesita estado para el menú móvil.
export default async function PublicNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un visitante con sesión no debería ver "Iniciar sesión" ni los CTAs de
  // registro: se le ofrece la entrada directa a su panel. Sin rol todavía
  // (registro a medias) lo mandamos a terminar el onboarding.
  let session: NavSession = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    session = profile?.role
      ? { href: ROLE_DASHBOARD[profile.role], label: ROLE_DASHBOARD_LABEL[profile.role] }
      : { href: "/ugc/onboarding", label: "Completá tu registro" };
  }

  return <PublicNavClient session={session} />;
}
