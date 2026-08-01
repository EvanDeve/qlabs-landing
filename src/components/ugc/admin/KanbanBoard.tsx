"use client";

import { useMemo, useState } from "react";
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
import { updateContentPieceColumnAction } from "@/lib/actions/content-pieces";
import type { ContentColumn } from "@/lib/ugc/content-columns";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { diaCR, diaCorto } from "@/lib/ugc/calendar";
import ContentPieceDrawer from "./ContentPieceDrawer";
import NewContentPieceModal from "./NewContentPieceModal";
import ContentColumnModal from "./ContentColumnModal";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type ContentPiece = Database["public"]["Tables"]["content_pieces"]["Row"];
export type BrandOption = { id: string; name: string };
export type StaffOption = { id: string; name: string; role: string; color: string };

export default function KanbanBoard({
  pieces,
  columns,
  brands,
  staff,
}: {
  pieces: ContentPiece[];
  columns: ContentColumn[];
  brands: BrandOption[];
  staff: StaffOption[];
}) {
  const [localPieces, setLocalPieces] = useState(pieces);
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  // Guarda EN QUÉ columna se está creando, no un booleano: el "+" de cada
  // columna abre el modal ya posicionado ahí.
  const [creatingInColumn, setCreatingInColumn] = useState<string | null>(null);
  // null = cerrado, "nueva" = crear, o la columna que se está editando.
  const [columnModal, setColumnModal] = useState<ContentColumn | "nueva" | null>(null);

  // Resincroniza cuando el server action revalida y llegan props nuevas. Se
  // ajusta durante el render y no con un useEffect: React trata este caso
  // especial —re-renderiza de una sin pintar el estado viejo— mientras que con
  // efecto la lista parpadea con los datos anteriores por un frame.
  const [piecesPrev, setPiecesPrev] = useState(pieces);
  if (piecesPrev !== pieces) {
    setPiecesPrev(pieces);
    setLocalPieces(pieces);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const brandNameById = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const pieceId = String(active.id);
    const newColumnId = String(over.id);
    const piece = localPieces.find((p) => p.id === pieceId);
    if (!piece || piece.column_id === newColumnId) return;

    setLocalPieces((prev) =>
      prev.map((p) => (p.id === pieceId ? { ...p, column_id: newColumnId } : p))
    );
    void updateContentPieceColumnAction(pieceId, newColumnId);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setCreatingInColumn(columns[0]?.id ?? null)}
          disabled={columns.length === 0}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          <QosIcon name="plus" size={16} />
          Nueva pieza
        </button>
        <button
          type="button"
          onClick={() => setColumnModal("nueva")}
          className={`${styles.btn} ${styles.btnGhost}`}
        >
          <QosIcon name="columns" size={16} />
          Nueva columna
        </button>
      </div>

      <DndContext id="kanban-board" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={styles.kanban}>
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              pieces={localPieces.filter((p) => p.column_id === column.id)}
              brandNameById={brandNameById}
              staffById={staffById}
              onSelect={setSelectedPiece}
              onAdd={setCreatingInColumn}
              onEditColumn={setColumnModal}
            />
          ))}
        </div>
      </DndContext>

      {selectedPiece && (
        <ContentPieceDrawer
          piece={selectedPiece}
          columns={columns}
          brandName={brandNameById.get(selectedPiece.brand_id) ?? ""}
          staff={staff}
          onClose={() => setSelectedPiece(null)}
          onDeleted={() => {
            setLocalPieces((prev) => prev.filter((p) => p.id !== selectedPiece.id));
            setSelectedPiece(null);
          }}
        />
      )}

      {creatingInColumn && (
        <NewContentPieceModal
          brands={brands}
          staff={staff}
          columns={columns}
          columnId={creatingInColumn}
          onClose={() => setCreatingInColumn(null)}
        />
      )}

      {columnModal && (
        <ContentColumnModal
          column={columnModal === "nueva" ? null : columnModal}
          totalColumns={columns.length}
          pieceCount={
            columnModal === "nueva"
              ? 0
              : localPieces.filter((p) => p.column_id === columnModal.id).length
          }
          isOnlyDoneColumn={
            columnModal !== "nueva" &&
            columnModal.is_done &&
            columns.filter((c) => c.is_done).length === 1
          }
          onClose={() => setColumnModal(null)}
        />
      )}
    </div>
  );
}

function Column({
  column,
  pieces,
  brandNameById,
  staffById,
  onSelect,
  onAdd,
  onEditColumn,
}: {
  column: ContentColumn;
  pieces: ContentPiece[];
  brandNameById: Map<string, string>;
  staffById: Map<string, StaffOption>;
  onSelect: (piece: ContentPiece) => void;
  onAdd: (columnId: string) => void;
  onEditColumn: (c: ContentColumn) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div ref={setNodeRef} className={`${styles.kcol} ${isOver ? styles.kcolDropHi : ""}`}>
      <div className={styles.kcolHead}>
        <span className={styles.dot} style={{ background: column.color }} />
        <span className={styles.kcName}>{column.name}</span>
        <span className={styles.kcCount}>{pieces.length}</span>
        {column.sop_code && <span className={styles.sopTag}>{column.sop_code}</span>}
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
          title={`Nueva pieza en ${column.name}`}
          aria-label={`Nueva pieza en ${column.name}`}
        >
          <QosIcon name="plus" size={13} />
        </button>
      </div>
      <div className={styles.kcolBody}>
        {pieces.map((piece) => (
          <Card
            key={piece.id}
            piece={piece}
            isDone={column.is_done}
            brandName={brandNameById.get(piece.brand_id) ?? ""}
            owner={piece.owner_id ? staffById.get(piece.owner_id) : undefined}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

const PRIO_CLASS: Record<string, string> = { alta: "prioAlta", media: "prioMedia", baja: "prioBaja" };

function Card({
  piece,
  isDone,
  brandName,
  owner,
  onSelect,
}: {
  piece: ContentPiece;
  isDone: boolean;
  brandName: string;
  owner?: StaffOption;
  onSelect: (piece: ContentPiece) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: piece.id });
  // Una pieza en una columna de "terminado" ya no está atrasada, por más que
  // la fecha de publicación haya pasado.
  //
  // Se compara el DÍA de Costa Rica, no el instante: `new Date(publish_date) <
  // new Date()` marcaba como atrasada una pieza que vencía HOY, porque el día
  // suelto se interpreta como medianoche UTC y eso ya pasó desde las 18:00 del
  // día anterior en CR.
  const isOverdue = piece.publish_date && diaCR(piece.publish_date) < diaCR(new Date()) && !isDone;

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(piece)}
      style={style}
      className={`${styles.kcard} ${isDragging ? styles.kcardDragging : ""}`}
    >
      <div className={styles.kcTop}>
        <span className={styles.kcHero}>
          <span className={styles.dot} style={{ background: "var(--b-500)" }} />
          {brandName}
        </span>
        <span className={styles.kcNum}>{piece.code}</span>
      </div>
      <div className={styles.kcTitle}>{piece.title}</div>
      <div className={styles.kcMid}>
        <span className={`${styles.prio} ${styles[PRIO_CLASS[piece.priority]]}`}>{piece.priority}</span>
        <span className={styles.tag}>{piece.platform}</span>
        {/* Una pieza que nadie cargó a mano tiene que decirlo. Va el origen y
            no el nombre del agente: el nombre se edita desde /ugc/admin/mclovin
            y acá quedaría desactualizado sin que nadie se entere. */}
        {piece.created_by_agent && (
          <span className={styles.tag} title="Se anotó por WhatsApp, no desde el tablero">
            <QosIcon name="chat" size={11} /> WhatsApp
          </span>
        )}
      </div>
      <div className={styles.kcFoot}>
        <span className={`${styles.kcDue} ${isOverdue ? styles.kcDueLate : ""}`}>
          <QosIcon name="clock" size={12} />
          {piece.publish_date ? diaCorto(piece.publish_date) : "—"}
        </span>
        {owner && (
          <span
            className={styles.avSm}
            style={{ background: owner.color, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 }}
            title={owner.name}
          >
            {owner.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
