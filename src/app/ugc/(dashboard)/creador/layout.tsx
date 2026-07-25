import { requireRole } from "@/lib/auth/require-role";
import QosShell, { type QosNavItem } from "@/components/ugc/QosShell";
import { displayHandle } from "@/lib/ugc/handles";

const NAV_ITEMS: QosNavItem[] = [
  { href: "/ugc/creador", label: "Feed de promos", icon: "megaphone" },
  { href: "/ugc/creador/book", label: "Mi book", icon: "book" },
  { href: "/ugc/creador/aplicaciones", label: "Mis aplicaciones", icon: "clock" },
  { href: "/ugc/creador/perfil", label: "Perfil", icon: "users" },
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
    >
      {children}
    </QosShell>
  );
}
