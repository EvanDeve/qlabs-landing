"use client";

import { useActionState, useState } from "react";
import {
  createCreatorTaskAction,
  updateCreatorTaskAction,
  deleteCreatorTaskAction,
  type CreatorTaskState,
} from "@/lib/actions/creator-tasks";
import { PLATFORMS, PLATFORM_LABEL, fechaCortaDeDia } from "@/lib/ugc/creator-task";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import Hoja from "./Hoja";
import type { CreatorTask, TaskColumn } from "./CreatorTaskBoard";
import styles from "@/styles/qos.module.css";

// Una sola hoja para crear y para editar: los campos son los mismos y tener dos
// componentes casi idénticos garantiza que se desincronicen.
export default function CreatorTaskModal({
  task,
  columns,
  defaultColumnId,
  onMove,
  onClose,
  onDeleted,
}: {
  task: CreatorTask | null;
  columns: TaskColumn[];
  /** Columna desde la que se abrió la hoja. Solo aplica al crear. */
  defaultColumnId: string;
  /** Mover a otra columna sin arrastrar. Solo al editar. */
  onMove?: (id: string, columnId: string) => void;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const editando = Boolean(task);
  const [state, formAction, pending] = useActionState<CreatorTaskState, FormData>(
    editando ? updateCreatorTaskAction : createCreatorTaskAction,
    null
  );
  // La plataforma vive en estado porque son chips y no un select: el valor lo
  // lleva un input escondido.
  const [plataforma, setPlataforma] = useState<string>(task?.platform ?? "");

  return (
    <Hoja
      titulo={editando ? task!.title : "Nueva tarea"}
      bajada={
        editando
          ? `Creada el ${fechaCortaDeDia(task!.created_at.slice(0, 10))} · tarea propia`
          : null
      }
      onClose={() => !pending && onClose()}
      pie={
        <div className={styles.hojaPieAcciones}>
          {editando && (
            <ConfirmDeleteButton
              action={async () => {
                const fd = new FormData();
                fd.set("id", task!.id);
                await deleteCreatorTaskAction(fd);
                onDeleted(task!.id);
              }}
              confirmMessage={`Se borra "${task!.title}". No se puede deshacer.`}
              className={styles.hojaBorrarChico}
            >
              Eliminar
            </ConfirmDeleteButton>
          )}
          <button
            type="submit"
            form="form-tarea"
            disabled={pending}
            className={styles.entEnviar}
            style={{ marginTop: 0 }}
          >
            {pending ? "Guardando…" : editando ? "Guardar cambios" : "Crear tarea"}
          </button>
        </div>
      }
    >
      <form
        id="form-tarea"
        action={async (fd) => {
          await formAction(fd);
          onClose();
        }}
      >
        {task && <input type="hidden" name="id" value={task.id} />}
        <input type="hidden" name="platform" value={plataforma} />

        {/* Al editar el título ya está arriba, en el encabezado de la hoja,
            pero el campo se queda: es el dato que más se corrige. */}
        <label className={styles.hojaCampo}>
          <span className={styles.hojaCampoLabel}>Título</span>
          <input
            name="title"
            required
            autoFocus={!editando}
            defaultValue={task?.title ?? ""}
            placeholder="Reel de la receta nueva"
            className={styles.hojaCampoInput}
          />
        </label>

        <div className={styles.hojaTabla}>
          <label className={styles.hojaFila}>
            <span className={styles.hojaFilaLabel}>Columna</span>
            <select
              name="column_id"
              defaultValue={task?.column_id ?? defaultColumnId}
              className={styles.hojaFilaSelect}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.hojaFila}>
            <span className={styles.hojaFilaLabel}>Para cuándo</span>
            <input
              name="due_date"
              type="date"
              defaultValue={task?.due_date ?? ""}
              className={styles.hojaFilaSelect}
            />
          </label>
        </div>

        <p className={styles.hojaGrupoLabel}>Plataforma</p>
        <div className={styles.platChips}>
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={plataforma === p}
              // Volver a tocar el chip elegido lo apaga: sin eso no hay forma de
              // dejar una tarea sin plataforma después de haberle puesto una.
              onClick={() => setPlataforma((prev) => (prev === p ? "" : p))}
              className={`${styles.platChip} ${plataforma === p ? styles.platChipOn : ""}`}
            >
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>

        <label className={styles.hojaCampo}>
          <span className={styles.hojaCampoLabel}>Notas</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={task?.notes ?? ""}
            placeholder="Locación, props, la idea del guion…"
            className={styles.hojaCampoInput}
            style={{ resize: "vertical" }}
          />
        </label>

        {/* Mover sin arrastrar. En un teléfono llevar una tarjeta de la primera
            columna a la cuarta con el dedo es imposible: hay que sostener el
            arrastre mientras el carril se desliza solo. Un toque lo resuelve, y
            el select de arriba sigue existiendo para quien ya está editando
            otra cosa. */}
        {task && onMove && columns.length > 1 && (
          <>
            <p className={styles.hojaGrupoLabel}>Mover a</p>
            <div className={styles.moverChips}>
              {columns
                .filter((c) => c.id !== task.column_id)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.moverChip}
                    onClick={() => {
                      onMove(task.id, c.id);
                      onClose();
                    }}
                  >
                    <span
                      className={styles.pipeChipDot}
                      style={{ background: c.color }}
                      aria-hidden
                    />
                    {c.name}
                  </button>
                ))}
            </div>
          </>
        )}

        {state?.error && <p className={styles.entError}>{state.error}</p>}
      </form>
    </Hoja>
  );
}
