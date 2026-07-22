import { requireRole } from "@/lib/auth/require-role";
import QosShell, { type QosNavItem } from "@/components/ugc/QosShell";

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

  const [{ data: notifications }, { data: profile }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);

  return (
    <QosShell
      navItems={NAV_ITEMS}
      notifications={notifications ?? []}
      userName={profile?.display_name ?? "Sin nombre"}
      userRole="Creador"
      section="Creador"
    >
      {children}
    </QosShell>
  );
}
