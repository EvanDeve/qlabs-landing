"use client";

import { useActionState, useState } from "react";
import {
  createColumnAction,
  updateColumnAction,
  deleteColumnAction,
  type ColumnState,
} from "@/lib/actions/creator-tasks";
import { COLORES_COLUMNA } from "@/lib/ugc/creator-task";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import type { TaskColumn } from "./CreatorTaskBoard";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function ColumnModal({
  column,
  totalColumns,
  taskCount,
  isOnlyDoneColumn,
  onClose,
}: {
  column: TaskColumn | null;
  totalColumns: number;
  /** Cuántas tarjetas tiene, para avisar a dónde se van si se borra. */
  taskCount: number;
  /** Es la única columna de "terminado": no se puede soltar. */
  isOnlyDoneColumn: boolean;
  onClose: () => void;
}) {
  const editando = Boolean(column);
  const [state, formAction, pending] = useActionState<ColumnState, FormData>(
    editando ? updateColumnAction : createColumnAction,
    null
  );
  const [color, setColor] = useState(column?.color ?? COLORES_COLUMNA[1]);

  // Dos razones para no poder borrar: que sea la última del tablero, o que sea
  // la única que significa "terminado" (las tareas ya hechas volverían a contar
  // como pendientes y atrasadas en el Resumen).
  const puedeBorrar = editando && totalColumns > 1 && !isOnlyDoneColumn;

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
          <h2 style={{ fontSize: "18px" }}>{editando ? "Editar columna" : "Nueva columna"}</h2>
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
          {column && <input type="hidden" name="id" value={column.id} />}
          <input type="hidden" name="color" value={color} />

          <div className={styles.field}>
            <label>Nombre</label>
            <input
              name="name"
              required
              autoFocus
              defaultValue={column?.name ?? ""}
              placeholder="Por grabar"
              className={styles.inp}
            />
          </div>

          <div className={styles.field}>
            <label>Color</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {COLORES_COLUMNA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={styles.kcAdd}
                  style={{
                    width: "28px",
                    height: "28px",
                    background: c,
                    borderColor: color === c ? "var(--ink)" : "transparent",
                    borderWidth: color === c ? "2px" : "1px",
                  }}
                />
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                name="is_done"
                defaultChecked={column?.is_done ?? false}
                disabled={isOnlyDoneColumn}
              />
              Las tareas acá están terminadas
            </label>
            <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
              Lo que caiga en esta columna deja de contar como pendiente y no se marca atrasado
              aunque se pase la fecha.
              {isOnlyDoneColumn && (
                <>
                  {" "}
                  <b>Es la única columna así, por eso no se puede desmarcar ni borrar.</b>
                </>
              )}
            </p>
            {/* Un checkbox deshabilitado no viaja en el formulario: sin esto,
                guardar cualquier otro campo apagaría la bandera sin querer. */}
            {isOnlyDoneColumn && <input type="hidden" name="is_done" value="on" />}
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
            {puedeBorrar && (
              <ConfirmDeleteButton
                action={async () => {
                  const fd = new FormData();
                  fd.set("id", column!.id);
                  await deleteColumnAction(fd);
                  onClose();
                }}
                confirmMessage={
                  taskCount > 0
                    ? `Se borra "${column!.name}". Sus ${taskCount} ${taskCount === 1 ? "tarea pasa" : "tareas pasan"} a la columna de al lado, no se ${taskCount === 1 ? "pierde" : "pierden"}.`
                    : `Se borra la columna "${column!.name}".`
                }
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
              {pending ? "Guardando..." : editando ? "Guardar" : "Crear columna"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
