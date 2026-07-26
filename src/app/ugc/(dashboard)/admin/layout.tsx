import { requireRole } from "@/lib/auth/require-role";
import QosShell, { type QosNavItem } from "@/components/ugc/QosShell";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, supabase } = await requireRole("admin");

  const [{ data: notifications }, { data: profile }, { data: staffMember }, { data: activePieces }, { data: heroes }] =
    await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
      supabase.from("staff_members").select("staff_role").eq("profile_id", user.id).maybeSingle(),
      supabase.from("content_pieces").select("id").neq("stage", "publicado"),
      supabase.from("agency_clients").select("id"),
    ]);

  // Las disputas van con contador en el nav: si nadie las ve, quedan abiertas
  // indefinidamente y ese es justo el problema que vinieron a resolver.
  const { count: disputasAbiertas } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "disputed");

  const navItems: QosNavItem[] = [
    { href: "/ugc/admin", label: "Dashboard", icon: "grid", group: "Operación" },
    {
      href: "/ugc/admin/pipeline",
      label: "Pipeline",
      icon: "columns",
      group: "Operación",
      count: activePieces?.length ?? 0,
    },
    { href: "/ugc/admin/calendario", label: "Calendario", icon: "calendar", group: "Operación" },
    { href: "/ugc/admin/heroes", label: "Heroes", icon: "users", group: "Operación", count: heroes?.length ?? 0 },
    { href: "/ugc/admin/equipo", label: "Equipo", icon: "briefcase", group: "Sistema" },
    { href: "/ugc/admin/marketplace", label: "Marketplace", icon: "megaphone", group: "Sistema" },
    {
      href: "/ugc/admin/disputas",
      label: "Disputas",
      icon: "megaphone",
      group: "Sistema",
      count: disputasAbiertas ?? 0,
    },
  ];

  return (
    <QosShell
      navItems={navItems}
      notifications={notifications ?? []}
      userName={profile?.display_name ?? "Sin nombre"}
      userAvatarUrl={profile?.avatar_url ?? null}
      userRole={staffMember ? STAFF_ROLE_LABEL[staffMember.staff_role] : "Admin"}
    >
      {children}
    </QosShell>
  );
}
