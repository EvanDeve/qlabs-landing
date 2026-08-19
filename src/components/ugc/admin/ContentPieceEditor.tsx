"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Database } from "@/lib/database.types";
import { updateContentPieceAction, updateContentPieceColumnAction, deleteContentPieceAction } from "@/lib/actions/content-pieces";
import { nextColumn, type ContentColumn } from "@/lib/ugc/content-columns";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import type { BrandOption, StaffOption } from "./KanbanBoard";
import styles from "@/styles/qos.module.css";

type ContentPiece = Database["public"]["Tables"]["content_pieces"]["Row"];

/**
 * El detalle de una pieza, a pantalla completa.
 *
 * Era un panel lateral. El guion lo volvió insostenible: con cuatro campos de
 * texto largo más los quince de la ficha, editar un video era hacer scroll en
 * una columna de 420px mientras el tablero de atrás no servía para nada.
 *
 * A pantalla completa el guion se lleva la columna ancha —es lo que se escribe
 * y se relee— y la ficha queda al costado. Además la pieza pasa a tener URL
 * propia, que es lo que deja que el Dashboard mande directo acá en vez de al
 * expediente del Hero.
 */
export default function ContentPieceEditor({
  piece,
  volverHref,
  columns,
  brands,
  staff,
}: {
  piece: ContentPiece;
  /** El tablero como lo dejó quien entró acá: pestaña, filtros y búsqueda. */
  volverHref: string;
  columns: ContentColumn[];
  brands: BrandOption[];
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [columnId, setColumnId] = useState(piece.column_id);
  // El Hero vive en estado y no solo en el <select> para que el encabezado del
  // drawer diga la marca elegida apenas se cambia, y no la que tenía al abrir.
  const [brandId, setBrandId] = useState(piece.brand_id ?? "");
  // Título y código también en estado, por lo mismo: el encabezado los muestra
  // arriba y KanbanBoard no reabre el drawer con la pieza nueva al revalidar
  // (selectedPiece es una copia del momento del clic), así que sin esto el
  // nombre editado no se vería hasta cerrar y volver a entrar.
  const [title, setTitle] = useState(piece.title);
  const [code, setCode] = useState(piece.code ?? "");
  // La aprobación vive en estado para que el badge del guion siga al <select>
  // sin esperar a guardar: los dos miran el mismo dato y verlos discrepar
  // dentro de la misma pantalla se lee como que algo se rompió.
  const [approval, setApproval] = useState(piece.approval);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const brandName = brands.find((b) => b.id === brandId)?.name ?? "";
  const current = columns.find((c) => c.id === columnId);

  /**
   * Una tarjeta del carril de IT no es un video: es una tarea interna.
   *
   * No tiene guion, ni plataforma, ni hora de salida, ni aprobación del cliente
   * — mostrarle esos quince campos a quien solo necesita anotar "para cuándo
   * tiene que estar lista" es la forma más rápida de que el carril no se use.
   * Lo que sí lleva: título, para cuándo, quién la tiene, qué tan urgente es,
   * el detalle y un link.
   *
   * Los campos que no se dibujan viajan igual como hidden, con el valor que ya
   * tenían: el server action escribe TODO lo que lee del formulario, así que un
   * campo ausente se guardaría como null. Es el mismo motivo por el que
   * record_date ya viajaba así.
   */
  const esTarea = current?.section === "it";

  // Solo los pasos del carril al que pertenece la pieza. Un video no atraviesa
  // las columnas de IT ni las de cronogramas, así que dibujarlas lo haría ver
  // atascado al principio de un recorrido que no es el suyo.
  const delCarril = columns
    .filter((c) => c.section === current?.section)
    .sort((a, b) => a.position - b.position);

  /**
   * El paso siguiente DENTRO del carril, y ninguno si la pieza ya está en una
   * columna terminal.
   *
   * Las dos condiciones arreglan el mismo síntoma: un video en Publicado
   * ofrecía "Avanzar a Sin Empezar" —la primera columna de Cronogramas— porque
   * el siguiente se buscaba sobre `columns`, que son TODAS las columnas del
   * tablero pegadas una detrás de otra. Un video terminado no continúa en el
   * carril de al lado, y desde una columna `is_done` no continúa en ninguno.
   */
  const upcoming = current?.is_done ? null : nextColumn(delCarril, columnId);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  /**
   * El form se manda a mano en vez de con <form action={...}>.
   *
   * Con `action`, React 19 hace form.reset() cuando la acción termina, y el
   * reset deja el <select> de Hero en su primera opción —o sea, en una marca
   * que nadie eligió— mientras el drawer sigue mostrando la correcta. Ahí un
   * segundo "Guardar" mandaba la pieza a esa marca sin que se notara.
   */
  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateContentPieceAction(formData);
      setSaved(true);
    });
  }

  function handleAdvance() {
    if (!upcoming) return;
    startTransition(async () => {
      await updateContentPieceColumnAction(piece.id, upcoming.id);
      setColumnId(upcoming.id);
    });
  }

  /** Saltar a cualquier paso desde los círculos, incluido hacia atrás. */
  function handleIr(destinoId: string) {
    if (destinoId === columnId) return;
    startTransition(async () => {
      await updateContentPieceColumnAction(piece.id, destinoId);
      setColumnId(destinoId);
    });
  }

  async function handleDelete() {
    await deleteContentPieceAction(piece.id);
    // La pieza dejó de existir, así que esta URL también: volver al tablero es
    // lo único que tiene sentido. `replace` y no `push` para que el botón de
    // atrás no traiga de vuelta una página que ya da 404.
    router.replace(volverHref);
  }

  return (
    <>
      <div style={{ marginBottom: "18px" }}>
        {/* Botón y no link de texto: es la salida de una pantalla completa, no
            un "ver más" dentro de una tarjeta. Como link se leía igual que el
            resto del texto y no parecía la forma de volver. */}
        <Link href={volverHref} className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
          <QosIcon name="chevL" size={14} /> Volver al Pipeline
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", margin: "12px 0 2px" }}>
          {code && <span className={styles.sopTag}>{code}</span>}
          <h2 className={styles.sectionHeadBig}>{title}</h2>
        </div>
        <p className={styles.formNote}>{brandName}</p>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "18px" }}>
        <div className={styles.pasosHd}>
          <Pasos columnas={delCarril} actualId={columnId} onIr={handleIr} deshabilitado={isPending} />
          {upcoming && (
            <button
              type="button"
              onClick={handleAdvance}
              disabled={isPending}
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
            >
              Avanzar a {upcoming.name} <QosIcon name="chevR" size={13} />
            </button>
          )}
        </div>
        {current?.sop_code && (
          <p style={{ marginTop: "14px", fontSize: "11.5px", color: "var(--ink-3)" }}>
            {current.sop_code}
            {current.owner_role ? ` · Responsable: ${current.owner_role}` : ""}
          </p>
        )}
      </div>

      {/* Dos columnas: el guion —lo que se escribe y se relee— se lleva la
          ancha, y la ficha queda al costado. En una sola columna el guion
          empujaba los quince campos de metadatos fuera de pantalla, que es
          justamente lo que hacía incómodo el panel lateral. */}
      <form
        onSubmit={handleSave}
        className={styles.pieceGrid}
        // Sin guion no hay columna ancha que llenar: la ficha sola estirada a
        // dos columnas deja media pantalla vacía y se lee como que falta algo.
        style={esTarea ? { gridTemplateColumns: "minmax(0, 620px)" } : undefined}
      >
        <input type="hidden" name="id" value={piece.id} />

        {esTarea ? (
          <CamposDeVideoOcultos piece={piece} />
        ) : (
          <div>
            <GuionSection piece={piece} approval={approval} />

            {/* Las notas de producción van acá abajo y no en la ficha: se
                escriben junto con el guion —locación, utilería, quién sale— y no
                al configurar la pieza. */}
            <div className={styles.field}>
              <label htmlFor="piece-notes">Apuntes</label>
              <textarea
                id="piece-notes"
                name="notes"
                rows={4}
                defaultValue={piece.notes ?? ""}
                placeholder="Locación, utilería, quién sale…"
                className={styles.inp}
              />
            </div>
          </div>
        )}

        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.sectionHead}>
            <h2>Ficha</h2>
          </div>

            {/* El nombre de la tarjeta se corrige acá: antes quedaba fijo desde
                que se creaba la pieza —o desde lo que entendió McLovin por
                WhatsApp— y un título mal escrito solo se arreglaba borrando la
                pieza y volviéndola a crear. */}
            <div style={{ display: "flex", gap: "12px" }}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label htmlFor="piece-title">Título</label>
                <input
                  id="piece-title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={styles.inp}
                />
              </div>
              {!esTarea && (
                <div className={styles.field} style={{ width: "120px" }}>
                  <label htmlFor="piece-code">Código</label>
                  <input
                    id="piece-code"
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="LB-042"
                    className={styles.inp}
                  />
                </div>
              )}
            </div>

            {/* El Hero se puede corregir después de crear la pieza: antes
                quedaba fijo y una pieza cargada en la marca equivocada solo se
                arreglaba borrándola y volviéndola a crear. */}
            <div className={styles.field}>
              <label>Hero{esTarea ? " (opcional)" : ""}</label>
              <select
                name="brand_id"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className={styles.inp}
              >
                {/* Una tarea interna no es de ningún cliente. La opción existe
                    solo en el carril de IT: en video, una pieza sin Hero no se
                    sabría a quién facturarle ni en qué expediente mirarla. */}
                {esTarea && <option value="">Sin Hero — interna</option>}
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>Responsable</label>
              <select name="owner_id" defaultValue={piece.owner_id ?? ""} className={styles.inp}>
                <option value="">Sin asignar</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.role}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label>Prioridad</label>
                <select name="priority" defaultValue={piece.priority} className={styles.inp}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className={styles.field} style={esTarea ? { display: "none" } : { flex: 1 }}>
                  <label>Plataforma</label>
                  <select name="platform" defaultValue={piece.platform} className={styles.inp}>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="reels">Reels</option>
                  </select>
              </div>
            </div>

            <div className={styles.field} style={esTarea ? { display: "none" } : undefined}>
              <label>Aprobación</label>
              <select
                name="approval"
                value={approval}
                onChange={(e) => setApproval(e.target.value as ContentPiece["approval"])}
                className={styles.inp}
              >
                <option value="pendiente">Pendiente</option>
                <option value="correccion">Corrección</option>
                <option value="revisado">Revisado</option>
              </select>
            </div>

            {/* Solo publicación: la grabación es un hito mensual del calendario,
                no un dato de cada pieza. Ver el comentario en NewContentPieceModal.

                record_date viaja igual como hidden con el valor que ya tenía. Sin
                esto, guardar cualquier pieza la dejaría en null —el server action
                lee el campo del formulario y lo ausente vale ""— y una pieza vieja
                perdería su fecha en silencio al tocarle cualquier otra cosa. */}
            <input type="hidden" name="record_date" value={piece.record_date?.slice(0, 10) ?? ""} />

            {/* La hora va en su propio campo y su propia columna, no dentro de
                publish_date: ese es el bug del día corrido de la migración
                20260801000000, y meterle una hora lo reabriría entero. */}
            <div style={{ display: "flex", gap: "12px" }}>
              <div className={styles.field} style={{ flex: 1 }}>
                {/* Es la misma columna con dos significados según el carril: un
                    video sale al aire ese día, una tarea tiene que estar lista.
                    Llamarla "Publicación" en IT es lo que hacía que McLovin
                    dijera "la publicación de Prueba entrecote". */}
                <label htmlFor="piece-publish-date">{esTarea ? "Lista para" : "Publicación"}</label>
                <input
                  id="piece-publish-date"
                  type="date"
                  name="publish_date"
                  defaultValue={piece.publish_date?.slice(0, 10) ?? ""}
                  className={styles.inp}
                />
              </div>
              <div className={styles.field} style={esTarea ? { display: "none" } : { width: "130px" }}>
                <label htmlFor="piece-publish-time">Hora</label>
                <input
                  id="piece-publish-time"
                  type="time"
                  name="publish_time"
                  defaultValue={piece.publish_time?.slice(0, 5) ?? ""}
                  className={styles.inp}
                />
              </div>
            </div>

            {esTarea ? (
              <>
                <LinkField
                  label="Link"
                  name="drive_url"
                  value={piece.drive_url}
                  icon="external"
                  placeholder="El ticket, el repo, el panel…"
                />
                {/* En un video los apuntes viven junto al guion, que es cuando
                    se escriben. En una tarea son el enunciado: qué hay que
                    tocar y dónde. */}
                <div className={styles.field}>
                  <label htmlFor="piece-notes">Apuntes</label>
                  <textarea
                    id="piece-notes"
                    name="notes"
                    rows={5}
                    defaultValue={piece.notes ?? ""}
                    placeholder="Qué hay que hacer, dónde, con qué acceso…"
                    className={styles.inp}
                  />
                </div>
              </>
            ) : (
              <>
                <LinkField
                  label="Link Drive"
                  name="drive_url"
                  value={piece.drive_url}
                  icon="drive"
                  placeholder="https://drive.google.com/..."
                />
                <LinkField label="Link video final" name="final_url" value={piece.final_url} icon="play" />
              </>
            )}

            {/* La página no se cierra al guardar, así que sin este aviso no hay
                ninguna señal de que el cambio entró. */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
              <button type="submit" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
                {isPending ? "Guardando…" : saved ? "Guardado" : "Guardar"}
                {saved && !isPending && <QosIcon name="check" size={15} />}
              </button>
            </div>

            {/* Apartado del guardar y al pie de la ficha: es la única acción
                irreversible de la pantalla y no tiene por qué estar al lado de
                la que se usa veinte veces por día. */}
            <div style={{ marginTop: "22px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
              <ConfirmDeleteButton
                action={handleDelete}
                confirmMessage={`¿Borrar la pieza "${title}"? Se pierde su guion y no se puede deshacer.`}
                className={`${styles.btn} ${styles.btnGhostDanger} ${styles.btnSm}`}
              >
                Borrar pieza
              </ConfirmDeleteButton>
            </div>
        </div>
      </form>
    </>
  );
}

/**
 * En qué paso del carril está el video, como una fila de círculos.
 *
 * Reemplaza al tag de texto que solo decía el nombre de la columna. Un nombre
 * suelto no dice cuánto falta: "Por editar" no deja ver que quedan tres pasos
 * ni cuáles ya pasaron. Con los círculos eso se lee sin pensar.
 *
 * Los pasos son clickeables, y esa es la parte que agrega algo además de lo
 * visual: hasta ahora la única forma de mover una pieza desde esta pantalla era
 * "Avanzar", que va de a uno y solo hacia adelante. Mandar un video de vuelta a
 * edición obligaba a ir al tablero a arrastrarlo. El botón se queda igual
 * porque nombra el destino y es la acción de todos los días.
 */
function Pasos({
  columnas,
  actualId,
  onIr,
  deshabilitado,
}: {
  columnas: ContentColumn[];
  actualId: string;
  onIr: (id: string) => void;
  deshabilitado: boolean;
}) {
  const actual = columnas.findIndex((c) => c.id === actualId);

  return (
    <ol className={styles.pasos}>
      {columnas.map((c, i) => {
        const pasado = i < actual;
        const esActual = i === actual;
        // Estar EN una columna terminal es haberla cumplido: un video en
        // Publicado ya se publicó. Sin esto el último paso se dibujaba con su
        // número y sin palomita —igual que los que faltan— y el recorrido se
        // leía incompleto justo cuando está entero.
        const hecho = pasado || (esActual && c.is_done);
        // El color lo pone la columna, que el equipo configura. Los pasos que
        // todavía no llegaron van en gris: pintarlos de su color haría ver el
        // recorrido entero como si ya estuviera hecho.
        const color = pasado || esActual ? c.color : "var(--ink-3)";

        return (
          <li key={c.id} className={styles.paso}>
            {i > 0 && (
              <span
                className={styles.pasoLinea}
                style={{ background: i <= actual ? c.color : "var(--line)" }}
                aria-hidden
              />
            )}
            <button
              type="button"
              onClick={() => onIr(c.id)}
              disabled={deshabilitado || esActual}
              className={styles.pasoBtn}
              title={esActual ? `Está en ${c.name}` : `Mover a ${c.name}`}
              aria-current={esActual ? "step" : undefined}
            >
              <span
                className={`${styles.pasoDot} ${esActual ? styles.pasoDotActual : ""}`}
                style={{
                  background: hecho ? color : esActual ? "var(--surface)" : "var(--surface-3)",
                  borderColor: color,
                  color: hecho ? "#fff" : color,
                  // El halo del paso actual lo saca la clase de `currentColor`,
                  // y en un paso cumplido currentColor es blanco: sobre la
                  // tarjeta blanca el halo desaparecería. Se repone con el
                  // color de la columna.
                  boxShadow:
                    esActual && hecho
                      ? `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent)`
                      : undefined,
                }}
              >
                {hecho ? <QosIcon name="check" size={12} /> : i + 1}
              </span>
              <span className={styles.pasoNombre} style={{ color: esActual ? "var(--ink)" : "var(--ink-3)" }}>
                {c.name}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Cómo se ve el estado de aprobación cuando lo que se está mirando es el guion. */
const APROBACION_DEL_GUION: Record<ContentPiece["approval"], { texto: string; color: string; fondo: string }> = {
  pendiente: { texto: "Pendiente de aprobación", color: "var(--warn)", fondo: "var(--warn-bg)" },
  correccion: { texto: "Con correcciones", color: "var(--risk)", fondo: "var(--risk-bg)" },
  revisado: { texto: "Aprobado", color: "var(--ok)", fondo: "var(--ok-bg)" },
};

/**
 * El guion de la pieza: hook, idea central, desarrollo y CTA.
 *
 * El hook va arriba y con caja propia, separado de los otros tres, porque es la
 * única línea que se dice tal cual y no se improvisa en el set (SOP-002). Que se
 * vea distinto no es decoración: es la regla, puesta donde se escribe.
 *
 * Va plegable porque el drawer también sirve para tocar cosas que no tienen nada
 * que ver con el guion —mover de columna, corregir el Hero, pegar el link del
 * video final— y con los cuatro campos abiertos siempre, esas quedan a dos
 * pantallas de scroll.
 */
/**
 * Lo que una tarea de IT no muestra pero tampoco puede perder.
 *
 * El server action escribe TODOS los campos que lee del formulario, y lo que no
 * viene vale "" — o sea null. Sin estos hidden, abrir una tarjeta en el carril
 * de IT y guardarla le borraría el guion, el link del documento y el del video
 * final a una pieza que alguna vez estuvo en video.
 *
 * Es el mismo mecanismo que ya usaba record_date, generalizado.
 */
function CamposDeVideoOcultos({ piece }: { piece: ContentPiece }) {
  return (
    <>
      <input type="hidden" name="script_hook" value={piece.script_hook ?? ""} />
      <input type="hidden" name="script_idea" value={piece.script_idea ?? ""} />
      <input type="hidden" name="script_desarrollo" value={piece.script_desarrollo ?? ""} />
      <input type="hidden" name="script_cta" value={piece.script_cta ?? ""} />
      <input type="hidden" name="script_url" value={piece.script_url ?? ""} />
      <input type="hidden" name="final_url" value={piece.final_url ?? ""} />
    </>
  );
}

function GuionSection({ piece, approval }: { piece: ContentPiece; approval: ContentPiece["approval"] }) {
  const [abierto, setAbierto] = useState(true);
  const estado = APROBACION_DEL_GUION[approval];

  return (
    <div className={styles.guionBlock}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={styles.guionHd}
        aria-expanded={abierto}
        aria-controls="guion-body"
      >
        <h3>Guion</h3>
        <span className={styles.badgeSt} style={{ background: estado.fondo, color: estado.color }}>
          {estado.texto}
        </span>
        <QosIcon
          name="chevR"
          size={16}
          className={`${styles.guionChev} ${abierto ? styles.guionChevOpen : ""}`}
        />
      </button>

      {/* Se oculta con CSS y no desmontando: los campos tienen que seguir en el
          formulario aunque el bloque esté plegado, o guardar con el guion
          cerrado le borraría el guion a la pieza. */}
      <div id="guion-body" className={styles.guionBody} hidden={!abierto}>
        <div className={styles.hookBox}>
          <label htmlFor="guion-hook" className={styles.hookLabel}>
            <QosIcon name="lock" size={12} />
            Hook — sagrado, se dice tal cual
          </label>
          <textarea
            id="guion-hook"
            name="script_hook"
            rows={2}
            defaultValue={piece.script_hook ?? ""}
            placeholder="El hook exacto del guion…"
            className={styles.hookInput}
          />
          <p className={styles.hookNote}>El hook no se modifica en el set. Sin excepciones (SOP-002).</p>
        </div>

        <div className={styles.field}>
          <label htmlFor="guion-idea">Idea central</label>
          <textarea
            id="guion-idea"
            name="script_idea"
            rows={2}
            defaultValue={piece.script_idea ?? ""}
            placeholder="De qué se trata el video, en una línea…"
            className={styles.inp}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="guion-desarrollo">Desarrollo</label>
          <textarea
            id="guion-desarrollo"
            name="script_desarrollo"
            rows={5}
            defaultValue={piece.script_desarrollo ?? ""}
            placeholder="Cómo se desarrolla el video…"
            className={styles.inp}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="guion-cta">CTA</label>
          <textarea
            id="guion-cta"
            name="script_cta"
            rows={2}
            defaultValue={piece.script_cta ?? ""}
            placeholder="Llamado a la acción final…"
            className={styles.inp}
          />
        </div>

        {/* El link a Drive se queda: agosto entero vive ahí y nadie abandona
            Docs de golpe. Acá abajo queda como respaldo del guion de arriba, no
            como un campo suelto del formulario. */}
        <LinkField label="Documento original" name="script_url" value={piece.script_url} icon="doc" />
      </div>
    </div>
  );
}

/**
 * Campo de link con dos botones: abrir en otra pestaña y copiar al portapapeles.
 *
 * El valor vive en estado —y no suelto en un input no controlado— para que los
 * botones sirvan sobre lo que se acaba de pegar, sin tener que guardar primero.
 */
function LinkField({
  label,
  name,
  value: initialValue,
  icon,
  placeholder,
}: {
  label: string;
  name: string;
  value: string | null;
  icon: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [copied, setCopied] = useState(false);
  const href = hrefDeLink(value);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(href ?? value.trim());
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles (o fuera de HTTPS) queda al menos el texto
      // seleccionado para copiarlo a mano.
      document.getElementById(`link-${name}`)?.focus();
      (document.getElementById(`link-${name}`) as HTMLInputElement | null)?.select();
    }
  }

  return (
    <div className={styles.field}>
      <label htmlFor={`link-${name}`} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <QosIcon name={icon} size={13} />
        {label}
      </label>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          id={`link-${name}`}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={styles.inp}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value.trim()}
          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
          style={{ padding: "8px 10px", opacity: value.trim() ? 1 : 0.4 }}
          title={copied ? "Copiado" : `Copiar ${label.toLowerCase()}`}
          aria-label={`Copiar ${label.toLowerCase()}`}
        >
          <QosIcon name={copied ? "check" : "copy"} size={15} />
        </button>
        {/* Un <a> y no un botón: así se puede abrir con clic del medio o
            Cmd+clic, como cualquier link. Sin URL queda como span apagado —un
            ancla sin href no es clickeable ni recibe foco. */}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`${styles.btn} ${styles.btnSoft} ${styles.btnSm}`}
            style={{ padding: "8px 10px" }}
            title={`Abrir ${label.toLowerCase()} en otra pestaña`}
            aria-label={`Abrir ${label.toLowerCase()} en otra pestaña`}
          >
            <QosIcon name="external" size={15} />
          </a>
        ) : (
          <span
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            style={{ padding: "8px 10px", opacity: 0.4 }}
            title="Pegá un link para poder abrirlo"
            aria-hidden
          >
            <QosIcon name="external" size={15} />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * URL para abrir en otra pestaña, o null si no hay nada que abrir.
 *
 * Un link pegado como "drive.google.com/..." sin esquema se leería como ruta
 * relativa y llevaría a /admin/drive.google.com — de ahí el https:// de
 * relleno. Se descartan esquemas raros (javascript:, data:) para no meter un
 * link ejecutable en el drawer.
 */
function hrefDeLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const conEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(conEsquema);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
