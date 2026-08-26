"use client";

import { useState, useSyncExternalStore } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { QosIcon } from "@/lib/ugc/qos-icons";
import NotificationsBell from "@/components/ugc/NotificationsBell";
import { NotificacionesCtx } from "@/components/ugc/CampanaDePantalla";
import { signOutAction } from "@/lib/actions/auth";
import styles from "@/styles/qos.module.css";
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
   * como "/admin" es prefijo de TODO, la pantalla de perfil se anunciaría
   * como "Dashboard" y encima dejaría iluminado el item equivocado.
   */
  hidden?: boolean;
  /**
   * Para items `hidden`: de qué pantalla del menú es hija esta ruta.
   *
   * El título de la barra pasa a ser el de la ruta real ("Nueva campaña"), pero
   * el menú sigue iluminando la sección de la que se entró ("UGC·CRC"). Sin
   * esto, meterse en una campaña apaga todos los items y se siente como haberse
   * salido del panel.
   */
  parentHref?: string;
  /**
   * Sale a la barra inferior en móvil. Es opt-in por rol: admin tiene 15+
   * pantallas y elegir cuatro sería arbitrario, así que se queda con el drawer.
   * Si ningún item la pide, no se dibuja la barra.
   */
  bottom?: boolean;
  /** Solo para la barra inferior, donde "Perfil del negocio" no entra. */
  shortLabel?: string;
};

export default function QosShell({
  navItems,
  notifications,
  userName,
  userRole,
  userAvatarUrl = null,
  profileHref,
  section = "Operación",
  topbarActions,
  encabezadoPropio = false,
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
  /**
   * Cada pantalla trae su propio título grande, así que en móvil la barra de
   * arriba sobra: se convierte en una capa transparente con solo la campana,
   * enfrentada al título. Es opt-in porque hoy solo el panel del creador tiene
   * ese encabezado en todas sus pantallas — la marca y Q·OS siguen apoyándose
   * en el título de la barra.
   */
  encabezadoPropio?: boolean;
  /**
   * Controles propios de una pantalla, a la izquierda de la campanita. Se
   * renderizan en TODAS las páginas del área, así que cada uno decide solo si
   * le corresponde aparecer (ver SelectorDeMes).
   */
  topbarActions?: React.ReactNode;
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

  // Qué item del menú se pinta como activo. Coincide con la ruta salvo en las
  // pantallas hijas, que delegan en su padre.
  const highlightHref = activeItem?.parentHref ?? activeItem?.href;

  const bottomItems = navItems.filter((i) => i.bottom && !i.hidden);
  // Solo tiene sentido ofrecer "Más" si hay algo que la barra no muestra: la
  // marca tiene exactamente cuatro pantallas y todas caben, el creador no.
  const hayMas = navItems.filter((i) => !i.hidden).length > bottomItems.length;

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
    <div
      className={`${styles.qosRoot} ${encabezadoPropio ? styles.encabezadoPropio : ""}`}
      id="qos-root"
    >
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
                  const isActive = highlightHref === item.href;
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
            <div className={styles.tbHeading}>
              {/* El segundo escalón sale del grupo del item activo y solo cae en
                  `section` si el item no tiene grupo. Con `section` fijo, el
                  rastro se contradecía con el menú: /admin/transcripcion
                  decía "Operación" y el item vive en "Herramientas". */}
              <div className={styles.tbCrumb}>
                <span>Q Labs</span>
                <span>/</span>
                <span>{activeItem?.group ?? section}</span>
              </div>
              <div className={styles.tbTitle}>{activeItem?.label ?? "Q·OS"}</div>
            </div>
            <div className={styles.tbActions}>
              {/* Controles que encuadran la pantalla —hoy el mes del
                  Dashboard— antes de la campanita. Los pasa el layout, que no
                  sabe en qué página está: cada control decide solo si le toca
                  aparecer. */}
              {topbarActions}
              <NotificationsBell notifications={notifications} />
            </div>
          </header>

          {/* Las notificaciones bajan por contexto porque en móvil la campana
              la dibuja el encabezado de cada pantalla —dentro de la fila del
              título—, y un layout de App Router no puede pasarle props a la
              página que envuelve. */}
          <main className={styles.content}>
            <NotificacionesCtx.Provider value={notifications}>{children}</NotificacionesCtx.Provider>
          </main>
        </div>
      </div>

      {bottomItems.length > 0 && (
        <nav className={styles.bottomNav} aria-label="Accesos rápidos">
          {bottomItems.map((item) => {
            const isActive = highlightHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.bnItem} ${isActive ? styles.bnItemActive : ""}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                <ContenidoDeTab item={item} />
              </Link>
            );
          })}
          {hayMas && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={styles.bnItem}
              aria-label="Ver todas las secciones"
              aria-expanded={mobileOpen}
            >
              <QosIcon name="dots" size={24} />
              <span>Más</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

/**
 * El contenido de un item de la barra de abajo.
 *
 * Existe como componente aparte por `useLinkStatus`, que solo funciona dentro
 * del `<Link>`: marca el item apenas se toca, sin esperar a que la pantalla
 * cambie. Con 600-900 ms de servidor por medio, sin esto el toque no devolvía
 * ninguna señal y se sentía que el botón no había respondido.
 *
 * El `data-cargando` lo lee `.bnItem:has(...)` en el CSS, porque un hijo no
 * puede cambiarle la clase al padre.
 */
function ContenidoDeTab({ item }: { item: QosNavItem }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <QosIcon name={item.icon} size={24} />
      <span data-cargando={pending ? "" : undefined}>{item.shortLabel ?? item.label}</span>
      {typeof item.count === "number" && item.count > 0 && (
        <span className={styles.bnCount}>{item.count}</span>
      )}
    </>
  );
}
