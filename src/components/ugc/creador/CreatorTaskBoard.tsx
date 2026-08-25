"use client";

import { useEffect, useRef, useState } from "react";
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
import { PLATFORM_LABEL, dueLabel, daysUntil, fechaCortaDeDia } from "@/lib/ugc/creator-task";
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
  const [visible, setVisible] = useState(0);
  const carril = useRef<HTMLDivElement>(null);

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

  // Qué columna se está mirando, para el chip activo y los puntitos. Se lee del
  // scroll y no de un índice propio: el dedo puede dejar el carril a mitad de
  // camino y ahí gana lo que se ve, no lo último que se tocó.
  useEffect(() => {
    const el = carril.current;
    if (!el) return;
    let pedido = 0;
    const alScrollear = () => {
      cancelAnimationFrame(pedido);
      pedido = requestAnimationFrame(() => {
        const ancho = el.clientWidth || 1;
        setVisible(Math.round(el.scrollLeft / ancho));
      });
    };
    el.addEventListener("scroll", alScrollear, { passive: true });
    return () => {
      cancelAnimationFrame(pedido);
      el.removeEventListener("scroll", alScrollear);
    };
  }, []);

  function irA(indice: number) {
    const el = carril.current;
    if (!el) return;
    el.scrollTo({ left: indice * el.clientWidth, behavior: "smooth" });
  }

  function mover(id: string, nuevaColumna: string) {
    // Optimista: la tarjeta se mueve ya y el server action va detrás. Si
    // fallara, el revalidate devuelve el estado real.
    setLocales((prev) => prev.map((t) => (t.id === id ? { ...t, column_id: nuevaColumna } : t)));
    const fd = new FormData();
    fd.set("id", id);
    fd.set("column_id", nuevaColumna);
    void moveCreatorTaskAction(fd);
  }

  function alSoltar(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const id = String(active.id);
    const nuevaColumna = String(over.id);
    const tarea = locales.find((t) => t.id === id);
    if (!tarea || tarea.column_id === nuevaColumna) return;
    mover(id, nuevaColumna);
  }

  const contarEn = (columnId: string) => locales.filter((t) => t.column_id === columnId).length;

  return (
    <div className={styles.pipeWrap}>
      <div className={styles.pipeHead}>
        <h1 className={styles.pipeTitulo}>Mi pipeline</h1>
        <button
          type="button"
          onClick={() => setCreandoEn(columns[visible]?.id ?? columns[0]?.id ?? null)}
          className={styles.pipeNueva}
        >
          <QosIcon name="plus" size={15} />
          Nueva tarea
        </button>
      </div>

      {/* Los chips no filtran: saltan. Con cuatro columnas en un teléfono, lo
          que hace falta es llegar a la de al lado sin cuatro deslizadas. */}
      <div className={styles.pipeChips}>
        {columns.map((col, i) => (
          <button
            key={col.id}
            type="button"
            onClick={() => irA(i)}
            className={`${styles.pipeChip} ${i === visible ? styles.pipeChipOn : ""}`}
          >
            <span className={styles.pipeChipDot} style={{ background: col.color }} aria-hidden />
            {col.name}
            <span className={styles.pipeChipNum}>{contarEn(col.id)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setColumnaModal("nueva")}
          className={`${styles.pipeChip} ${styles.pipeChipMas}`}
          aria-label="Nueva columna"
          title="Nueva columna"
        >
          <QosIcon name="columns" size={14} />
          <QosIcon name="plus" size={11} />
        </button>
      </div>

      {/* id explícito: sin él @dnd-kit genera ids internos que pueden
          desincronizarse entre servidor y cliente y romper la hidratación
          (ya pasó en el Kanban del admin). */}
      <DndContext id="creator-task-board" sensors={sensors} onDragEnd={alSoltar}>
        <div ref={carril} className={`${styles.kanban} ${styles.pipeCarril}`}>
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

      {/* Los puntitos solo existen en el teléfono, que es donde el carril se
          desliza de a una columna. En escritorio se ven todas juntas. */}
      {columns.length > 1 && (
        <div className={styles.pipePuntos} aria-hidden>
          {columns.map((col, i) => (
            <span
              key={col.id}
              className={`${styles.pipePunto} ${i === visible ? styles.pipePuntoOn : ""}`}
            />
          ))}
        </div>
      )}

      {(creandoEn || editando) && (
        <CreatorTaskModal
          task={editando}
          columns={columns}
          defaultColumnId={creandoEn ?? columns[0]?.id ?? ""}
          onMove={mover}
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
        <span className={styles.kcCount} style={{ marginLeft: "auto" }}>
          {tasks.length}
        </span>
        <button
          type="button"
          onClick={() => onEditColumn(column)}
          className={styles.kcAdd}
          title={`Editar columna ${column.name}`}
          aria-label={`Editar columna ${column.name}`}
        >
          <QosIcon name="dots" size={13} />
        </button>
      </div>
      <div className={styles.kcolBody}>
        {tasks.map((task) => (
          <Tarjeta key={task.id} task={task} isDone={column.is_done} onSelect={onSelect} />
        ))}
        {/* Agregar vive al pie de la columna y no en su encabezado: es donde
            queda el dedo después de leer lo que ya hay. */}
        <button type="button" className={styles.pipeAgregar} onClick={() => onAdd(column.id)}>
          <QosIcon name="plus" size={14} />
          Agregar tarea
        </button>
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

      <div className={styles.pipeCardPie}>
        {task.platform && <span className={styles.tag}>{PLATFORM_LABEL[task.platform]}</span>}
        {/* "Sin fecha" se dice, no se omite: en un tablero de producción el
            hueco se lee como "no cargó" y manda a abrir la tarjeta. */}
        <span className={`${styles.pipeCardFecha} ${atrasada ? styles.kcDueLate : ""}`}>
          {!task.due_date
            ? "Sin fecha"
            : atrasada
              ? dueLabel(task.due_date)
              : fechaCortaDeDia(task.due_date)}
        </span>
        {task.notes && (
          <span className={styles.pipeCardNota} title="Tiene notas" aria-label="Tiene notas">
            <QosIcon name="doc" size={13} />
          </span>
        )}
      </div>
    </div>
  );
}
