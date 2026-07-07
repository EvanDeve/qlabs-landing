import { requireRole } from "@/lib/auth/require-role";
import DashboardShell from "@/components/ugc/DashboardShell";

const NAV_ITEMS = [{ href: "/ugc/admin", label: "Panel admin" }];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, supabase } = await requireRole("admin");

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
