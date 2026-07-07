import { requireRole } from "@/lib/auth/require-role";
import DashboardShell from "@/components/ugc/DashboardShell";

const NAV_ITEMS = [
  { href: "/ugc/creador", label: "Campañas" },
  { href: "/ugc/creador/book", label: "Mi book" },
  { href: "/ugc/creador/perfil", label: "Mi perfil" },
  { href: "/ugc/creador/aplicaciones", label: "Mis aplicaciones" },
];

export default async function CreadorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, supabase } = await requireRole("creator");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <DashboardShell navItems={NAV_ITEMS} notifications={notifications ?? []}>
      {children}
    </DashboardShell>
  );
}
