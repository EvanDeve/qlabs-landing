"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Database } from "@/lib/database.types";
import { moveCreatorTaskAction } from "@/lib/actions/creator-tasks";
import { PLATFORM_LABEL, dueLabel, daysUntil } from "@/lib/ugc/creator-task";
import { QosIcon } from "@/lib/ugc/qos-icons";
import CreatorTaskModal from "./CreatorTaskModal";
import ColumnModal from "./ColumnModal";
import styles from "@/styles/qos.module.css";

export type CreatorTask = Database["public"]["Tables"]["creator_tasks"]["Row"];
export type TaskColumn = Database["public"]["Tables"]["creator_task_columns"]["Row"];

export default function CreatorTaskBoard({
  tasks,
  columns,
}: {
  tasks: CreatorTask[];
  columns: TaskColumn[];
}) {
  const [locales, setLocales] = useState(tasks);
  const [editando, setEditando] = useState<CreatorTask | null>(null);
  // Guarda EN QUÉ columna se está creando, no un booleano: el "+" de cada
  // columna abre el modal ya posicionado ahí.
  const [creandoEn, setCreandoEn] = useState<string | null>(null);
  // null = cerrado, "nueva" = crear, o la columna que se está editando.
  const [columnaModal, setColumnaModal] = useState<TaskColumn | "nueva" | null>(null);

  // Resincroniza cuando el server action revalida y llegan props nuevas.
  // Se ajusta durante el render y no con un useEffect: React trata este caso
  // especial —re-renderiza de una sin pintar el estado viejo— mientras que con
  // efecto la lista parpadea con los datos anteriores por un frame.
  const [tasksPrevias, setTasksPrevias] = useState(tasks);
  if (tasksPrevias !== tasks) {
    setTasksPrevias(tasks);
    setLocales(tasks);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function alSoltar(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const id = String(active.id);
    const nuevaColumna = String(over.id);
    const tarea = locales.find((t) => t.id === id);
    if (!tarea || tarea.column_id === nuevaColumna) return;

    // Optimista: la tarjeta se mueve ya y el server action va detrás. Si
    // fallara, el revalidate devuelve el estado real.
    setLocales((prev) => prev.map((t) => (t.id === id ? { ...t, column_id: nuevaColumna } : t)));

    const fd = new FormData();
    fd.set("id", id);
    fd.set("column_id", nuevaColumna);
    void moveCreatorTaskAction(fd);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setCreandoEn(columns[0]?.id ?? null)}
          disabled={columns.length === 0}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          <QosIcon name="plus" size={16} />
          Nueva tarea
        </button>
        <button
          type="button"
          onClick={() => setColumnaModal("nueva")}
          className={`${styles.btn} ${styles.btnGhost}`}
        >
          <QosIcon name="columns" size={16} />
          Nueva columna
        </button>
      </div>

      {/* id explícito: sin él @dnd-kit genera ids internos que pueden
          desincronizarse entre servidor y cliente y romper la hidratación
          (ya pasó en el Kanban del admin). */}
      <DndContext id="creator-task-board" sensors={sensors} onDragEnd={alSoltar}>
        <div className={styles.kanban}>
          {columns.map((col) => (
            <Columna
              key={col.id}
              column={col}
              tasks={locales.filter((t) => t.column_id === col.id)}
              onSelect={setEditando}
              onAdd={setCreandoEn}
              onEditColumn={setColumnaModal}
            />
          ))}
        </div>
      </DndContext>

      {(creandoEn || editando) && (
        <CreatorTaskModal
          task={editando}
          columns={columns}
          defaultColumnId={creandoEn ?? columns[0]?.id ?? ""}
          onClose={() => {
            setCreandoEn(null);
            setEditando(null);
          }}
          onDeleted={(id) => {
            setLocales((prev) => prev.filter((t) => t.id !== id));
            setEditando(null);
          }}
        />
      )}

      {columnaModal && (
        <ColumnModal
          column={columnaModal === "nueva" ? null : columnaModal}
          totalColumns={columns.length}
          taskCount={
            columnaModal === "nueva"
              ? 0
              : locales.filter((t) => t.column_id === columnaModal.id).length
          }
          isOnlyDoneColumn={
            columnaModal !== "nueva" &&
            columnaModal.is_done &&
            columns.filter((c) => c.is_done).length === 1
          }
          onClose={() => setColumnaModal(null)}
        />
      )}
    </div>
  );
}

function Columna({
  column,
  tasks,
  onSelect,
  onAdd,
  onEditColumn,
}: {
  column: TaskColumn;
  tasks: CreatorTask[];
  onSelect: (t: CreatorTask) => void;
  onAdd: (columnId: string) => void;
  onEditColumn: (c: TaskColumn) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div ref={setNodeRef} className={`${styles.kcol} ${isOver ? styles.kcolDropHi : ""}`}>
      <div className={styles.kcolHead}>
        <span className={styles.dot} style={{ background: column.color }} />
        <span className={styles.kcName}>{column.name}</span>
        <span className={styles.kcCount}>{tasks.length}</span>
        <button
          type="button"
          onClick={() => onEditColumn(column)}
          className={styles.kcAdd}
          style={{ marginLeft: "auto" }}
          title={`Editar columna ${column.name}`}
          aria-label={`Editar columna ${column.name}`}
        >
          <QosIcon name="sparkle" size={12} />
        </button>
        <button
          type="button"
          onClick={() => onAdd(column.id)}
          className={styles.kcAdd}
          style={{ marginLeft: 0 }}
          title={`Nueva tarea en ${column.name}`}
          aria-label={`Nueva tarea en ${column.name}`}
        >
          <QosIcon name="plus" size={13} />
        </button>
      </div>
      <div className={styles.kcolBody}>
        {tasks.map((task) => (
          <Tarjeta key={task.id} task={task} isDone={column.is_done} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function Tarjeta({
  task,
  isDone,
  onSelect,
}: {
  task: CreatorTask;
  isDone: boolean;
  onSelect: (t: CreatorTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });

  // Una tarea en una columna de "terminado" ya no puede estar atrasada, por más
  // que la fecha haya pasado.
  const atrasada = task.due_date && !isDone && daysUntil(task.due_date) < 0;

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(task)}
      style={style}
      className={`${styles.kcard} ${isDragging ? styles.kcardDragging : ""}`}
    >
      <div className={styles.kcTitle} style={{ marginTop: 0 }}>
        {task.title}
      </div>

      {task.platform && (
        <div className={styles.kcMid}>
          <span className={styles.tag}>{PLATFORM_LABEL[task.platform]}</span>
        </div>
      )}

      {task.due_date && (
        <div className={styles.kcFoot}>
          <span className={`${styles.kcDue} ${atrasada ? styles.kcDueLate : ""}`}>
            <QosIcon name="clock" size={12} />
            {dueLabel(task.due_date)}
          </span>
        </div>
      )}
    </div>
  );
}
