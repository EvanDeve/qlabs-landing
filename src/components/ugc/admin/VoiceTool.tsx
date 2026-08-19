"use client";

import { useEffect, useRef, useState } from "react";
import { deleteVoiceoverAction } from "@/lib/actions/voiceovers";
import {
  MAX_VOICEOVER_CHARS,
  MODELOS_DE_VOZ,
  MODELO_POR_DEFECTO,
  VOICEOVER_TTL_DIAS,
  creditosDe,
  diasParaVencer,
  limpiarGuionParaVoz,
  motivoDeRechazo,
  tituloDeGuion,
} from "@/lib/ugc/voz";
import { QosIcon } from "@/lib/ugc/qos-icons";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import styles from "@/styles/qos.module.css";

/**
 * Lo que la pantalla necesita de un voiceover. Es una forma propia y no la Row
 * de la base a propósito: así la respuesta de la ruta y las filas que vienen
 * del servidor entran por el mismo molde, sin inventar campos vacíos para
 * columnas que acá no se usan (owner_id, storage_path).
 */
export type VoiceoverUI = {
  id: string;
  text: string;
  voiceName: string;
  modelId: string;
  charCount: number;
  status: "processing" | "done" | "error";
  errorMessage: string | null;
  createdAt: string;
  expiresAt: string;
  url: string | null;
};

export type GuionDisponible = { id: string; nombre: string; texto: string };

type Voz = { id: string; nombre: string; preview: string | null; categoria: string | null };

type Estado = "vacio" | "generando" | "listo" | "error";

const ESTADO_COLOR: Record<Estado, string> = {
  vacio: "var(--ink-3)",
  generando: "var(--warn)",
  listo: "var(--ok)",
  error: "var(--risk)",
};

const ESTADO_TEXTO: Record<Estado, string> = {
  vacio: "sin generar",
  generando: "generando voz…",
  listo: "listo",
  error: "falló",
};

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

/** Supabase fuerza la descarga con `?download=`; el atributo `download` de un
 *  <a> lo ignora el navegador cuando el archivo vive en otro dominio. */
function linkDeDescarga(url: string, nombre: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(nombre)}`;
}

export default function VoiceTool({
  previos,
  guiones,
}: {
  previos: VoiceoverUI[];
  guiones: GuionDisponible[];
}) {
  const [texto, setTexto] = useState("");
  const [transcripcionId, setTranscripcionId] = useState<string | null>(null);
  const [voces, setVoces] = useState<Voz[]>([]);
  const [vocesError, setVocesError] = useState<string | null>(null);
  const [vozId, setVozId] = useState("");
  const [modelId, setModelId] = useState(MODELO_POR_DEFECTO);
  const [estado, setEstado] = useState<Estado>("vacio");
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState<VoiceoverUI | null>(null);
  const [historial, setHistorial] = useState(previos);
  const [mostrarGuiones, setMostrarGuiones] = useState(false);
  const [ladoCerrado, setLadoCerrado] = useState(false);
  /** Caracteres que la limpieza le sacó al último guion traído. Se avisa para
   *  que nadie crea que se perdió texto por un bug. */
  const [quitados, setQuitados] = useState(0);

  // Voz por id: para usar una que no está en la cuenta (Voice Library, o una
  // clonada que se comparte por id).
  const [modoId, setModoId] = useState(false);
  const [idManual, setIdManual] = useState("");
  const [buscandoId, setBuscandoId] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);

  // La muestra de la voz se reproduce con un Audio suelto en vez de un <audio>
  // en el árbol: es un sonido de paso, no parte de la pantalla. La ref existe
  // para poder cortar la anterior cuando se prueba otra voz.
  const muestra = useRef<HTMLAudioElement | null>(null);

  const generando = estado === "generando";
  const rechazo = motivoDeRechazo(texto);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const res = await fetch("/api/qos/voz/voces");
        const data = (await res.json()) as { voces?: Voz[]; error?: string };
        if (!vivo) return;
        if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las voces.");
        setVoces(data.voces ?? []);
        setVozId((prev) => prev || data.voces?.[0]?.id || "");
      } catch (err) {
        if (vivo) setVocesError(err instanceof Error ? err.message : "No se pudieron cargar las voces.");
      }
    })();

    return () => {
      vivo = false;
      muestra.current?.pause();
    };
  }, []);

  function escucharMuestra() {
    const voz = voces.find((v) => v.id === vozId);
    if (!voz?.preview) return;
    muestra.current?.pause();
    muestra.current = new Audio(voz.preview);
    void muestra.current.play().catch(() => {
      // Un navegador que bloquea el autoplay no es un error que valga la pena
      // mostrarle a nadie: el usuario ya está tocando un botón, y si igual lo
      // bloquea, no hay nada que él pueda hacer al respecto.
    });
  }

  /**
   * Resuelve el id pegado contra ElevenLabs y lo suma a la lista.
   *
   * Se busca en vez de mandarlo a ciegas por dos razones: valida que exista
   * ANTES de pagar una generación, y trae la muestra para poder escucharla.
   * Una vez sumado, la voz se comporta como cualquier otra del desplegable.
   */
  async function buscarPorId() {
    const id = idManual.trim();
    if (!id || buscandoId) return;

    setBuscandoId(true);
    setErrorId(null);

    try {
      const res = await fetch(`/api/qos/voz/voces?id=${encodeURIComponent(id)}`);
      const data = (await res.json()) as { voz?: Voz; error?: string };
      if (!res.ok || !data.voz) throw new Error(data.error ?? "No se encontró esa voz.");

      const voz = data.voz;
      setVoces((prev) => [voz, ...prev.filter((v) => v.id !== voz.id)]);
      setVozId(voz.id);
      setModoId(false);
      setIdManual("");
    } catch (err) {
      setErrorId(err instanceof Error ? err.message : "No se encontró esa voz.");
    } finally {
      setBuscandoId(false);
    }
  }

  function usarGuion(g: GuionDisponible) {
    // El guion mejorado es de RODAJE: trae tiempos y acotaciones de cámara que
    // no se dicen en voz alta. Se limpia acá, al traerlo, para que lo que se ve
    // en pantalla sea exactamente lo que se va a escuchar y lo que se cobra.
    const limpio = limpiarGuionParaVoz(g.texto);
    setTexto(limpio);
    setTranscripcionId(g.id);
    setMostrarGuiones(false);
    setError(null);
    setQuitados(g.texto.length - limpio.length);
  }

  async function generar() {
    if (generando || rechazo || !vozId) return;

    setEstado("generando");
    setError(null);

    try {
      const res = await fetch("/api/qos/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: texto,
          voiceId: vozId,
          voiceName: voces.find((v) => v.id === vozId)?.nombre ?? "",
          modelId,
          transcriptionId: transcripcionId,
        }),
      });

      // La respuesta puede no ser JSON si la función se cortó por tiempo: ahí
      // llega vacía o con el HTML de error de la plataforma.
      let data: {
        id?: string;
        url?: string | null;
        expiresAt?: string;
        createdAt?: string;
        voiceName?: string;
        modelId?: string;
        charCount?: number;
        error?: string;
      };
      try {
        data = await res.json();
      } catch {
        throw new Error("La generación tardó demasiado y se cortó. Probá con un texto más corto.");
      }
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar la voz.");

      const nuevo: VoiceoverUI = {
        id: data.id!,
        text: texto,
        voiceName: data.voiceName ?? "",
        modelId: data.modelId ?? modelId,
        charCount: data.charCount ?? texto.length,
        status: "done",
        errorMessage: null,
        createdAt: data.createdAt ?? new Date().toISOString(),
        expiresAt: data.expiresAt!,
        url: data.url ?? null,
      };

      setActual(nuevo);
      setHistorial((prev) => [nuevo, ...prev]);
      setEstado("listo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la voz.");
      setEstado("error");
    }
  }

  function abrirPrevio(v: VoiceoverUI) {
    // Se recupera también el texto: la razón más común para abrir uno viejo es
    // volver a generarlo con otra voz, y tener que ir a buscar el guion a otro
    // lado convertiría eso en un viaje de ida y vuelta.
    setTexto(v.text);
    setTranscripcionId(null);
    setActual(v);
    setError(v.status === "error" ? v.errorMessage : null);
    setEstado(v.status === "error" ? "error" : "listo");
  }

  async function borrar(v: VoiceoverUI) {
    await deleteVoiceoverAction(v.id);
    setHistorial((prev) => prev.filter((x) => x.id !== v.id));
    if (actual?.id === v.id) {
      setActual(null);
      setEstado("vacio");
      setError(null);
    }
  }

  const vozElegida = voces.find((v) => v.id === vozId);
  const creditos = creditosDe(texto, modelId);

  return (
    <div className={styles.workspace}>
      {/* ---------------- Panel lateral: anteriores ---------------- */}
      <div
        className={`${styles.wsPanel} ${styles.wsPanelSide} ${
          ladoCerrado ? styles.wsPanelCollapsed : ""
        }`}
      >
        <div className={styles.wsHead}>
          <span className={styles.wsTitle}>Anteriores</span>
          <button
            type="button"
            onClick={() => setLadoCerrado(true)}
            className={styles.wsCollapseBtn}
            title="Esconder panel"
            aria-label="Esconder panel de anteriores"
          >
            <QosIcon name="chevL" size={15} />
          </button>
        </div>

        <div className={styles.wsBody}>
          {historial.length === 0 && (
            <p
              className={styles.wsBodyPad}
              style={{ fontSize: "12.5px", color: "var(--ink-3)", lineHeight: 1.5 }}
            >
              Todavía no generaste ninguna voz. Las que hagas quedan acá {VOICEOVER_TTL_DIAS} días
              para poder reescucharlas sin volver a gastar créditos.
            </p>
          )}

          {historial.length > 0 && (
            <div className={styles.wsBodyPad}>
              {historial.map((v) => (
                <div
                  key={v.id}
                  className={`${styles.wsSource} ${actual?.id === v.id ? styles.wsSourceOn : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => abrirPrevio(v)}
                    title={v.text.slice(0, 200)}
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
                      name={v.status === "error" ? "alert" : "play"}
                      size={14}
                      className={styles.navIc}
                    />
                    <span className={styles.wsSourceName}>{tituloDeGuion(v.text)}</span>
                    <span className={styles.wsSourceMeta}>
                      {v.status === "error" ? "falló" : fechaCorta(v.createdAt)}
                    </span>
                  </button>

                  <ConfirmDeleteButton
                    action={() => borrar(v)}
                    confirmMessage={`Se borra el audio de "${tituloDeGuion(v.text)}". No se puede deshacer, y volver a generarlo gasta créditos otra vez.`}
                    className={styles.wsSourceDel}
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

      {/* ---------------- Panel principal: el guion ---------------- */}
      <div className={`${styles.wsPanel} ${styles.wsPanelMain}`}>
        <div className={styles.wsHead}>
          <span className={styles.wsTitle}>Guion</span>
          <span
            className={styles.wsStatus}
            style={{ color: texto.length > MAX_VOICEOVER_CHARS ? "var(--risk)" : undefined }}
          >
            {texto.length} / {MAX_VOICEOVER_CHARS}
          </span>

          {guiones.length > 0 && (
            <button
              type="button"
              onClick={() => setMostrarGuiones((v) => !v)}
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              style={{ marginLeft: "auto" }}
            >
              <QosIcon name="doc" size={13} /> Traer un guion
            </button>
          )}
        </div>

        {ladoCerrado && (
          <div className={styles.wsRestore}>
            <button
              type="button"
              onClick={() => setLadoCerrado(false)}
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
            >
              <QosIcon name="chevR" size={13} /> Mostrar anteriores
            </button>
          </div>
        )}

        {/* Los guiones ya mejorados en la herramienta de transcripción. Es el
            camino que cierra el círculo transcribir → mejorar → locutar. */}
        {mostrarGuiones && (
          <div className={styles.wsRestore} style={{ display: "block", padding: "10px 16px" }}>
            {guiones.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => usarGuion(g)}
                className={styles.wsSource}
                style={{ background: "transparent" }}
              >
                <QosIcon name="doc" size={13} className={styles.navIc} />
                <span className={styles.wsSourceName}>{g.nombre}</span>
                <span className={styles.wsSourceMeta}>
                  {g.texto.length} car.
                </span>
              </button>
            ))}
          </div>
        )}

        <div className={styles.wsBody}>
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              // Escribir a mano encima de un guion traído corta el vínculo: lo
              // que se va a locutar ya no es aquel guion.
              if (transcripcionId) setTranscripcionId(null);
              // El aviso de la limpieza deja de ser cierto apenas se edita.
              if (quitados) setQuitados(0);
            }}
            className={styles.wsScriptArea}
            spellCheck={false}
            placeholder="Pegá acá el guion que querés escuchar en voz alta. Los puntos y las comas marcan las pausas, así que puntuar bien es lo que más cambia cómo suena."
            aria-label="Texto para convertir en voz"
          />
        </div>

        {/* Controles al pie: la decisión de voz y modelo se toma justo antes de
            apretar generar, no al principio. */}
        <div
          className={styles.wsBodyPad}
          style={{ borderTop: "1px solid var(--line)", flexShrink: 0 }}
        >
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className={styles.field} style={{ flex: 1, minWidth: "200px", marginBottom: 0 }}>
              <label htmlFor="voz">Voz</label>

              {modoId ? (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="voz"
                    value={idManual}
                    onChange={(e) => setIdManual(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void buscarPorId();
                      }
                    }}
                    className={styles.inp}
                    placeholder="Pegá el Voice ID"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={buscarPorId}
                    disabled={buscandoId || !idManual.trim()}
                    className={`${styles.btn} ${styles.btnSoft}`}
                  >
                    {buscandoId ? "Buscando…" : "Buscar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoId(false);
                      setErrorId(null);
                    }}
                    className={`${styles.btn} ${styles.btnGhost}`}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <select
                    id="voz"
                    value={vozId}
                    onChange={(e) => setVozId(e.target.value)}
                    className={styles.inp}
                    disabled={voces.length === 0}
                  >
                    {voces.length === 0 && <option>{vocesError ? "sin voces" : "cargando…"}</option>}
                    {voces.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nombre}
                        {v.categoria && v.categoria !== "premade" ? ` · ${v.categoria}` : ""}
                      </option>
                    ))}
                  </select>

                  {/* Escuchar la muestra no gasta créditos: es la forma de elegir
                      voz sin pagar una generación para descubrir que no era. */}
                  <button
                    type="button"
                    onClick={escucharMuestra}
                    disabled={!vozElegida?.preview}
                    title="Escuchar una muestra de esta voz"
                    className={`${styles.btn} ${styles.btnGhost}`}
                  >
                    <QosIcon name="play" size={14} />
                  </button>

                  {/* Para usar una voz que no está en la cuenta: la Voice
                      Library, o una clonada que alguien compartió por id. */}
                  <button
                    type="button"
                    onClick={() => setModoId(true)}
                    title="Usar una voz por su Voice ID de ElevenLabs"
                    className={`${styles.btn} ${styles.btnGhost}`}
                  >
                    ID
                  </button>
                </div>
              )}
            </div>

            <div className={styles.field} style={{ marginBottom: 0 }}>
              <label>Modelo</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {MODELOS_DE_VOZ.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModelId(m.id)}
                    title={m.detalle}
                    className={`${styles.btn} ${modelId === m.id ? styles.btnSoft : styles.btnGhost}`}
                  >
                    {m.nombre}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={generar}
              disabled={generando || Boolean(rechazo) || !vozId}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              {generando ? "Generando…" : "Generar voz"}
            </button>
          </div>

          <p style={{ fontSize: "11.5px", color: "var(--ink-3)", marginTop: "10px", lineHeight: 1.5 }}>
            {quitados > 0 && (
              <>
                <b style={{ color: "var(--warn)" }}>
                  Se le quitaron {quitados} caracteres de tiempos y acotaciones
                </b>{" "}
                — eso no se dice en voz alta. Revisalo antes de generar.
                <br />
              </>
            )}
            {errorId ? (
              <span style={{ color: "var(--risk)" }}>{errorId}</span>
            ) : vocesError ? (
              <span style={{ color: "var(--risk)" }}>{vocesError}</span>
            ) : texto.trim() ? (
              <>
                Cuesta <b>{creditos} créditos</b> de ElevenLabs. El audio se
                borra solo a los {VOICEOVER_TTL_DIAS} días: si lo vas a usar, descargalo.
              </>
            ) : (
              <>
                {MODELOS_DE_VOZ[1].nombre} gasta la mitad de créditos que {MODELOS_DE_VOZ[0].nombre}:
                sirve para probar cómo queda antes de generar la definitiva.
              </>
            )}
          </p>
        </div>
      </div>

      {/* ---------------- Panel de la voz ---------------- */}
      <div className={`${styles.wsPanel} ${styles.wsPanelScript}`}>
        <div className={styles.wsHead}>
          <span className={styles.wsTitle}>Voz</span>
          <span className={styles.wsStatus}>
            <span
              className={`${styles.wsDot} ${generando ? styles.wsDotLive : ""}`}
              style={{ background: ESTADO_COLOR[estado] }}
            />
            {ESTADO_TEXTO[estado]}
          </span>

          {actual?.url && !generando && (
            <a
              href={linkDeDescarga(actual.url, `voz-${tituloDeGuion(actual.text).slice(0, 24)}.mp3`)}
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              style={{ marginLeft: "auto" }}
            >
              <QosIcon name="drive" size={13} /> Descargar
            </a>
          )}
        </div>

        <div className={styles.wsBody}>
          {generando && (
            <div className={styles.wsEmpty}>
              <QosIcon name="play" size={26} />
              <p style={{ maxWidth: "34ch" }}>
                Generando el audio. Un guion normal tarda unos segundos.
              </p>
            </div>
          )}

          {!generando && error && (
            <div className={styles.wsEmpty}>
              <QosIcon name="alert" size={26} />
              <p style={{ color: "var(--risk)", fontSize: "13.5px", maxWidth: "40ch" }}>{error}</p>
              <button
                type="button"
                onClick={generar}
                disabled={Boolean(rechazo) || !vozId}
                className={`${styles.btn} ${styles.btnSoft} ${styles.btnSm}`}
              >
                Probar de nuevo
              </button>
            </div>
          )}

          {!generando && !error && !actual && (
            <div className={styles.wsEmpty}>
              <QosIcon name="play" size={26} />
              <p style={{ maxWidth: "36ch" }}>
                {rechazo && texto
                  ? rechazo
                  : "Escribí o traé un guion, elegí la voz y generá. El audio aparece acá."}
              </p>
            </div>
          )}

          {!generando && !error && actual && (
            <div className={styles.wsBodyPad} style={{ padding: "20px 24px" }}>
              {actual.url ? (
                <audio
                  controls
                  src={actual.url}
                  style={{ width: "100%" }}
                  aria-label="Voiceover generado"
                />
              ) : (
                <p style={{ fontSize: "13px", color: "var(--ink-3)" }}>
                  El link de este audio venció. Recargá la página para volver a escucharlo.
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px 14px",
                  margin: "16px 0",
                  fontSize: "11.5px",
                  color: "var(--ink-3)",
                }}
              >
                <span>{actual.voiceName}</span>
                <span>{actual.charCount} caracteres</span>
                <span>
                  se borra en {diasParaVencer(actual.expiresAt)}{" "}
                  {diasParaVencer(actual.expiresAt) === 1 ? "día" : "días"}
                </span>
              </div>

              <p
                className={styles.wsText}
                style={{ fontSize: "13px", whiteSpace: "pre-wrap", color: "var(--ink-2)" }}
              >
                {actual.text}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
