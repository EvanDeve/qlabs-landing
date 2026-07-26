import { createClient } from "@/lib/supabase/server";
import { ROLE_DASHBOARD, ROLE_DASHBOARD_LABEL } from "@/lib/ugc/roles";
import SiteNav, { type NavAction } from "@/components/layout/SiteNav";

// Resuelve la sesión del lado del servidor y arma los botones; la barra y el
// menú móvil son el componente compartido con la landing de marketing.
export default async function PublicNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un visitante con sesión no debería ver "Iniciar sesión" ni los CTAs de
  // registro: se le ofrece la entrada directa a su panel. Sin rol todavía
  // (registro a medias) lo mandamos a terminar el onboarding.
  let actions: NavAction[];
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    actions = profile?.role
      ? [{ href: ROLE_DASHBOARD[profile.role], label: ROLE_DASHBOARD_LABEL[profile.role], variant: "primary" }]
      : [{ href: "/ugc/onboarding", label: "Completá tu registro", variant: "primary" }];
  } else {
    actions = [
      { href: "/ugc/login", label: "Iniciar sesión", variant: "ghost" },
      { href: "/ugc/login?intent=marca", label: "Publicá una campaña", variant: "outline" },
      { href: "/ugc/login?intent=creador", label: "Aplicá como creador", variant: "primary" },
    ];
  }

  return <SiteNav logoHref="/ugc" logoLabel="UGC·CRC" actions={actions} />;
}
