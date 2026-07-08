"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import type { CalendarItem } from "@/lib/ugc/calendar";
import { CALENDAR_EVENT_TYPE_LABEL, COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { createCalendarEventAction, updateCalendarEventAction, deleteCalendarEventAction } from "@/lib/actions/calendar-events";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type Option = { id: string; name: string };

export default function CalendarEventModal({
  item,
  defaultDate,
  brands,
  staff,
  onClose,
}: {
  item?: CalendarItem;
  defaultDate?: string;
  brands: Option[];
  staff: Option[];
  onClose: () => void;
}) {
  const isDerived = Boolean(item?.contentPieceId);
  const defaultStartsAt = item
    ? formatInTimeZone(new Date(item.date), COSTA_RICA_TZ, "yyyy-MM-dd'T'HH:mm")
    : `${defaultDate}T09:00`;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "18px" }}>
            {item ? (isDerived ? CALENDAR_EVENT_TYPE_LABEL[item.type] : "Editar evento") : "Nuevo evento"}
          </h2>
          <button type="button" onClick={onClose} className={styles.drawerClose}>
            <QosIcon name="x" size={16} />
          </button>
        </div>

        {isDerived && item ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <p style={{ fontSize: "13px", color: "var(--ink-2)" }}>
              {item.title} {item.brandName && `· ${item.brandName}`}
            </p>
            <p style={{ fontSize: "12px", color: "var(--ink-3)" }}>
              Este evento se generó automáticamente desde una pieza de contenido. Para cambiar la fecha,
              editala desde el Pipeline.
            </p>
            {item.brandId && (
              <Link href={`/ugc/admin/heroes/${item.brandId}`} className={`${styles.btn} ${styles.btnPrimary}`} style={{ alignSelf: "flex-start" }}>
                Ver Hero
              </Link>
            )}
          </div>
        ) : (
          <form action={item ? updateCalendarEventAction : createCalendarEventAction} onSubmit={onClose}>
            {item && <input type="hidden" name="id" value={item.id} />}

            <div className={styles.field}>
              <label>Tipo</label>
              <select name="type" defaultValue={item?.type ?? "reunion"} className={styles.inp}>
                <option value="reunion">Reunión</option>
                <option value="entrega">Entrega</option>
                <option value="grabacion">Grabación</option>
                <option value="publicacion">Publicación</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Título</label>
              <input name="title" required defaultValue={item?.title ?? ""} className={styles.inp} />
            </div>

            <div className={styles.field}>
              <label>Fecha y hora</label>
              <input type="datetime-local" name="starts_at" required defaultValue={defaultStartsAt} className={styles.inp} />
            </div>

            <div className={styles.field}>
              <label>Hero (opcional)</label>
              <select name="brand_id" defaultValue={item?.brandId ?? ""} className={styles.inp}>
                <option value="">Sin Hero</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Responsable (opcional)</label>
              <select name="responsible_id" defaultValue="" className={styles.inp}>
                <option value="">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {item && (
              <div className={styles.field}>
                <label>Estado</label>
                <select name="status" defaultValue="programado" className={styles.inp}>
                  <option value="programado">Programado</option>
                  <option value="hecho">Hecho</option>
                  <option value="pausado">Pausado</option>
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                {item ? "Guardar" : "Crear evento"}
              </button>
              {item && (
                <ConfirmDeleteButton
                  action={async () => {
                    await deleteCalendarEventAction(item.id);
                    onClose();
                  }}
                  confirmMessage={`¿Borrar el evento "${item.title}"? No se puede deshacer.`}
                  className={`${styles.btn} ${styles.btnGhost}`}
                >
                  Borrar evento
                </ConfirmDeleteButton>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
