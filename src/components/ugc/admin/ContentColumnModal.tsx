"use client";

import { useActionState, useState } from "react";
import {
  createContentColumnAction,
  updateContentColumnAction,
  deleteContentColumnAction,
  type ColumnState,
} from "@/lib/actions/content-columns";
import { COLORES_COLUMNA, type ContentColumn } from "@/lib/ugc/content-columns";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function ContentColumnModal({
  column,
  totalColumns,
  pieceCount,
  isOnlyDoneColumn,
  onClose,
}: {
  column: ContentColumn | null;
  totalColumns: number;
  /** Cuántas piezas tiene, para avisar a dónde se van si se borra. */
  pieceCount: number;
  /** Es la única columna marcada como "publicadas": no se puede soltar. */
  isOnlyDoneColumn: boolean;
  onClose: () => void;
}) {
  const editando = Boolean(column);
  const [state, formAction, pending] = useActionState<ColumnState, FormData>(
    editando ? updateContentColumnAction : createContentColumnAction,
    null
  );
  const [color, setColor] = useState(column?.color ?? COLORES_COLUMNA[1]);

  // Dos razones para no poder borrar: que sea la última del tablero (no habría
  // desde dónde crear otra), o que sea la única que significa "publicado" (el
  // Pase de servicio se quedaría sin nada que contar).
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
              placeholder="Rev. Cliente"
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

          <div style={{ display: "flex", gap: "12px" }}>
            <div className={styles.field} style={{ flex: 1, minWidth: 0 }}>
              <label>Código SOP (opcional)</label>
              <input
                name="sop_code"
                defaultValue={column?.sop_code ?? ""}
                placeholder="SOP-002"
                className={styles.inp}
              />
            </div>
            <div className={styles.field} style={{ flex: 1, minWidth: 0 }}>
              <label>Responsable (opcional)</label>
              <input
                name="owner_role"
                defaultValue={column?.owner_role ?? ""}
                placeholder="Editor"
                className={styles.inp}
              />
            </div>
          </div>

          {/* Estas dos banderas son las que mantienen vivos los cálculos del
              módulo. Sin ellas, renombrar una columna descuadraría el Pase de
              servicio en silencio. */}
          <div
            className={styles.field}
            style={{
              background: "var(--b-50)",
              border: "1px solid var(--b-100)",
              borderRadius: "var(--r-sm)",
              padding: "12px",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                name="is_done"
                defaultChecked={column?.is_done ?? false}
                disabled={isOnlyDoneColumn}
              />
              Las piezas acá están publicadas
            </label>
            <p style={{ fontSize: "12.5px", color: "var(--ink-2)", margin: "4px 0 12px" }}>
              De acá salen los &ldquo;Publicados&rdquo; del mes: meta, ritmo y riesgo de cada Hero.
              {isOnlyDoneColumn && (
                <>
                  {" "}
                  <b>
                    Es la única columna marcada así, por eso no se puede desmarcar ni borrar. Marcá
                    otra primero.
                  </b>
                </>
              )}
            </p>
            {/* El checkbox deshabilitado no viaja en el formulario, y sin esto
                guardar cualquier otro campo apagaría la bandera sin querer. */}
            {isOnlyDoneColumn && <input type="hidden" name="is_done" value="on" />}

            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                name="is_pending_approval"
                defaultChecked={column?.is_pending_approval ?? false}
              />
              Acá se está esperando una aprobación
            </label>
            <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
              Alimenta el KPI &ldquo;Pend. aprobación&rdquo; y la lista de &ldquo;Requiere tu
              atención&rdquo;.
            </p>
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
                  await deleteContentColumnAction(fd);
                  onClose();
                }}
                confirmMessage={
                  pieceCount > 0
                    ? `Se borra "${column!.name}". Sus ${pieceCount} ${pieceCount === 1 ? "pieza pasa" : "piezas pasan"} a la columna de al lado, no se ${pieceCount === 1 ? "pierde" : "pierden"}.`
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
