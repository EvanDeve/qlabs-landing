"use client";

import { useState, useTransition } from "react";
import type { Database } from "@/lib/database.types";
import { guardarVideoAction, borrarVideoAction } from "@/lib/actions/cronogramas";
import { horaCorta, estadoDelGuion } from "@/lib/ugc/cronograma";
import { diaCorto } from "@/lib/ugc/calendar";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import styles from "@/styles/qos.module.css";

type Item = Database["public"]["Tables"]["calendar_month_items"]["Row"];

/**
 * Un video del cronograma: cabecera con lo que se lee de un vistazo, y el
 * detalle —incluido el guion entero— desplegándose adentro.
 *
 * Se eligió esto sobre mostrar los 10 videos con sus 4 campos de guion abiertos:
 * armando un mes lo que se necesita ver es la grilla de fechas, y bajar al
 * detalle de a un video por vez. Con todo abierto son diez pantallas de scroll
 * y se pierde la vista del mes, que es justo lo que el cronograma viene a dar.
 */
/**
 * En qué anda el guion de este video, leído con la fila cerrada.
 *
 * Es lo que convierte la pantalla en algo que se puede recorrer: armando diez
 * videos, la pregunta constante es "¿cuáles me faltan por escribir?", y sin
 * esto solo se contestaba abriendo uno por uno.
 *
 * Completo no lleva contador —"4/4" no agrega nada— y lo que falta sí lo lleva,
 * porque no es lo mismo que falte un campo a que falten tres.
 */
function GuionChip({ item }: { item: Item }) {
  const { escritos, total, estado } = estadoDelGuion(item);

  if (estado === "completo") {
    return (
      <span className={styles.badgeSt} style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>
        <QosIcon name="check" size={12} /> Guion listo
      </span>
    );
  }

  if (estado === "vacio") {
    return (
      <span className={styles.chip} style={{ color: "var(--ink-3)" }}>
        Sin guion
      </span>
    );
  }

  return (
    <span className={styles.badgeSt} style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
      Guion {escritos}/{total}
    </span>
  );
}

export default function CronogramaVideoRow({
  item,
  numero,
  apuntes,
}: {
  item: Item;
  numero: number;
  /**
   * Los apuntes de la tarjeta del pipeline —`content_pieces.notes`—, que son
   * OTRA cosa que las "Notas de producción" de más abajo: esas viven en el
   * cronograma y las escribe quien arma el mes; estos los escribe el equipo
   * sobre la tarjeta y son los que dicen si el video se graba o va con voice
   * over. Por eso no se editan acá: la tarjeta es su dueña, y el cronograma no
   * los pisa al sincronizar (ver `sincronizarConLaTarjeta`).
   */
  apuntes: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);
  // El título en estado para que la cabecera lo diga mientras se escribe: es la
  // única parte del video que se ve con la fila cerrada.
  const [titulo, setTitulo] = useState(item.title);

  const aprobado = item.piece_id !== null;
  const apuntesLimpios = apuntes?.trim() || null;

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await guardarVideoAction(formData);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    });
  }

  return (
    <div className={`${styles.videoRow} ${abierto ? styles.videoRowAbierta : ""}`}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={styles.videoHd}
        aria-expanded={abierto}
        aria-controls={`video-${item.id}`}
      >
        <span className={styles.videoNum}>{String(numero).padStart(2, "0")}</span>

        <span className={styles.videoTitCol}>
          <span className={`${styles.videoTitulo} ${titulo ? "" : styles.videoSinTitulo}`}>
            {titulo || "Sin título todavía"}
          </span>

          {/* Los apuntes se leen con la fila CERRADA. Quien graba recorre el mes
              buscando qué le toca grabar y qué es voice over; si hay que abrir
              los diez videos para saberlo, no los lee nadie. Se recortan a una
              línea y el texto entero queda en el `title`. */}
          {apuntesLimpios && (
            <span className={styles.videoApuntes} title={apuntesLimpios}>
              {apuntesLimpios}
            </span>
          )}
        </span>

        <GuionChip item={item} />

        {/* El comentario del Hero se ve con la fila cerrada: si hay que
            recorrer los videos abriéndolos uno por uno para encontrarlo, el
            aviso no sirve de nada. */}
        {item.client_comment && (
          <span className={styles.badgeSt} style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
            <QosIcon name="chat" size={12} /> Comentado
          </span>
        )}

        <span className={`${styles.videoFecha} ${item.publish_date ? "" : styles.videoSinFecha}`}>
          {item.publish_date ? diaCorto(item.publish_date) : "sin fecha"}
          {item.publish_time ? ` · ${horaCorta(item.publish_time)}` : ""}
        </span>

        <QosIcon name="chevR" size={15} className={`${styles.guionChev} ${abierto ? styles.guionChevOpen : ""}`} />
      </button>

      <div id={`video-${item.id}`} className={styles.videoBody} hidden={!abierto}>
        <form onSubmit={handleSave}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="hero_id" value={item.hero_id} />
          <input type="hidden" name="month" value={item.month} />

          <div className={styles.field} style={{ marginTop: "14px" }}>
            <label htmlFor={`titulo-${item.id}`}>Título del video</label>
            <input
              id={`titulo-${item.id}`}
              name="title"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Reel de brunch de domingo"
              className={styles.inp}
            />
          </div>

          <div className={styles.videoFila}>
            <div className={styles.field}>
              <label htmlFor={`fecha-${item.id}`}>Publicación</label>
              <input
                id={`fecha-${item.id}`}
                type="date"
                name="publish_date"
                defaultValue={item.publish_date ?? ""}
                className={styles.inp}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`hora-${item.id}`}>Hora</label>
              <input
                id={`hora-${item.id}`}
                type="time"
                name="publish_time"
                defaultValue={horaCorta(item.publish_time)}
                className={styles.inp}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`plat-${item.id}`}>Plataforma</label>
              <select id={`plat-${item.id}`} name="platform" defaultValue={item.platform} className={styles.inp}>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="reels">Reels</option>
              </select>
            </div>
          </div>

          {/* Lo que dejó dicho el Hero desde su link. Se muestra y no se edita:
              es lo que él dijo, y pisarlo borraría el pedido antes de
              atenderlo. Se aplica cambiando los campos de arriba. */}
          {item.client_comment && (
            <div className={styles.hookBox} style={{ background: "var(--warn-bg)", borderColor: "var(--warn-line)" }}>
              <p className={styles.hookLabel} style={{ color: "var(--warn)" }}>
                <QosIcon name="chat" size={12} />
                Lo que dijo el cliente
              </p>
              <p style={{ fontSize: "13.5px", lineHeight: 1.5 }}>{item.client_comment}</p>
            </div>
          )}

          {/* Completos y sin recortar, arriba del guion: es lo que hay que tener
              a mano para grabar. No son editables acá a propósito —se escriben
              en la tarjeta del tablero— y el pie lo dice, para que nadie los
              busque en este formulario. */}
          {apuntesLimpios && (
            <div className={styles.hookBox} style={{ marginTop: "16px" }}>
              <p className={styles.hookLabel}>
                <QosIcon name="pencil" size={12} />
                Apuntes del equipo
              </p>
              <p style={{ fontSize: "13.5px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{apuntesLimpios}</p>
              <p className={styles.hookNote}>Se escriben en la tarjeta del pipeline.</p>
            </div>
          )}

          <fieldset className={styles.fieldGroup} style={{ marginTop: "16px" }}>
            <legend>Guion</legend>

            <div className={styles.hookBox}>
              <label htmlFor={`hook-${item.id}`} className={styles.hookLabel}>
                <QosIcon name="lock" size={12} />
                Hook — sagrado, se dice tal cual
              </label>
              <textarea
                id={`hook-${item.id}`}
                name="script_hook"
                rows={2}
                defaultValue={item.script_hook ?? ""}
                placeholder="El hook exacto del guion…"
                className={styles.hookInput}
              />
              <p className={styles.hookNote}>El hook no se modifica en el set. Sin excepciones (SOP-002).</p>
            </div>

            <div className={styles.field}>
              <label htmlFor={`idea-${item.id}`}>Idea central</label>
              <textarea
                id={`idea-${item.id}`}
                name="script_idea"
                rows={2}
                defaultValue={item.script_idea ?? ""}
                placeholder="De qué se trata el video, en una línea…"
                className={styles.inp}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor={`des-${item.id}`}>Desarrollo</label>
              <textarea
                id={`des-${item.id}`}
                name="script_desarrollo"
                rows={5}
                defaultValue={item.script_desarrollo ?? ""}
                placeholder="Cómo se desarrolla el video…"
                className={styles.inp}
              />
            </div>

            <div className={styles.field} style={{ marginBottom: 0 }}>
              <label htmlFor={`cta-${item.id}`}>CTA</label>
              <textarea
                id={`cta-${item.id}`}
                name="script_cta"
                rows={2}
                defaultValue={item.script_cta ?? ""}
                placeholder="Llamado a la acción final…"
                className={styles.inp}
              />
            </div>
          </fieldset>

          <div className={styles.field}>
            <label htmlFor={`notas-${item.id}`}>Notas de producción</label>
            <textarea
              id={`notas-${item.id}`}
              name="notes"
              rows={2}
              defaultValue={item.notes ?? ""}
              placeholder="Locación, utilería, quién sale…"
              className={styles.inp}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button type="submit" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
              {isPending ? "Guardando…" : guardado ? "Guardado" : "Guardar video"}
              {guardado && !isPending && <QosIcon name="check" size={15} />}
            </button>

            {/* Ya aprobado no se borra: su tarjeta está en el tablero y alguien
                puede estar trabajándola. El server action lo rechaza igual; esto
                es para que no parezca posible. */}
            {aprobado ? (
              <span className={styles.formNote}>Ya está en el pipeline, no se puede quitar del cronograma.</span>
            ) : (
              <ConfirmDeleteButton
                action={async () => {
                  await borrarVideoAction(item.id, item.hero_id, item.month);
                }}
                confirmMessage={`¿Quitar el video ${numero} del cronograma?`}
                className={`${styles.btn} ${styles.btnGhostDanger}`}
              >
                Quitar
              </ConfirmDeleteButton>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
