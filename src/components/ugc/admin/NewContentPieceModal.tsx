"use client";

import { createContentPieceAction } from "@/lib/actions/content-pieces";
import { QosIcon } from "@/lib/ugc/qos-icons";
import type { ContentColumn } from "@/lib/ugc/content-columns";
import type { BrandOption, StaffOption } from "./KanbanBoard";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function NewContentPieceModal({
  brands,
  staff,
  columns,
  columnId,
  onClose,
}: {
  brands: BrandOption[];
  staff: StaffOption[];
  columns: ContentColumn[];
  /** Columna desde la que se abrió el modal: la pieza nace ahí. */
  columnId: string;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "18px" }}>Nueva pieza</h2>
          <button type="button" onClick={onClose} className={styles.drawerClose}>
            <QosIcon name="x" size={16} />
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "-8px", marginBottom: "16px" }}>
          Entra en <b>{columns.find((c) => c.id === columnId)?.name ?? "la primera columna"}</b>.
        </p>

        <form action={createContentPieceAction} onSubmit={onClose}>
          <input type="hidden" name="column_id" value={columnId} />
          <div className={styles.field}>
            <label>Hero</label>
            <select name="brand_id" required className={styles.inp}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Código</label>
            <input name="code" required placeholder="LB-042" className={styles.inp} />
          </div>

          <div className={styles.field}>
            <label>Título</label>
            <input name="title" required className={styles.inp} />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label>Plataforma</label>
              <select name="platform" className={styles.inp}>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="reels">Reels</option>
              </select>
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label>Prioridad</label>
              <select name="priority" defaultValue="media" className={styles.inp}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Responsable</label>
            <select name="owner_id" className={styles.inp}>
              <option value="">Sin asignar</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.role}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label>Grabación</label>
              <input type="date" name="record_date" className={styles.inp} />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label>Publicación</label>
              <input type="date" name="publish_date" className={styles.inp} />
            </div>
          </div>

          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            Crear pieza
          </button>
        </form>
      </div>
    </div>
  );
}
