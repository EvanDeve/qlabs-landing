"use client";

import { useActionState, useState } from "react";
import {
  createColumnAction,
  updateColumnAction,
  deleteColumnAction,
  type ColumnState,
} from "@/lib/actions/creator-tasks";
import { COLORES_COLUMNA } from "@/lib/ugc/creator-task";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import Hoja from "./Hoja";
import type { TaskColumn } from "./CreatorTaskBoard";
import styles from "@/styles/qos.module.css";

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
    <Hoja
      titulo={editando ? "Editar columna" : "Nueva columna"}
      onClose={() => !pending && onClose()}
      pie={
        // Va fuera del <form> con `form=`: así el botón queda fijo al pie de la
        // hoja y no se va con el scroll del contenido.
        <button
          type="submit"
          form="form-columna"
          disabled={pending}
          className={styles.entEnviar}
          style={{ marginTop: 0 }}
        >
          {pending ? "Guardando…" : editando ? "Guardar cambios" : "Crear columna"}
        </button>
      }
    >
      <form
        id="form-columna"
        action={async (fd) => {
          await formAction(fd);
          onClose();
        }}
      >
        {column && <input type="hidden" name="id" value={column.id} />}
        <input type="hidden" name="color" value={color} />

        <label className={styles.hojaCampo}>
          <span className={styles.hojaCampoLabel}>Nombre</span>
          <input
            name="name"
            required
            autoFocus
            defaultValue={column?.name ?? ""}
            placeholder="Por grabar"
            className={styles.hojaCampoInput}
          />
        </label>

        <p className={styles.hojaGrupoLabel}>Color de la etiqueta</p>
        <div className={styles.colorFila}>
          {COLORES_COLUMNA.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchOn : ""}`}
              style={{ background: c }}
            />
          ))}
        </div>

        <div className={styles.hojaBloque}>
          <label className={styles.switchFila}>
            <span className={styles.switchTexto}>Las tareas acá están terminadas</span>
            <input
              type="checkbox"
              name="is_done"
              defaultChecked={column?.is_done ?? false}
              disabled={isOnlyDoneColumn}
              className={styles.switchInput}
            />
            <span className={styles.switchPista} aria-hidden />
          </label>
          <p className={styles.hojaAyuda}>
            Lo que caiga acá deja de contar como pendiente y no se marca atrasado aunque se pase la
            fecha.
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

        {state?.error && <p className={styles.entError}>{state.error}</p>}

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
            className={styles.hojaBorrar}
          >
            Eliminar columna
          </ConfirmDeleteButton>
        )}
      </form>
    </Hoja>
  );
}
