"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Database, ContentStage } from "@/lib/database.types";
import { updateContentPieceStageAction } from "@/lib/actions/content-pieces";
import { CONTENT_STAGE_ORDER, CONTENT_STAGE_LABEL, CONTENT_STAGE_COLOR, CONTENT_STAGE_SOP } from "@/lib/ugc/content-stage";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ContentPieceDrawer from "./ContentPieceDrawer";
import NewContentPieceModal from "./NewContentPieceModal";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type ContentPiece = Database["public"]["Tables"]["content_pieces"]["Row"];
export type BrandOption = { id: string; name: string };
export type StaffOption = { id: string; name: string; role: string; color: string };

export default function KanbanBoard({
  pieces,
  brands,
  staff,
}: {
  pieces: ContentPiece[];
  brands: BrandOption[];
  staff: StaffOption[];
}) {
  const [localPieces, setLocalPieces] = useState(pieces);
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => setLocalPieces(pieces), [pieces]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const brandNameById = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const pieceId = String(active.id);
    const newStage = String(over.id) as ContentStage;
    const piece = localPieces.find((p) => p.id === pieceId);
    if (!piece || piece.stage === newStage) return;

    setLocalPieces((prev) => prev.map((p) => (p.id === pieceId ? { ...p, stage: newStage } : p)));
    void updateContentPieceStageAction(pieceId, newStage);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowNewForm(true)}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ marginBottom: "16px" }}
      >
        <QosIcon name="plus" size={16} />
        Nueva pieza
      </button>

      <DndContext id="kanban-board" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={styles.kanban}>
          {CONTENT_STAGE_ORDER.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              pieces={localPieces.filter((p) => p.stage === stage)}
              brandNameById={brandNameById}
              staffById={staffById}
              onSelect={setSelectedPiece}
            />
          ))}
        </div>
      </DndContext>

      {selectedPiece && (
        <ContentPieceDrawer
          piece={selectedPiece}
          brandName={brandNameById.get(selectedPiece.brand_id) ?? ""}
          staff={staff}
          onClose={() => setSelectedPiece(null)}
        />
      )}

      {showNewForm && (
        <NewContentPieceModal brands={brands} staff={staff} onClose={() => setShowNewForm(false)} />
      )}
    </div>
  );
}

function Column({
  stage,
  pieces,
  brandNameById,
  staffById,
  onSelect,
}: {
  stage: ContentStage;
  pieces: ContentPiece[];
  brandNameById: Map<string, string>;
  staffById: Map<string, StaffOption>;
  onSelect: (piece: ContentPiece) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const sop = CONTENT_STAGE_SOP[stage];

  return (
    <div ref={setNodeRef} className={`${styles.kcol} ${isOver ? styles.kcolDropHi : ""}`}>
      <div className={styles.kcolHead}>
        <span className={styles.dot} style={{ background: CONTENT_STAGE_COLOR[stage] }} />
        <span className={styles.kcName}>{CONTENT_STAGE_LABEL[stage]}</span>
        <span className={styles.kcCount}>{pieces.length}</span>
        {sop.sopCode && <span className={styles.sopTag} style={{ marginLeft: "auto" }}>{sop.sopCode}</span>}
      </div>
      <div className={styles.kcolBody}>
        {pieces.map((piece) => (
          <Card
            key={piece.id}
            piece={piece}
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
  brandName,
  owner,
  onSelect,
}: {
  piece: ContentPiece;
  brandName: string;
  owner?: StaffOption;
  onSelect: (piece: ContentPiece) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: piece.id });
  const isOverdue = piece.publish_date && new Date(piece.publish_date) < new Date() && piece.stage !== "publicado";

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
      </div>
      <div className={styles.kcFoot}>
        <span className={`${styles.kcDue} ${isOverdue ? styles.kcDueLate : ""}`}>
          <QosIcon name="clock" size={12} />
          {piece.publish_date
            ? new Date(piece.publish_date).toLocaleDateString("es-CR", { day: "numeric", month: "short" })
            : "—"}
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
