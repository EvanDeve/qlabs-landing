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
        🔔
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
                            ✓
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
