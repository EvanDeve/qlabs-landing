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
import type { Database, PipelineSection } from "@/lib/database.types";
import { updateContentPieceColumnAction } from "@/lib/actions/content-pieces";
import type { ContentColumn } from "@/lib/ugc/content-columns";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { diaCorto, estadoPublicacion } from "@/lib/ugc/calendar";
import { vistaDelPipeline } from "@/lib/ugc/content-meta";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import StaffAvatar from "./StaffAvatar";
import PipelineFilters, { type FiltrosPipeline } from "./PipelineFilters";
import { useRouter, useSearchParams } from "next/navigation";
import NewContentPieceModal from "./NewContentPieceModal";
import ContentColumnModal from "./ContentColumnModal";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type ContentPiece = Database["public"]["Tables"]["content_pieces"]["Row"];
// logoUrl y driveUrl son opcionales: NewContentPieceModal usa este mismo tipo
// solo para llenar un <select> y no necesita ni el logo ni el Drive.
export type BrandOption = {
  id: string;
  name: string;
  logoUrl?: string | null;
  /** El Drive del HERO (agency_clients.drive_url), no el de la pieza. */
  driveUrl?: string | null;
};

/**
 * Sin acentos, sin mayúsculas y sin espacios de más. Buscar "cafe" tiene que
 * encontrar "Café", que es justo el caso que más aparece con títulos en
 * español; sin normalizar, el buscador falla en la mitad de las tarjetas.
 */
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
// avatarUrl es opcional por la misma razón que logoUrl: los modales que solo
// llenan un <select> de responsables no necesitan la foto.
export type StaffOption = {
  id: string;
  name: string;
  role: string;
  color: string;
  avatarUrl?: string | null;
};

export default function KanbanBoard({
  pieces,
  columns,
  seccion,
  brands,
  staff,
  filtros,
  busquedaInicial,
}: {
  pieces: ContentPiece[];
  /** TODAS las columnas, no solo las de la sección abierta. */
  columns: ContentColumn[];
  /** Pestaña abierta; null = "Todo". */
  seccion: PipelineSection | null;
  brands: BrandOption[];
  staff: StaffOption[];
  /**
   * La barra de filtros la dibuja este componente y no la página, para que
   * "Nueva pieza"/"Nueva columna" —que necesitan el estado de acá— compartan
   * fila con las pestañas.
   */
  filtros: FiltrosPipeline;
  /** Lo que venía en `?q=`: con qué texto se estaba buscando al entrar a una pieza. */
  busquedaInicial: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localPieces, setLocalPieces] = useState(pieces);
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

  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  // Solo se filtra lo que se PINTA. `columns` completo sigue viajando al drawer
  // y al modal de columna: desde la pestaña de Videos tiene que poder mandarse
  // una pieza a Guiones, y el modal necesita el total real para saber si esta
  // es la última columna del tablero o la única marcada como publicadas.
  const visibleColumns = useMemo(
    () => (seccion ? columns.filter((c) => c.section === seccion) : columns),
    [columns, seccion]
  );

  // El buscador filtra en el navegador y no por la URL como el resto de los
  // filtros: las piezas ya están todas acá, así que buscar es instantáneo y no
  // le cuesta una consulta a Supabase por tecla —el egress es la primera pared
  // del proyecto—. La contra es que solo alcanza lo que ya se cargó, que es
  // exactamente lo que el equipo espera de un buscador dentro del tablero.
  //
  // Busca en el título Y en el código: el equipo nombra las piezas de las dos
  // formas, y un buscador que ignora el código obliga a leer tarjeta por tarjeta.
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const q = normalizar(busqueda);
  const coincide = (p: ContentPiece) =>
    !q || normalizar(p.title).includes(q) || normalizar(p.code ?? "").includes(q);

  const piezasBuscadas = q ? localPieces.filter(coincide) : localPieces;

  const columnIdsVisibles = useMemo(
    () => new Set(visibleColumns.map((c) => c.id)),
    [visibleColumns]
  );
  // Lo que de verdad hay en pantalla. Antes lo contaba el servidor, pero con el
  // buscador ese número quedaba viejo con cada tecla.
  const enPantalla = piezasBuscadas.filter((p) => columnIdsVisibles.has(p.column_id)).length;
  // Una tarjeta que calza pero vive en la otra pestaña no se ve, y sin avisar
  // parece que la búsqueda no encontró nada.
  //
  // Exige `q`: sin búsqueda, "lo que está fuera de la pestaña" es simplemente
  // la otra mitad del tablero, y avisarlo sería un cartel permanente diciendo
  // que las pestañas separan cosas.
  //
  // Y exige `seccion`: en "Todo" no hay ningún afuera.
  const fueraDeLaPestana =
    q && seccion ? piezasBuscadas.filter((p) => !columnIdsVisibles.has(p.column_id)).length : 0;

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

  /**
   * Abrir una tarjeta es SALIR del tablero: la pieza tiene URL propia, así que
   * el query con los filtros se queda atrás. Por eso la vista viaja en
   * `?volver=` y el botón de regresar de la pieza la reconstruye — antes había
   * que volver a filtrar después de abrir cada tarjeta.
   */
  function abrirPieza(p: ContentPiece) {
    const vista = new URLSearchParams(vistaDelPipeline(searchParams.toString()));
    // El buscador no vive en la URL —filtra en el navegador— así que se suma
    // acá, en el único momento en que hace falta persistirlo.
    if (busqueda.trim()) vista.set("q", busqueda.trim());
    else vista.delete("q");

    const volver = vista.toString();
    router.push(
      `/ugc/admin/pipeline/${p.id}${volver ? `?volver=${encodeURIComponent(volver)}` : ""}`
    );
  }

  return (
    <div>
      <PipelineFilters
        brands={brands}
        staff={staff}
        seccion={seccion}
        filtros={filtros}
        count={enPantalla}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        fueraDeLaPestana={fueraDeLaPestana}
        acciones={
          <>
            <button
              type="button"
              onClick={() => setCreatingInColumn(visibleColumns[0]?.id ?? null)}
              disabled={visibleColumns.length === 0}
              className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
            >
              <QosIcon name="plus" size={14} />
              Nueva pieza
            </button>
            <button
              type="button"
              onClick={() => setColumnModal("nueva")}
              className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
            >
              <QosIcon name="columns" size={14} />
              Nueva columna
            </button>
          </>
        }
      />

      {visibleColumns.length === 0 ? (
        // Pasa si alguien borró todas las columnas de la sección. Sin esto el
        // tablero queda en blanco y parece que se rompió.
        <p className={styles.empty}>
          Esta sección no tiene columnas. Creá una con &ldquo;Nueva columna&rdquo; o mirá el tablero
          completo en &ldquo;Todo&rdquo;.
        </p>
      ) : (
        <DndContext id="kanban-board" sensors={sensors} onDragEnd={handleDragEnd}>
          <div className={styles.kanban}>
            {visibleColumns.map((column) => (
              <Column
                key={column.id}
                column={column}
                pieces={piezasBuscadas.filter((p) => p.column_id === column.id)}
                brandById={brandById}
                staffById={staffById}
                onSelect={abrirPieza}
                onAdd={setCreatingInColumn}
                onEditColumn={setColumnModal}
              />
            ))}
          </div>
        </DndContext>
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
          seccionAbierta={seccion}
          onClose={() => setColumnModal(null)}
        />
      )}
    </div>
  );
}

function Column({
  column,
  pieces,
  brandById,
  staffById,
  onSelect,
  onAdd,
  onEditColumn,
}: {
  column: ContentColumn;
  pieces: ContentPiece[];
  brandById: Map<string, BrandOption>;
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
            // is_ready cuenta igual que is_done: una pieza en "Terminado" ya
            // está hecha y solo espera la fecha, así que pintarla de ámbar decía
            // "apurate" sobre algo que no tiene nada pendiente. Es la misma
            // regla que silencia el aviso de McLovin — si el color y el WhatsApp
            // no coincidieran, uno de los dos sobra.
            sinApuro={column.is_done || column.is_ready}
            brand={brandById.get(piece.brand_id)}
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
  sinApuro,
  brand,
  owner,
  onSelect,
}: {
  piece: ContentPiece;
  /**
   * No hay nada que apurar con esta pieza: su columna la declara publicada
   * (is_done) o ya hecha esperando la fecha (is_ready). Apaga el semáforo.
   */
  sinApuro: boolean;
  brand?: BrandOption;
  owner?: StaffOption;
  onSelect: (piece: ContentPiece) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: piece.id });

  // El semáforo de la tarjeta: rojo si la fecha pasó, ámbar si publica dentro
  // de los próximos DIAS_PUBLICA_PRONTO días.
  //
  // Una pieza sin apuro no se pinta nunca: ya salió o ya está hecha, y no hay
  // nada que reclamar por más que la fecha haya pasado.
  //
  // La comparación de días vive en estadoPublicacion() y compara días de Costa
  // Rica en texto, no instantes: `new Date(publish_date) < new Date()` marcaba
  // como atrasada una pieza que vencía HOY, porque el día suelto se interpreta
  // como medianoche UTC y eso ya pasó desde las 18:00 del día anterior en CR.
  const estado = piece.publish_date && !sinApuro ? estadoPublicacion(piece.publish_date) : "normal";

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
      className={[
        styles.kcard,
        estado === "vencida" ? styles.kcardLate : "",
        estado === "pronto" ? styles.kcardSoon : "",
        isDragging ? styles.kcardDragging : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.kcTop}>
        {/* El logo reemplaza al punto de color que había antes: ese punto era
            var(--b-500) fijo, o sea idéntico en todas las marcas, así que no
            distinguía nada. BrandAvatar cae a las iniciales sobre un degradado
            derivado del nombre cuando el Hero no subió logo — nunca queda un
            hueco, y la misma marca siempre se ve igual. */}
        <span className={styles.kcHero}>
          {/* Caja ancha con "contain": los logos de los Heroes son wordmarks
              horizontales (Dulce Chilena, Snowty), y en un cuadrado con cover
              quedaban como una mancha. Sin logo, BrandAvatar cae a iniciales
              sobre un degradado derivado del nombre. */}
          <BrandAvatar
            name={brand?.name ?? ""}
            logoUrl={brand?.logoUrl}
            size={22}
            width={brand?.logoUrl ? 44 : 22}
            radius={6}
            fit="contain"
          />
          {brand?.name ?? ""}
        </span>
        <span className={styles.kcNum}>{piece.code}</span>
        {/* El Drive del Hero, para no tener que ir al expediente a buscarlo. Es
            `agency_clients.drive_url`, el mismo que se carga en el Hero — no el
            de la pieza, que vive en el drawer. Sin Drive cargado no se dibuja:
            un botón que lleva a ningún lado es peor que no tenerlo.

            Los dos stopPropagation son obligatorios y hacen cosas distintas: el
            de pointerDown evita que @dnd-kit tome el clic como el arranque de un
            arrastre, y el de click evita que se abra el drawer de la pieza. Sin
            el primero el link no se puede apretar; sin el segundo, se abre el
            Drive Y el drawer a la vez. */}
        {brand?.driveUrl && (
          <a
            href={brand.driveUrl}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={styles.kcDrive}
            title={`Drive de ${brand.name}`}
            aria-label={`Abrir el Drive de ${brand.name}`}
          >
            <QosIcon name="drive" size={13} />
          </a>
        )}
      </div>
      <div className={styles.kcTitle}>{piece.title}</div>

      {/* Los apuntes, a la vista. Son lo que el equipo se deja escrito para
          producir —"grabar antes de las 10 por la luz", "falta el voice over"—
          y hasta ahora había que abrir la pieza para leerlos, o sea que en la
          práctica no los leía nadie.

          Se recortan a dos líneas por CSS y el texto entero queda en el
          `title`: una nota larga no puede empujar la tarjeta hasta romper la
          columna, pero tampoco tiene por qué perderse. */}
      {piece.notes?.trim() && (
        <div className={styles.kcNotes} title={piece.notes}>
          {piece.notes}
        </div>
      )}

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
        {/* La publicación va siempre —con "—" cuando falta, para que una pieza
            sin fecha se note en vez de desaparecer—; la grabación SOLO si la
            pieza tiene una.

            Los videos ya no llevan fecha de grabación: esa se planea una vez al
            mes y vive en el calendario como evento. Pero McLovin todavía puede
            crear una pieza con record_date desde WhatsApp, y esconderla dejaría
            un compromiso sin ninguna señal en el tablero.

            El rojo de atrasada va solo en publicación: una grabación con fecha
            pasada normalmente ya ocurrió, así que pintarla sería ruido fijo. */}
        <span className={styles.kcDates}>
          {piece.record_date && (
            <span className={styles.kcDate} title="Grabación">
              <QosIcon name="film" size={12} />
              {diaCorto(piece.record_date)}
            </span>
          )}
          <span
            className={[
              styles.kcDate,
              estado === "vencida" ? styles.kcDueLate : "",
              estado === "pronto" ? styles.kcDueSoon : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={
              estado === "vencida"
                ? "Publicación — la fecha ya pasó"
                : estado === "pronto"
                  ? "Publicación — sale en los próximos días"
                  : "Publicación"
            }
          >
            <QosIcon name="clock" size={12} />
            {piece.publish_date ? diaCorto(piece.publish_date) : "—"}
          </span>
        </span>
        {owner && <StaffAvatar name={owner.name} avatarUrl={owner.avatarUrl} color={owner.color} />}
      </div>
    </div>
  );
}
