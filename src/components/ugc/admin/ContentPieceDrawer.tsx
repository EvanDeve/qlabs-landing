"use client";

import { useState, useTransition } from "react";
import type { Database } from "@/lib/database.types";
import { updateContentPieceAction, updateContentPieceStageAction, deleteContentPieceAction } from "@/lib/actions/content-pieces";
import { CONTENT_STAGE_LABEL, CONTENT_STAGE_SOP, nextContentStage } from "@/lib/ugc/content-stage";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import type { StaffOption } from "./KanbanBoard";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type ContentPiece = Database["public"]["Tables"]["content_pieces"]["Row"];

export default function ContentPieceDrawer({
  piece,
  brandName,
  staff,
  onClose,
  onDeleted,
}: {
  piece: ContentPiece;
  brandName: string;
  staff: StaffOption[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [stage, setStage] = useState(piece.stage);
  const [isPending, startTransition] = useTransition();
  const sop = CONTENT_STAGE_SOP[stage];
  const upcoming = nextContentStage(stage);

  function handleAdvance() {
    if (!upcoming) return;
    startTransition(async () => {
      await updateContentPieceStageAction(piece.id, upcoming);
      setStage(upcoming);
    });
  }

  async function handleDelete() {
    await deleteContentPieceAction(piece.id);
    onDeleted();
  }

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHd}>
          <div>
            <span className={styles.sopTag}>{piece.code}</span>
            <h2 style={{ fontSize: "18px", marginTop: "6px" }}>{piece.title}</h2>
            <p style={{ fontSize: "13px", color: "var(--ink-2)" }}>{brandName}</p>
          </div>
          <button type="button" onClick={onClose} className={styles.drawerClose}>
            <QosIcon name="x" size={16} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <span className={styles.sopTag}>{CONTENT_STAGE_LABEL[stage]}</span>
              {upcoming && (
                <button
                  type="button"
                  onClick={handleAdvance}
                  disabled={isPending}
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                >
                  Avanzar a {CONTENT_STAGE_LABEL[upcoming]} <QosIcon name="chevR" size={13} />
                </button>
              )}
            </div>
            {sop.sopCode && (
              <p style={{ marginTop: "8px", fontSize: "11.5px", color: "var(--ink-3)" }}>
                {sop.sopCode} · Responsable: {sop.ownerRole}
              </p>
            )}
          </div>

          <form action={updateContentPieceAction}>
            <input type="hidden" name="id" value={piece.id} />

            <div className={styles.field}>
              <label>Responsable</label>
              <select name="owner_id" defaultValue={piece.owner_id ?? ""} className={styles.inp}>
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
                <label>Prioridad</label>
                <select name="priority" defaultValue={piece.priority} className={styles.inp}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label>Plataforma</label>
                <select name="platform" defaultValue={piece.platform} className={styles.inp}>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="reels">Reels</option>
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label>Aprobación</label>
              <select name="approval" defaultValue={piece.approval} className={styles.inp}>
                <option value="pendiente">Pendiente</option>
                <option value="correccion">Corrección</option>
                <option value="revisado">Revisado</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label>Grabación</label>
                <input type="date" name="record_date" defaultValue={piece.record_date?.slice(0, 10) ?? ""} className={styles.inp} />
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label>Publicación</label>
                <input type="date" name="publish_date" defaultValue={piece.publish_date?.slice(0, 10) ?? ""} className={styles.inp} />
              </div>
            </div>

            <div className={styles.field}>
              <label>Link Drive</label>
              <input name="drive_url" defaultValue={piece.drive_url ?? ""} className={styles.inp} />
            </div>

            <div className={styles.field}>
              <label>Link guion</label>
              <input name="script_url" defaultValue={piece.script_url ?? ""} className={styles.inp} />
            </div>

            <div className={styles.field}>
              <label>Link video final</label>
              <input name="final_url" defaultValue={piece.final_url ?? ""} className={styles.inp} />
            </div>

            <div className={styles.field}>
              <label>Apuntes</label>
              <textarea name="notes" rows={3} defaultValue={piece.notes ?? ""} className={styles.inp} />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                Guardar
              </button>
              <ConfirmDeleteButton
                action={handleDelete}
                confirmMessage={`¿Borrar la pieza "${piece.title}"? No se puede deshacer.`}
                className={`${styles.btn} ${styles.btnDanger}`}
              >
                Borrar pieza
              </ConfirmDeleteButton>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}
