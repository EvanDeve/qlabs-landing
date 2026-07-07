import { requireRole } from "@/lib/auth/require-role";
import DashboardShell from "@/components/ugc/DashboardShell";

const NAV_ITEMS = [{ href: "/ugc/marca", label: "Mis campañas" }];

export default async function MarcaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, supabase } = await requireRole("brand");

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
