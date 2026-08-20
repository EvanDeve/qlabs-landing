import { requireRole } from "@/lib/auth/require-role";
import QosShell, { type QosNavItem } from "@/components/ugc/QosShell";
import { displayHandle } from "@/lib/ugc/handles";

// Los grupos se arman por el ORDEN de este array: el shell corta un grupo
// nuevo cada vez que cambia el `group`, así que items del mismo grupo tienen
// que ir seguidos. Separarlos crearía dos encabezados con el mismo nombre.
//
// El criterio es qué está haciendo el creador, no qué tipo de pantalla es:
// "Mi trabajo" es lo propio de todos los días, "Herramientas" lo que usa para
// producir, "Marketplace" lo que lo conecta con marcas, y "Mi cuenta" lo que
// las marcas ven de él.
// `bottom` marca los cuatro que salen a la barra inferior en móvil: lo del día a
// día. El resto queda detrás de "Más", que abre este mismo menú.
const NAV_ITEMS: QosNavItem[] = [
  {
    href: "/ugc/creador",
    label: "Resumen",
    icon: "home",
    group: "Mi trabajo",
    bottom: true,
    // "Inicio" abajo y "Resumen" en el menú: en la barra de tabs, el primer
    // ítem es la casa a la que se vuelve, no el nombre de la pantalla.
    shortLabel: "Inicio",
  },
  {
    href: "/ugc/creador/pipeline",
    label: "Mi pipeline",
    icon: "columns",
    group: "Mi trabajo",
    bottom: true,
    shortLabel: "Pipeline",
  },

  { href: "/ugc/creador/transcripcion", label: "Transcripción", icon: "doc", group: "Herramientas" },

  {
    href: "/ugc/creador/promos",
    label: "Feed de promos",
    icon: "megaphone",
    group: "Marketplace",
    bottom: true,
    shortLabel: "Promos",
  },
  { href: "/ugc/creador/aplicaciones", label: "Mis aplicaciones", icon: "clock", group: "Marketplace" },
  // Va en Marketplace y no en "Mi cuenta": los cupones los ponen las marcas de
  // la plataforma, así que es lo mismo que el feed de promos — otra forma de
  // que una marca lo busque.
  { href: "/ugc/creador/recompensas", label: "Recompensas", icon: "sparkle", group: "Marketplace" },

  {
    href: "/ugc/creador/book",
    label: "Mi book",
    icon: "book",
    group: "Mi cuenta",
    bottom: true,
    shortLabel: "Book",
  },
  { href: "/ugc/creador/perfil", label: "Perfil", icon: "users", group: "Mi cuenta" },
];

export default async function CreadorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, supabase } = await requireRole("creator");

  const [{ data: notifications }, { data: profile }, { data: creatorProfile }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
    supabase.from("creator_profiles").select("handle").eq("profile_id", user.id).maybeSingle(),
  ]);

  // La identidad de un creador es su handle, no `display_name`: las cuentas
  // creadas antes del fix del onboarding tienen ahí el prefijo del email, y
  // mostrar parte del email en la barra lateral no tiene sentido.
  const displayed = creatorProfile?.handle
    ? displayHandle(creatorProfile.handle)
    : profile?.display_name ?? "Sin nombre";

  return (
    <QosShell
      navItems={NAV_ITEMS}
      notifications={notifications ?? []}
      userName={displayed}
      userAvatarUrl={profile?.avatar_url ?? null}
      userRole="Creador"
      section="Creador"
      encabezadoPropio
    >
      {children}
    </QosShell>
  );
}
