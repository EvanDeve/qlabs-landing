import { requireMember } from "@/lib/cf/sesion";
import { CF } from "@/lib/cf/copy";
import QosShell, { type QosNavItem } from "@/components/ugc/QosShell";
import Toaster from "@/components/ugc/Toaster";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

// Las cuatro van a la barra de abajo: en el celular, que es donde vive esta
// app, no hay menú "Más" porque no hay nada más.
const NAV_ITEMS: QosNavItem[] = [
  { href: "/cf", label: "Inicio", icon: "home", group: CF.programa, bottom: true },
  { href: "/cf/cupones", label: "Cupones", icon: "grid", group: CF.programa, bottom: true },
  { href: "/cf/qs", label: "Qs", icon: "sparkle", group: CF.programa, bottom: true },
  { href: "/cf/perfil", label: "Perfil", icon: "users", group: CF.programa, bottom: true },
];

/**
 * El panel del miembro: el mismo shell que el del creador (barra de abajo en
 * móvil, encabezado propio en cada pantalla, Plus Jakarta), para que se sienta
 * parte de la misma plataforma. La puerta es `requireMember`.
 */
export default async function PanelCfLayout({ children }: { children: React.ReactNode }) {
  const { user, supabase, miembro } = await requireMember();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <Toaster>
      <div className={`${styles.fuenteMarketplace} min-h-screen bg-white text-ink`}>
        <QosShell
          navItems={NAV_ITEMS}
          notifications={notifications ?? []}
          userName={miembro.agent_name}
          userRole={CF.miembroCorto}
          profileHref="/cf/perfil"
          section={CF.programa}
          encabezadoPropio
        >
          {children}
        </QosShell>
      </div>
    </Toaster>
  );
}
