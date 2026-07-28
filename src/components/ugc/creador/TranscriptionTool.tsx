"use client";

import { useState } from "react";
import type { Database } from "@/lib/database.types";
import {
  segmentsToPlainText,
  segmentsToTimestampedText,
  type TranscriptionSegment,
} from "@/lib/ugc/transcription";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type Fila = Database["public"]["Tables"]["creator_transcriptions"]["Row"];

type Estado = "vacio" | "procesando" | "listo" | "error";

const ESTADO_COLOR: Record<Estado, string> = {
  vacio: "var(--ink-3)",
  procesando: "var(--warn)",
  listo: "var(--ok)",
  error: "var(--risk)",
};

const ESTADO_TEXTO: Record<Estado, string> = {
  vacio: "sin transcribir",
  procesando: "transcribiendo…",
  listo: "listo",
  error: "falló",
};

/** El link entero no entra en 320px: se muestra la parte que identifica. */
function nombreCorto(url: string): string {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("v");
    if (id) return `youtube · ${id}`;
    return u.hostname.replace(/^www\./, "") + u.pathname.slice(0, 22);
  } catch {
    return url.slice(0, 34);
  }
}

export default function TranscriptionTool({ previas }: { previas: Fila[] }) {
  const [url, setUrl] = useState("");
  const [estado, setEstado] = useState<Estado>("vacio");
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[] | null>(null);
  const [copiado, setCopiado] = useState<"texto" | "tiempos" | null>(null);
  const [historial, setHistorial] = useState(previas);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [ladoCerrado, setLadoCerrado] = useState(false);

  const procesando = estado === "procesando";

  async function transcribir(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || procesando) return;

    setEstado("procesando");
    setError(null);
    setSegments(null);
    setActivaId(null);

    try {
      const res = await fetch("/api/ugc/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      // La respuesta puede no ser JSON si la función se cortó por tiempo: ahí
      // el body viene vacío o con el HTML de error de la plataforma.
      let data: { id?: string; segments?: TranscriptionSegment[]; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error("El video tardó demasiado y se cortó. Probá con uno más corto.");
      }

      if (!res.ok) throw new Error(data.error ?? "No se pudo transcribir.");

      setSegments(data.segments ?? []);
      setActivaId(data.id ?? null);
      setEstado("listo");
      setUrl("");

      const nuevas = await fetch("/api/ugc/transcribe/historial").catch(() => null);
      if (nuevas?.ok) setHistorial(await nuevas.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo transcribir.");
      setEstado("error");
    }
  }

  function abrirPrevia(t: Fila) {
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

  async function copiar(modo: "texto" | "tiempos") {
    if (!segments) return;
    await navigator.clipboard.writeText(
      modo === "texto" ? segmentsToPlainText(segments) : segmentsToTimestampedText(segments)
    );
    setCopiado(modo);
    setTimeout(() => setCopiado(null), 2000);
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
          <form onSubmit={transcribir} className={styles.wsBodyPad}>
            <div className={styles.field}>
              <label>Link del video</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="youtube.com/watch?v=…"
                className={styles.inp}
                disabled={procesando}
              />
            </div>
            <button
              type="submit"
              disabled={procesando || !url.trim()}
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {procesando ? "Transcribiendo…" : "Transcribir"}
            </button>
            <p style={{ fontSize: "11.5px", color: "var(--ink-3)", marginTop: "10px", lineHeight: 1.5 }}>
              Anda con YouTube y Shorts. Instagram y TikTok bloquean el acceso desde afuera — si
              falla, subilo a YouTube como <b>no listado</b>.
            </p>
          </form>

          {historial.length > 0 && (
            <div className={styles.wsBodyPad} style={{ paddingTop: 0 }}>
              <div className={styles.navLabel} style={{ color: "var(--ink-3)", padding: "6px 0 8px" }}>
                Anteriores
              </div>
              {historial.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => abrirPrevia(t)}
                  className={`${styles.wsSource} ${activaId === t.id ? styles.wsSourceOn : ""}`}
                  title={t.source_url}
                >
                  <QosIcon
                    name={t.status === "error" ? "alert" : "doc"}
                    size={14}
                    className={styles.navIc}
                  />
                  <span className={styles.wsSourceName}>{nombreCorto(t.source_url)}</span>
                  <span className={styles.wsSourceMeta}>
                    {t.status === "error"
                      ? "falló"
                      : new Date(t.created_at).toLocaleDateString("es-CR", {
                          day: "numeric",
                          month: "short",
                        })}
                  </span>
                </button>
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
              className={`${styles.wsDot} ${procesando ? styles.wsDotLive : ""}`}
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
          {procesando && (
            <div className={styles.wsBodyPad} style={{ padding: "20px" }}>
              {[110, 190, 140, 170, 95, 160, 130].map((w, i) => (
                <div key={i} className={styles.wsSegment}>
                  <div className={styles.wsSkel} style={{ width: "28px", flexShrink: 0 }} />
                  <div className={styles.wsSkel} style={{ width: `${w}px` }} />
                </div>
              ))}
            </div>
          )}

          {!procesando && error && (
            <div className={styles.wsEmpty}>
              <QosIcon name="alert" size={26} />
              <p style={{ color: "var(--risk)", fontSize: "13.5px", maxWidth: "40ch" }}>{error}</p>
            </div>
          )}

          {!procesando && !error && !segments && (
            <div className={styles.wsEmpty}>
              <QosIcon name="doc" size={26} />
              <p>Pegá un link a la izquierda y la transcripción aparece acá.</p>
            </div>
          )}

          {!procesando && segments && segments.length > 0 && (
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
    </div>
  );
}
