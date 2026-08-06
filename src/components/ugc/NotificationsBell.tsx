"use client";

import { useState } from "react";
import Link from "next/link";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/lib/actions/notifications";
import type { Database } from "@/lib/database.types";

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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg transition hover:border-ink"
      >
        <i className="fa-solid fa-bell" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-coral px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="absolute right-0 z-30 mt-2 w-80 rounded-card border border-line bg-white p-2 shadow-lg">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-bold text-ink-soft">Notificaciones</span>
              {unreadCount > 0 && (
                <form action={markAllNotificationsReadAction}>
                  <button type="submit" className="text-xs font-bold text-violet hover:underline">
                    Marcar todas como leídas
                  </button>
                </form>
              )}
            </div>

            {notifications.length > 0 ? (
              <div className="mt-1 flex max-h-80 flex-col gap-1 overflow-y-auto">
                {notifications.map((notification) => {
                  const { text, href } = describe(notification);
                  return (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-2 rounded-lg p-2 text-sm ${
                        notification.read ? "text-ink-soft" : "bg-lavender text-ink"
                      }`}
                    >
                      <Link href={href} onClick={() => setOpen(false)} className="flex-1 hover:underline">
                        {text}
                      </Link>
                      {!notification.read && (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="notification_id" value={notification.id} />
                          <button
                            type="submit"
                            aria-label="Marcar como leída"
                            className="text-xs text-ink-soft hover:text-ink"
                          >
                            <i className="fa-solid fa-check" aria-hidden />
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-2 py-4 text-center text-sm text-ink-soft">
                Sin notificaciones todavía.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
