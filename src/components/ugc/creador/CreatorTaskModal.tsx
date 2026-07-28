"use client";

import { useActionState } from "react";
import {
  createCreatorTaskAction,
  updateCreatorTaskAction,
  deleteCreatorTaskAction,
  type CreatorTaskState,
} from "@/lib/actions/creator-tasks";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/ugc/creator-task";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import type { CreatorTask, TaskColumn } from "./CreatorTaskBoard";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

// Un solo modal para crear y para editar: los campos son los mismos y tener dos
// componentes casi idénticos garantiza que se desincronicen.
export default function CreatorTaskModal({
  task,
  columns,
  defaultColumnId,
  onClose,
  onDeleted,
}: {
  task: CreatorTask | null;
  columns: TaskColumn[];
  /** Columna desde la que se abrió el modal. Solo aplica al crear. */
  defaultColumnId: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const editando = Boolean(task);
  const [state, formAction, pending] = useActionState<CreatorTaskState, FormData>(
    editando ? updateCreatorTaskAction : createCreatorTaskAction,
    null
  );

  return (
    <div className={styles.modalOverlay} onClick={() => !pending && onClose()}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "18px",
          }}
        >
          <h2 style={{ fontSize: "18px" }}>{editando ? "Editar tarea" : "Nueva tarea"}</h2>
          <button type="button" onClick={onClose} className={styles.drawerClose}>
            <QosIcon name="x" size={16} />
          </button>
        </div>

        <form
          action={async (fd) => {
            await formAction(fd);
            onClose();
          }}
        >
          {task && <input type="hidden" name="id" value={task.id} />}

          <div className={styles.field}>
            <label>Título</label>
            <input
              name="title"
              required
              autoFocus
              defaultValue={task?.title ?? ""}
              placeholder="Reel de la receta nueva"
              className={styles.inp}
            />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className={styles.field} style={{ flex: 1, minWidth: 0 }}>
              <label>Columna</label>
              <select
                name="column_id"
                defaultValue={task?.column_id ?? defaultColumnId}
                className={styles.inp}
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field} style={{ flex: 1, minWidth: 0 }}>
              <label>Plataforma</label>
              <select name="platform" defaultValue={task?.platform ?? ""} className={styles.inp}>
                <option value="">Sin definir</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Para cuándo (opcional)</label>
            <input
              name="due_date"
              type="date"
              defaultValue={task?.due_date ?? ""}
              className={styles.inp}
            />
          </div>

          <div className={styles.field}>
            <label>Notas (opcional)</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={task?.notes ?? ""}
              placeholder="Locación, props, la idea del guion..."
              className={styles.inp}
              style={{ resize: "vertical" }}
            />
          </div>

          {state?.error && (
            <p style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px" }}>
              {state.error}
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
              alignItems: "center",
              marginTop: "4px",
            }}
          >
            {task && (
              <ConfirmDeleteButton
                action={async () => {
                  const fd = new FormData();
                  fd.set("id", task.id);
                  await deleteCreatorTaskAction(fd);
                  onDeleted(task.id);
                }}
                confirmMessage={`Se borra "${task.title}". No se puede deshacer.`}
                className={`${styles.btn} ${styles.btnDanger}`}
                style={{ marginRight: "auto" }}
              >
                Eliminar
              </ConfirmDeleteButton>
            )}

            <button type="button" onClick={onClose} className={`${styles.btn} ${styles.btnGhost}`}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
              {pending ? "Guardando..." : editando ? "Guardar" : "Crear tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
