"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { QosIcon } from "@/lib/ugc/qos-icons";
import NotificationsBell from "@/components/ugc/NotificationsBell";
import { signOutAction } from "@/lib/actions/auth";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";
// ^ el CSS module vive físicamente bajo admin/ porque ahí lo importan otros
// ~15 componentes de admin; moverlo implicaría tocar todos esos imports por
// una razón puramente cosmética. QosShell ya no es admin-only, pero el
// archivo de estilos sigue siendo la fuente compartida real.

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

// La preferencia de menú encogido se recuerda entre sesiones: quien trabaja
// todo el día acá no quiere volver a encogerlo en cada carga.
//
// Se lee con useSyncExternalStore y no con useState+useEffect por dos razones:
// el servidor no puede saber qué eligió este usuario (con useState se rompe la
// hidratación), y setear estado dentro de un efecto dispara un render en
// cascada. `getServerSnapshot` devuelve false, así que el HTML del servidor
// siempre sale expandido y el cliente ajusta en el primer commit.
const SIDEBAR_KEY = "qos:sidebar-collapsed";
// localStorage no avisa cambios en la MISMA pestaña —el evento `storage` solo
// llega a las otras—, así que se emite uno propio.
const SIDEBAR_EVENT = "qos:sidebar-change";

function subscribeSidebar(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_EVENT, onChange);
  };
}

const getSidebarSnapshot = () => localStorage.getItem(SIDEBAR_KEY) === "1";
const getSidebarServerSnapshot = () => false;

export type QosNavItem = {
  href: string;
  label: string;
  icon: string;
  group?: string;
  count?: number;
  /**
   * No se dibuja en el menú, pero sí cuenta para saber en qué página se está.
   *
   * Sin esto, una ruta que no está en navItems cae en el fallback por prefijo y
   * como "/ugc/admin" es prefijo de TODO, la pantalla de perfil se anunciaría
   * como "Dashboard" y encima dejaría iluminado el item equivocado.
   */
  hidden?: boolean;
};

export default function QosShell({
  navItems,
  notifications,
  userName,
  userRole,
  userAvatarUrl = null,
  profileHref,
  section = "Operación",
  children,
}: {
  navItems: QosNavItem[];
  notifications: Notification[];
  userName: string;
  userRole: string;
  userAvatarUrl?: string | null;
  /**
   * Si viene, el bloque de usuario del pie de la sidebar lleva a la pantalla de
   * perfil. Es opcional porque no todos los lados del producto tienen una: el
   * creador edita su perfil desde el marketplace y la marca todavía no tiene.
   */
  profileHref?: string;
  section?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot
  );

  function toggleSidebar() {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  const activeItem =
    navItems.find((item) => pathname === item.href) ??
    [...navItems].sort((a, b) => b.href.length - a.href.length).find((item) => pathname.startsWith(item.href));

  const groups: { group: string | undefined; items: QosNavItem[] }[] = [];
  for (const item of navItems.filter((i) => !i.hidden)) {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) {
      last.items.push(item);
    } else {
      groups.push({ group: item.group, items: [item] });
    }
  }

  // El "@" de los handles no sirve como inicial (todos los creadores tendrían
  // la misma), así que se descarta antes de sacar las letras.
  const initials =
    userName
      .replace(/^@+/, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "Q";

  return (
    <div className={styles.qosRoot} id="qos-root">
      {mobileOpen && <div className={styles.sbScrim} onClick={() => setMobileOpen(false)} />}
      <div className={`${styles.app} ${collapsed ? styles.appCollapsed : ""}`}>
        <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
          <div className={styles.sbBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon-logo.png" alt="Q Labs" className={styles.qMark} style={{ objectFit: "cover" }} />
            <div className={styles.sub}>Centro de Mando</div>
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className={styles.sbToggle}
            title={collapsed ? "Expandir menú" : "Encoger menú"}
            aria-label={collapsed ? "Expandir menú" : "Encoger menú"}
          >
            <QosIcon name={collapsed ? "chevR" : "chevL"} size={14} />
          </button>

          <nav className={styles.sbNav} aria-label="Navegación principal">
            {groups.map((g, gi) => (
              <div key={gi}>
                {g.group && <div className={styles.navLabel}>{g.group}</div>}
                {g.items.map((item) => {
                  const isActive = activeItem?.href === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <QosIcon name={item.icon} size={18} className={styles.navIc} />
                      <span>{item.label}</span>
                      {typeof item.count === "number" && item.count > 0 && (
                        <span className={styles.navCount}>{item.count}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className={styles.sbFoot}>
            {/* El bloque es <Link> cuando hay pantalla de perfil y <div> cuando
                no. La cara propia es el lugar donde uno busca cambiar su foto,
                así que el afinado va acá y no en un item más del menú. */}
            {(() => {
              const contenido = (
                <>
                  <div className={styles.av}>
                    {userAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userAvatarUrl} alt="" className={styles.avImg} />
                    ) : (
                      initials
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.uName} title={userName}>
                      {userName}
                    </div>
                    <div className={styles.uRole}>{userRole}</div>
                  </div>
                </>
              );

              return profileHref ? (
                <Link href={profileHref} className={`${styles.sbUser} ${styles.sbUserLink}`} title="Mi perfil">
                  {contenido}
                </Link>
              ) : (
                <div className={styles.sbUser}>{contenido}</div>
              );
            })()}
            <form action={signOutAction}>
              <button type="submit" className={styles.sbSignOut} title="Cerrar sesión" aria-label="Cerrar sesión">
                <QosIcon name="logout" size={16} />
              </button>
            </form>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
              className={`${styles.calNavBtn} ${styles.mobileMenuBtn}`}
            >
              <QosIcon name="menu" size={18} />
            </button>
            <div>
              <div className={styles.tbCrumb}>
                <span>Q Labs</span>
                <span>/</span>
                <span>{section}</span>
              </div>
              <div className={styles.tbTitle}>{activeItem?.label ?? "Q·OS"}</div>
            </div>
            <div className={styles.tbActions}>
              <NotificationsBell notifications={notifications} />
            </div>
          </header>

          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </div>
  );
}
