import { requireRole } from "@/lib/auth/require-role";
import QosShell, { type QosNavItem } from "@/components/ugc/QosShell";

export default async function MarcaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, supabase } = await requireRole("brand");

  const [{ data: notifications }, { data: profile }, { data: campaigns }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("campaigns").select("id").eq("brand_id", user.id),
  ]);

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { count: pendingCount } = campaignIds.length
    ? await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("campaign_id", campaignIds)
        .eq("status", "pending")
    : { count: 0 };

  const navItems: QosNavItem[] = [
    { href: "/ugc/marca", label: "Resumen", icon: "grid", group: "Centro de Mando" },
    {
      href: "/ugc/marca/ugc",
      label: "UGC·CRC",
      icon: "megaphone",
      group: "Marketing",
      count: pendingCount ?? 0,
    },
    { href: "/ugc/marca/perfil", label: "Perfil del negocio", icon: "briefcase", group: "Cuenta" },
  ];

  return (
    <QosShell
      navItems={navItems}
      notifications={notifications ?? []}
      userName={profile?.display_name ?? "Sin nombre"}
      userRole="Marca"
      section="Marca"
    >
      {children}
    </QosShell>
  );
}
