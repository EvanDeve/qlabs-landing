"use client";

import { useState } from "react";
import Link from "next/link";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/lib/actions/notifications";
import type { Database } from "@/lib/database.types";
import { QosIcon } from "@/lib/ugc/qos-icons";
// La campana solo se monta dentro de QosShell (admin, marca y creador), así que
// se viste con el sistema de ahí y no con las clases del landing: era el último
// control de la barra superior que seguía siendo un círculo con Font Awesome.
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

const APPLICATION_STATUS_LABEL: Record<string, string> = {
  pending: "pendiente",
  reviewing: "en revisión",
  accepted: "aceptada",
  rejected: "rechazada",
  delivered: "entregada",
  approved: "aprobada",
};

function describe(notification: Notification): { text: string; href: string } {
  const payload = notification.payload as Record<string, unknown>;
  const campaignTitle = String(payload.campaign_title ?? "una campaña");

  if (notification.type === "new_application") {
    return {
      text: `Nueva aplicación a "${campaignTitle}"`,
      href: `/ugc/marca/campanas/${payload.campaign_id}`,
    };
  }

  if (notification.type === "application_status_changed") {
    const status = String(payload.status ?? "");
    return {
      text: `Tu aplicación a "${campaignTitle}" está ${APPLICATION_STATUS_LABEL[status] ?? status}`,
      href: "/ugc/creador/aplicaciones",
    };
  }

  if (notification.type === "application_disputed") {
    return {
      text: `Disputa abierta en "${campaignTitle}"`,
      href: "/ugc/admin/disputas",
    };
  }

  if (notification.type === "contacto_wa_nuevo") {
    const preview = String(payload.preview ?? "").trim();
    return {
      text: `Escribió un número nuevo al WhatsApp${preview ? `: “${preview}”` : ""}`,
      href: "/ugc/admin/mclovin",
    };
  }

  if (notification.type === "verification_pending") {
    const name = String(payload.subject_name ?? "Alguien");
    const roleLabel = payload.subject_role === "brand" ? "marca" : "creador";
    return {
      text: `${name} (${roleLabel}) terminó el registro y está esperando verificación`,
      href: "/ugc/admin/marketplace",
    };
  }

  if (notification.type === "verification_approved") {
    // Solo la puede leer alguien que ya entró: el rechazo no tiene par acá
    // porque una cuenta rechazada nunca llega a ver la campana.
    return {
      text: "Verificamos tu cuenta — ya tenés acceso completo a UGC·CRC",
      href: payload.role === "brand" ? "/ugc/marca" : "/ugc/creador",
    };
  }

  if (notification.type === "application_delivered") {
    return {
      text: `Llegó una entrega en "${campaignTitle}" — revisala y aprobala para seguir con el pago`,
      href: `/ugc/marca/campanas/${payload.campaign_id}`,
    };
  }

  if (notification.type === "level_up") {
    const nivel = String(payload.level_name ?? "un nuevo nivel");
    const emoji = payload.level === 3 ? " 🥇" : payload.level === 4 ? " 💎" : payload.level === 2 ? " 🥈" : "";
    return {
      text: `Subiste a ${nivel}${emoji} — mirá qué cupones se te desbloquearon`,
      href: "/ugc/creador/recompensas",
    };
  }

  if (notification.type === "coupon_expiring") {
    const titulo = String(payload.coupon_title ?? "Tu cupón");
    return {
      text: `"${titulo}" vence en 3 días — usalo antes de que se libere el lugar`,
      href: "/ugc/creador/recompensas",
    };
  }

  if (notification.type === "coupon_redeemed") {
    const titulo = String(payload.coupon_title ?? "un cupón");
    return {
      text: `Nuevo canje en tu local: "${titulo}"`,
      href: "/ugc/marca/loyalty",
    };
  }

  return { text: notification.type, href: "#" };
}

export default function NotificationsBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={styles.bellWrap}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className={`${styles.calNavBtn} ${styles.bellBtn}`}
      >
        <QosIcon name="bell" size={17} />
        {unreadCount > 0 && <span className={styles.bellDot}>{unreadCount}</span>}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 39, cursor: "default" }}
          />
          <div className={styles.bellPanel}>
            <div className={styles.bellPanelHead}>
              <span>Notificaciones</span>
              {unreadCount > 0 && (
                <form action={markAllNotificationsReadAction}>
                  <button type="submit" className={styles.linkMore}>
                    Marcar todas como leídas
                  </button>
                </form>
              )}
            </div>

            {notifications.length > 0 ? (
              <div className={styles.bellList}>
                {notifications.map((notification) => {
                  const { text, href } = describe(notification);
                  return (
                    <div
                      key={notification.id}
                      className={`${styles.bellItem} ${notification.read ? "" : styles.bellItemNew}`}
                    >
                      <Link href={href} onClick={() => setOpen(false)} style={{ flex: 1 }}>
                        {text}
                      </Link>
                      {!notification.read && (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="notification_id" value={notification.id} />
                          <button
                            type="submit"
                            aria-label="Marcar como leída"
                            className={styles.bellItemRead}
                          >
                            <QosIcon name="check" size={13} />
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>Sin notificaciones todavía.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
