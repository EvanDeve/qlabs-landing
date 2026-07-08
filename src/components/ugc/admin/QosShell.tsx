"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { QosIcon } from "@/lib/ugc/qos-icons";
import NotificationsBell from "@/components/ugc/NotificationsBell";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export type QosNavItem = {
  href: string;
  label: string;
  icon: string;
  group?: string;
  count?: number;
};

export default function QosShell({
  navItems,
  notifications,
  userName,
  userRole,
  children,
}: {
  navItems: QosNavItem[];
  notifications: Notification[];
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItem =
    navItems.find((item) => pathname === item.href) ??
    [...navItems].sort((a, b) => b.href.length - a.href.length).find((item) => pathname.startsWith(item.href));

  const groups: { group: string | undefined; items: QosNavItem[] }[] = [];
  for (const item of navItems) {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) {
      last.items.push(item);
    } else {
      groups.push({ group: item.group, items: [item] });
    }
  }

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={styles.qosRoot} id="qos-root">
      {mobileOpen && <div className={styles.sbScrim} onClick={() => setMobileOpen(false)} />}
      <div className={styles.app}>
        <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
          <div className={styles.sbBrand}>
            <img src="/favicon-logo.png" alt="Q Labs" className={styles.qMark} style={{ objectFit: "cover" }} />
            <div>
              <div className={styles.name}>
                Q<span style={{ opacity: 0.5, fontWeight: 400 }}> ·</span> OS
              </div>
              <div className={styles.sub}>Centro de Mando</div>
            </div>
          </div>

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
            <div className={styles.sbUser}>
              <div className={styles.av}>{initials || "Q"}</div>
              <div style={{ minWidth: 0 }}>
                <div className={styles.uName}>{userName}</div>
                <div className={styles.uRole}>{userRole}</div>
              </div>
            </div>
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
                <span>Operación</span>
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
