"use client";

import { useRef, useState } from "react";
import type { Database } from "@/lib/database.types";
import {
  deleteTranscriptionAction,
  saveImprovedScriptAction,
} from "@/lib/actions/transcriptions";
import {
  segmentsToPlainText,
  segmentsToTimestampedText,
  esArchivoAceptado,
  MAX_TRANSCRIPTION_FILE_BYTES,
  TRANSCRIPTION_BUCKET,
  type TranscriptionSegment,
} from "@/lib/ugc/transcription";
import { pesoLegible, subirArchivoDirecto } from "@/lib/ugc/uploads";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import styles from "@/styles/qos.module.css";

type Fila = Database["public"]["Tables"]["creator_transcriptions"]["Row"];

type Estado = "vacio" | "subiendo" | "procesando" | "listo" | "error";

const ESTADO_COLOR: Record<Estado, string> = {
  vacio: "var(--ink-3)",
  subiendo: "var(--info)",
  procesando: "var(--warn)",
  listo: "var(--ok)",
  error: "var(--risk)",
};

const ESTADO_TEXTO: Record<Estado, string> = {
  vacio: "sin transcribir",
  subiendo: "subiendo archivo…",
  procesando: "transcribiendo…",
  listo: "listo",
  error: "falló",
};

/** El link entero no entra en 320px: se muestra la parte que identifica. */
function nombreCorto(t: Fila): string {
  if (t.file_name) return t.file_name;
  if (!t.source_url) return "archivo";
  try {
    const u = new URL(t.source_url);
    const id = u.searchParams.get("v");
    if (id) return `youtube · ${id}`;
    return u.hostname.replace(/^www\./, "") + u.pathname.slice(0, 22);
  } catch {
    return t.source_url.slice(0, 34);
  }
}

/**
 * La herramienta de transcripción de Q·OS, el panel del equipo.
 *
 * Vivía en `components/ugc/creador/` porque nació ahí y el equipo la heredó.
 * Se mudó acá el 2026-08-25, cuando el panel del creador se rediseñó con
 * lenguaje de app de teléfono —lista y detalle, ver `TranscripcionDetalle`— y
 * Q·OS se quedó con esta: son dos sistemas de diseño distintos, y este de tres
 * paneles es el correcto para una pantalla de escritorio donde se trabaja con
 * el material a la vista. El backend es el mismo para las dos.
 */
export default function TranscriptionTool({ previas }: { previas: Fila[] }) {
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState<Estado>("vacio");
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[] | null>(null);
  const [copiado, setCopiado] = useState<"texto" | "tiempos" | null>(null);
  const [historial, setHistorial] = useState(previas);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [ladoCerrado, setLadoCerrado] = useState(false);
  const inputArchivo = useRef<HTMLInputElement>(null);

  // ---- Guion mejorado (tercer panel) ----
  // `guionGuardado` es la copia que está en la base. Comparar contra ella es
  // lo que dice si hay cambios sin guardar, sin tener que ensuciar un flag a
  // mano en cada tecla ni perder el aviso cuando el creador deshace su edición.
  const [guion, setGuion] = useState("");
  const [guionGuardado, setGuionGuardado] = useState("");
  const [guionEstado, setGuionEstado] = useState<"quieto" | "generando" | "guardando">("quieto");
  const [guionError, setGuionError] = useState<string | null>(null);
  const [guionCopiado, setGuionCopiado] = useState(false);
  const [confirmarRegenerar, setConfirmarRegenerar] = useState(false);

  const ocupado = estado === "procesando" || estado === "subiendo";
  const guionSucio = guion !== guionGuardado;
  const guionOcupado = guionEstado !== "quieto";

  /** Deja el panel de guion en blanco: se usa al cambiar de transcripción. */
  function limpiarGuion(texto = "") {
    setGuion(texto);
    setGuionGuardado(texto);
    setGuionError(null);
  }

  async function refrescarHistorial() {
    const res = await fetch("/api/ugc/transcribe/historial").catch(() => null);
    if (res?.ok) setHistorial(await res.json());
  }

  async function pedirTranscripcion(body: Record<string, string>) {
    const res = await fetch("/api/ugc/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // La respuesta puede no ser JSON si la función se cortó por tiempo: ahí el
    // body viene vacío o con el HTML de error de la plataforma.
    let data: { id?: string; segments?: TranscriptionSegment[]; error?: string };
    try {
      data = await res.json();
    } catch {
      throw new Error("El video tardó demasiado y se cortó. Probá con uno más corto.");
    }
    if (!res.ok) throw new Error(data.error ?? "No se pudo transcribir.");
    return data;
  }

  async function transcribirUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || ocupado) return;

    setEstado("procesando");
    setError(null);
    setSegments(null);
    setActivaId(null);
    limpiarGuion();

    try {
      const data = await pedirTranscripcion({ url });
      setSegments(data.segments ?? []);
      setActivaId(data.id ?? null);
      setEstado("listo");
      setUrl("");
      await refrescarHistorial();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo transcribir.");
      setEstado("error");
    }
  }

  async function transcribirArchivo(file: File) {
    if (ocupado) return;

    if (!esArchivoAceptado(file.name, file.type)) {
      setError("Ese formato no sirve. Subí un video (mp4, mov, webm) o un audio (mp3, m4a, wav).");
      setEstado("error");
      return;
    }
    if (file.size > MAX_TRANSCRIPTION_FILE_BYTES) {
      setError(
        `El archivo pesa ${pesoLegible(file.size)} y el máximo es ${pesoLegible(MAX_TRANSCRIPTION_FILE_BYTES)}. Recortá el video o exportalo con menos calidad.`
      );
      setEstado("error");
      return;
    }

    setEstado("subiendo");
    setError(null);
    setSegments(null);
    setActivaId(null);
    limpiarGuion();

    try {
      // Sube DIRECTO a Supabase Storage, sin pasar por el servidor: en Vercel
      // el body de una función tiene un tope de ~4.5 MB y un video no entra.
      // El helper arma la ruta bajo el uuid del creador, que es lo que exige
      // la policy del bucket.
      const storagePath = await subirArchivoDirecto({
        bucket: TRANSCRIPTION_BUCKET,
        file,
        maxBytes: MAX_TRANSCRIPTION_FILE_BYTES,
        extFallback: "mp4",
      });

      setEstado("procesando");
      const data = await pedirTranscripcion({ storagePath, fileName: file.name });

      setSegments(data.segments ?? []);
      setActivaId(data.id ?? null);
      setEstado("listo");
      await refrescarHistorial();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo transcribir el archivo.");
      setEstado("error");
    } finally {
      if (inputArchivo.current) inputArchivo.current.value = "";
    }
  }

  function abrirPrevia(t: Fila) {
    // El guion viaja con la fila: al cambiar de transcripción se muestra el que
    // esa tenga guardado, o el panel vacío si nunca se generó.
    limpiarGuion(t.improved_script ?? "");

    if (!t.segments?.length) {
      setSegments(null);
      setError(t.error_message ?? "Esa transcripción no se completó.");
      setEstado("error");
      setActivaId(t.id);
      return;
    }
    setSegments(t.segments);
    setError(null);
    setEstado("listo");
    setActivaId(t.id);
  }

  async function borrar(t: Fila) {
    const fd = new FormData();
    fd.set("id", t.id);
    await deleteTranscriptionAction(fd);
    setHistorial((prev) => prev.filter((x) => x.id !== t.id));
    // Si se estaba mirando la que se borró, el panel no puede quedar mostrando
    // algo que ya no existe.
    if (activaId === t.id) {
      setSegments(null);
      setActivaId(null);
      setEstado("vacio");
      setError(null);
      limpiarGuion();
    }
  }

  async function copiar(modo: "texto" | "tiempos") {
    if (!segments) return;
    await navigator.clipboard.writeText(
      modo === "texto" ? segmentsToPlainText(segments) : segmentsToTimestampedText(segments)
    );
    setCopiado(modo);
    setTimeout(() => setCopiado(null), 2000);
  }

  /**
   * Genera el guion. Se dispara SOLO desde el botón: cada generación cuesta una
   * llamada al modelo, y buena parte de las transcripciones se usan para otra
   * cosa (subtítulos, sacar una cita) sin necesitar un guion nuevo.
   */
  async function generarGuion(forzar = false) {
    if (!activaId || guionOcupado) return;

    // Regenerar pisa lo que el creador haya escrito a mano, así que se avisa
    // en vez de borrárselo de callado. La confirmación es en línea y no un
    // `window.confirm`: el diálogo nativo congela la automatización del
    // navegador con la que se prueba esta app.
    if (guionSucio && !forzar) {
      setConfirmarRegenerar(true);
      return;
    }
    setConfirmarRegenerar(false);

    setGuionEstado("generando");
    setGuionError(null);

    try {
      const res = await fetch("/api/ugc/transcribe/guion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activaId }),
      });

      let data: { improvedScript?: string; saved?: boolean; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error("La generación tardó demasiado y se cortó. Probá de nuevo.");
      }
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar el guion.");

      const texto = data.improvedScript ?? "";
      setGuion(texto);
      // Si el servidor no logró guardarlo, se deja marcado como sucio para que
      // el creador vea el botón de Guardar en vez de creer que ya quedó.
      setGuionGuardado(data.saved ? texto : "");
      setHistorial((prev) =>
        prev.map((t) => (t.id === activaId ? { ...t, improved_script: texto } : t))
      );
    } catch (err) {
      setGuionError(err instanceof Error ? err.message : "No se pudo generar el guion.");
    } finally {
      setGuionEstado("quieto");
    }
  }

  async function guardarGuion() {
    if (!activaId || guionOcupado) return;

    setGuionEstado("guardando");
    setGuionError(null);

    const result = await saveImprovedScriptAction(activaId, guion);

    if (result) {
      setGuionError(result.error);
    } else {
      setGuionGuardado(guion);
      setHistorial((prev) =>
        prev.map((t) => (t.id === activaId ? { ...t, improved_script: guion || null } : t))
      );
    }
    setGuionEstado("quieto");
  }

  async function copiarGuion() {
    if (!guion) return;
    await navigator.clipboard.writeText(guion);
    setGuionCopiado(true);
    setTimeout(() => setGuionCopiado(false), 2000);
  }

  return (
    <div className={styles.workspace}>
      {/* ---------------- Panel lateral: fuentes ---------------- */}
      <div
        className={`${styles.wsPanel} ${styles.wsPanelSide} ${
          ladoCerrado ? styles.wsPanelCollapsed : ""
        }`}
      >
        <div className={styles.wsHead}>
          <span className={styles.wsTitle}>Fuentes</span>
          <button
            type="button"
            onClick={() => setLadoCerrado(true)}
            className={styles.wsCollapseBtn}
            title="Esconder panel"
            aria-label="Esconder panel de fuentes"
          >
            <QosIcon name="chevL" size={15} />
          </button>
        </div>

        <div className={styles.wsBody}>
          <form onSubmit={transcribirUrl} className={styles.wsBodyPad}>
            <div className={styles.field}>
              <label>Link del video</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="youtube.com/watch?v=…"
                className={styles.inp}
                disabled={ocupado}
              />
            </div>
            <button
              type="submit"
              disabled={ocupado || !url.trim()}
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {estado === "procesando" ? "Transcribiendo…" : "Transcribir"}
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "14px 0 12px",
                color: "var(--ink-3)",
                fontSize: "11px",
              }}
            >
              <span style={{ flex: 1, height: "1px", background: "var(--line)" }} />o
              <span style={{ flex: 1, height: "1px", background: "var(--line)" }} />
            </div>

            {/* El input nativo se esconde y se dispara desde un botón de verdad:
                el control por defecto es casi invisible y ya costó una ronda de
                feedback en el book del creador. */}
            <input
              ref={inputArchivo}
              type="file"
              accept="video/*,audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void transcribirArchivo(f);
              }}
            />
            <button
              type="button"
              onClick={() => inputArchivo.current?.click()}
              disabled={ocupado}
              className={`${styles.btn} ${styles.btnSoft}`}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <QosIcon name="plus" size={15} />
              {estado === "subiendo" ? "Subiendo…" : "Subir un archivo"}
            </button>

            <p style={{ fontSize: "11.5px", color: "var(--ink-3)", marginTop: "10px", lineHeight: 1.5 }}>
              El link anda con YouTube y Shorts. <b>Instagram y TikTok no dejan leer sus videos
              desde afuera</b> — para esos, descargá el video y subilo acá. Hasta{" "}
              {pesoLegible(MAX_TRANSCRIPTION_FILE_BYTES)}.
            </p>
          </form>

          {historial.length > 0 && (
            <div className={styles.wsBodyPad} style={{ paddingTop: 0 }}>
              <div className={styles.navLabel} style={{ color: "var(--ink-3)", padding: "6px 0 8px" }}>
                Anteriores
              </div>
              {historial.map((t) => (
                <div
                  key={t.id}
                  className={`${styles.wsSource} ${activaId === t.id ? styles.wsSourceOn : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => abrirPrevia(t)}
                    title={t.source_url ?? t.file_name ?? ""}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      flex: 1,
                      minWidth: 0,
                      textAlign: "left",
                    }}
                  >
                    <QosIcon
                      name={t.status === "error" ? "alert" : t.file_name ? "film" : "doc"}
                      size={14}
                      className={styles.navIc}
                    />
                    <span className={styles.wsSourceName}>{nombreCorto(t)}</span>
                    <span className={styles.wsSourceMeta}>
                      {t.status === "error"
                        ? "falló"
                        : new Date(t.created_at).toLocaleDateString("es-CR", {
                            day: "numeric",
                            month: "short",
                          })}
                    </span>
                  </button>

                  <ConfirmDeleteButton
                    action={() => borrar(t)}
                    confirmMessage={`Se borra la transcripción de "${nombreCorto(t)}". No se puede deshacer.`}
                    className={styles.wsSourceDel}
                    // El title es la única pista de qué hace: el botón es un
                    // icono chico que solo aparece al pasar el mouse.
                    style={{ marginLeft: "4px" }}
                  >
                    <QosIcon name="x" size={13} />
                  </ConfirmDeleteButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Panel principal: transcripción ---------------- */}
      <div className={`${styles.wsPanel} ${styles.wsPanelMain}`}>
        <div className={styles.wsHead}>
          <span className={styles.wsTitle}>Transcripción</span>
          <span className={styles.wsStatus}>
            <span
              className={`${styles.wsDot} ${ocupado ? styles.wsDotLive : ""}`}
              style={{ background: ESTADO_COLOR[estado] }}
            />
            {ESTADO_TEXTO[estado]}
          </span>

          {segments && segments.length > 0 && (
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              <button
                type="button"
                onClick={() => copiar("texto")}
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              >
                {copiado === "texto" ? "Copiado" : "Copiar texto"}
              </button>
              <button
                type="button"
                onClick={() => copiar("tiempos")}
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              >
                {copiado === "tiempos" ? "Copiado" : "Con tiempos"}
              </button>
            </div>
          )}
        </div>

        {ladoCerrado && (
          <div className={styles.wsRestore}>
            <button
              type="button"
              onClick={() => setLadoCerrado(false)}
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            >
              <QosIcon name="chevR" size={13} /> Mostrar fuentes
            </button>
          </div>
        )}

        <div className={styles.wsBody}>
          {ocupado && (
            <div className={styles.wsBodyPad} style={{ padding: "20px" }}>
              {[110, 190, 140, 170, 95, 160, 130].map((w, i) => (
                <div key={i} className={styles.wsSegment}>
                  <div className={styles.wsSkel} style={{ width: "28px", flexShrink: 0 }} />
                  <div className={styles.wsSkel} style={{ width: `${w}px` }} />
                </div>
              ))}
            </div>
          )}

          {!ocupado && error && (
            <div className={styles.wsEmpty}>
              <QosIcon name="alert" size={26} />
              <p style={{ color: "var(--risk)", fontSize: "13.5px", maxWidth: "42ch" }}>{error}</p>
            </div>
          )}

          {!ocupado && !error && !segments && (
            <div className={styles.wsEmpty}>
              <QosIcon name="doc" size={26} />
              <p>Pegá un link o subí un archivo a la izquierda.</p>
            </div>
          )}

          {!ocupado && segments && segments.length > 0 && (
            <div className={styles.wsBodyPad} style={{ padding: "20px 24px", maxWidth: "72ch" }}>
              {segments.map((s, i) => (
                <div key={i} className={styles.wsSegment}>
                  <span className={styles.wsTime}>{s.timestamp}</span>
                  <span className={styles.wsText}>{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Panel de guion mejorado ---------------- */}
      <div className={`${styles.wsPanel} ${styles.wsPanelScript}`}>
        <div className={styles.wsHead}>
          <span className={styles.wsTitle}>Guion mejorado</span>
          {guionSucio && guion && <span className={styles.wsScriptDirty}>sin guardar</span>}

          {guion && (
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              <button
                type="button"
                onClick={copiarGuion}
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              >
                {guionCopiado ? "Copiado" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={guardarGuion}
                disabled={guionOcupado || !guionSucio}
                className={`${styles.btn} ${guionSucio ? styles.btnPrimary : styles.btnGhost} ${styles.btnSm}`}
              >
                {guionEstado === "guardando" ? "Guardando…" : "Guardar"}
              </button>
            </div>
          )}
        </div>

        {/* Confirmación en línea: regenerar pisa lo que el creador escribió. */}
        {confirmarRegenerar && (
          <div className={styles.wsRestore}>
            <span style={{ fontSize: "12px", color: "var(--ink-2)" }}>
              Se pierden tus cambios sin guardar.
            </span>
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              <button
                type="button"
                onClick={() => setConfirmarRegenerar(false)}
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => generarGuion(true)}
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
              >
                Regenerar igual
              </button>
            </div>
          </div>
        )}

        <div className={styles.wsBody}>
          {guionEstado === "generando" && (
            <div className={styles.wsBodyPad} style={{ padding: "20px 24px" }}>
              {[180, 240, 140, 220, 200, 120, 210, 160].map((w, i) => (
                <div key={i} className={styles.wsSegment}>
                  <div className={styles.wsSkel} style={{ width: `${w}px` }} />
                </div>
              ))}
            </div>
          )}

          {guionEstado !== "generando" && guionError && (
            <div className={styles.wsEmpty}>
              <QosIcon name="alert" size={26} />
              <p style={{ color: "var(--risk)", fontSize: "13.5px", maxWidth: "40ch" }}>
                {guionError}
              </p>
              <button
                type="button"
                onClick={() => generarGuion(true)}
                className={`${styles.btn} ${styles.btnSoft} ${styles.btnSm}`}
              >
                Probar de nuevo
              </button>
            </div>
          )}

          {/* Estado vacío: el guion NO se genera solo al terminar de transcribir.
              Cada generación cuesta una llamada al modelo y la mayoría de las
              transcripciones se usan para otra cosa, así que se pide a mano. */}
          {guionEstado !== "generando" && !guionError && !guion && (
            <div className={styles.wsEmpty}>
              <QosIcon name="doc" size={26} />
              {activaId && estado === "listo" ? (
                <>
                  <p style={{ maxWidth: "38ch" }}>
                    Tomá esta transcripción y convertila en un guion listo para volver a grabar:
                    gancho, estructura y cierre.
                  </p>
                  <button
                    type="button"
                    onClick={() => generarGuion()}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    Generar guion
                  </button>
                </>
              ) : (
                <p style={{ maxWidth: "38ch" }}>
                  Primero transcribí un video. Después vas a poder generar el guion mejorado desde acá.
                </p>
              )}
            </div>
          )}

          {guionEstado !== "generando" && guion && (
            <textarea
              value={guion}
              onChange={(e) => setGuion(e.target.value)}
              className={styles.wsScriptArea}
              spellCheck={false}
              aria-label="Guion mejorado"
            />
          )}
        </div>

        {guion && guionEstado !== "generando" && (
          <div className={styles.wsRestore} style={{ borderBottom: "none", borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => generarGuion()}
              disabled={guionOcupado}
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            >
              Generar de nuevo
            </button>
            {guionError && (
              <span style={{ fontSize: "11.5px", color: "var(--risk)", marginLeft: "auto" }}>
                {guionError}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
