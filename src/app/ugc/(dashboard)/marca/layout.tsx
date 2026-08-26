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
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
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

  // Las cuatro pantallas de la marca caben enteras en la barra inferior de
  // móvil, así que van todas con `bottom` y el shell no dibuja el "Más".
  const navItems: QosNavItem[] = [
    { href: "/ugc/marca", label: "Resumen", icon: "grid", group: "Centro de Mando", bottom: true },
    {
      href: "/ugc/marca/ugc",
      label: "UGC·CRC",
      icon: "megaphone",
      group: "Marketing",
      count: pendingCount ?? 0,
      bottom: true,
    },
    {
      href: "/ugc/marca/loyalty",
      label: "Loyalty Loop",
      icon: "sparkle",
      group: "Marketing",
      bottom: true,
      shortLabel: "Loyalty",
    },
    {
      href: "/ugc/marca/perfil",
      label: "Perfil del negocio",
      icon: "briefcase",
      group: "Cuenta",
      bottom: true,
      shortLabel: "Perfil",
    },
    // Pantallas que no van en el menú pero sí tienen que nombrarse en la barra:
    // sin ellas, "/ugc/marca/campanas/nueva" cae en el fallback por prefijo,
    // matchea "/ugc/marca" y el header anuncia "Resumen" mientras el menú
    // ilumina el Resumen. Van al final del array: los grupos se cortan por orden
    // y un item oculto en medio partiría "Marketing" en dos encabezados.
    // El orden entre ellas no importa — gana el href más largo que calce.
    {
      href: "/ugc/marca/campanas/nueva",
      label: "Nueva campaña",
      icon: "megaphone",
      group: "UGC·CRC",
      hidden: true,
      parentHref: "/ugc/marca/ugc",
    },
    {
      href: "/ugc/marca/campanas",
      label: "Campaña",
      icon: "megaphone",
      group: "UGC·CRC",
      hidden: true,
      parentHref: "/ugc/marca/ugc",
    },
    {
      href: "/ugc/marca/validar",
      label: "Validar canje",
      icon: "check",
      group: "Loyalty Loop",
      hidden: true,
      parentHref: "/ugc/marca/loyalty",
    },
  ];

  return (
    <QosShell
      navItems={navItems}
      notifications={notifications ?? []}
      userName={profile?.display_name ?? "Sin nombre"}
      userAvatarUrl={profile?.avatar_url ?? null}
      userRole="Marca"
      section="Marca"
      // Desde el rediseño de 2026-08-26 las pantallas de marca traen su propio
      // título, así que en móvil la barra de Q·OS —hamburguesa, rastro y
      // título— se convierte en la campana sola. Las tres que todavía no se
      // rediseñaron (UGC·CRC, Loyalty y el detalle de campaña) ya tienen su
      // encabezado propio, así que ninguna queda sin título.
      encabezadoPropio
    >
      {children}
    </QosShell>
  );
}
