import { createClient } from "@/lib/supabase/server";
import { destinoDeSesion, RUTA_PENDIENTE } from "@/lib/ugc/estado-cuenta";
import { ROLE_DASHBOARD, ROLE_DASHBOARD_LABEL } from "@/lib/ugc/roles";
import SiteNav, { type NavAction } from "@/components/layout/SiteNav";
import type { AppRole } from "@/lib/database.types";

// Resuelve la sesión del lado del servidor y arma los botones; la barra y el
// menú móvil son el componente compartido con la landing de marketing.
export default async function PublicNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un visitante con sesión no debería ver "Iniciar sesión" ni los CTAs de
  // registro: se le ofrece la entrada directa a donde le corresponde. Sin rol
  // todavía (registro a medias) va al onboarding, y sin verificar, a la pantalla
  // de estado — el botón no puede prometer un panel al que no va a poder entrar.
  let actions: NavAction[];
  if (user) {
    const destino = await destinoDeSesion(supabase, user.id);
    const rol = (Object.keys(ROLE_DASHBOARD) as AppRole[]).find(
      (r) => ROLE_DASHBOARD[r] === destino
    );
    const label = rol
      ? ROLE_DASHBOARD_LABEL[rol]
      : destino === RUTA_PENDIENTE
        ? "Estado de tu cuenta"
        : "Completá tu registro";

    actions = [{ href: destino, label, variant: "primary" }];
  } else {
    actions = [
      { href: "/ugc/login", label: "Iniciar sesión", variant: "ghost" },
      { href: "/ugc/login?intent=marca", label: "Publicá una campaña", variant: "outline" },
      { href: "/ugc/login?intent=creador", label: "Aplicá como creador", variant: "primary" },
    ];
  }

  return <SiteNav logoHref="/ugc" logoLabel="UGC·CRC" actions={actions} />;
}
