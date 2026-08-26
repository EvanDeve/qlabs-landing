"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/database.types";
import {
  deleteTranscriptionAction,
  renombrarTranscripcionAction,
  saveImprovedScriptAction,
} from "@/lib/actions/transcriptions";
import {
  contarPalabras,
  duracionLegible,
  idiomaLegible,
  nombreDeTranscripcion,
  segmentsToTimestampedText,
} from "@/lib/ugc/transcription";
import { parsearGuion, nombreDeArchivoDeGuion } from "@/lib/ugc/guion";
import { QosIcon } from "@/lib/ugc/qos-icons";
import Hoja from "@/components/ugc/creador/Hoja";
import styles from "@/styles/qos.module.css";

type Fila = Database["public"]["Tables"]["creator_transcriptions"]["Row"];

const VOLVER = "/ugc/creador/transcripcion";

export default function TranscripcionDetalle({ fila }: { fila: Fila }) {
  const router = useRouter();
  const [pestana, setPestana] = useState<"texto" | "guion">("texto");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [guion, setGuion] = useState(fila.improved_script ?? "");
  const [generando, setGenerando] = useState(false);
  const [guionError, setGuionError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Las dos hojas del menú.
  const [renombrando, setRenombrando] = useState(false);
  const [editando, setEditando] = useState(false);

  const segments = fila.segments ?? [];
  const titulo = nombreDeTranscripcion(fila);
  const parseado = parsearGuion(guion);

  /* El cierre al tocar afuera va con listener en `document` y no con un fondo
     invisible a pantalla completa: el fondo se come el primer toque de
     cualquier cosa que esté debajo. Mismo criterio que los filtros del
     Pipeline. */
  useEffect(() => {
    if (!menuAbierto) return;
    function afuera(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false);
    }
    document.addEventListener("mousedown", afuera);
    return () => document.removeEventListener("mousedown", afuera);
  }, [menuAbierto]);

  async function copiar(texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  /**
   * Genera el guion. Se dispara SOLO desde el botón: cada generación cuesta una
   * llamada al modelo, y buena parte de las transcripciones se usan para otra
   * cosa —subtítulos, sacar una cita— sin necesitar un guion nuevo.
   */
  async function generarGuion() {
    if (generando) return;
    setGenerando(true);
    setGuionError(null);
    setPestana("guion");

    try {
      const res = await fetch("/api/ugc/transcribe/guion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fila.id }),
      });

      let data: { improvedScript?: string; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error("La generación tardó demasiado y se cortó. Probá de nuevo.");
      }
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar el guion.");
      setGuion(data.improvedScript ?? "");
    } catch (err) {
      setGuionError(err instanceof Error ? err.message : "No se pudo generar el guion.");
    } finally {
      setGenerando(false);
    }
  }

  /**
   * Descarga el guion como .txt.
   *
   * Es un `<a download>` armado con un blob y no un link a Storage: el guion ya
   * está acá en memoria y guardarlo en el bucket para poder bajarlo sería
   * gastar el almacenamiento —que es el primer techo del proyecto— en un
   * archivo de dos KB que se puede armar en el navegador.
   */
  function descargarGuion() {
    const blob = new Blob([guion], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreDeArchivoDeGuion(titulo);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.trCol}>
      <div className={styles.trDetBar}>
        <Link href={VOLVER} className={styles.trAtras}>
          <QosIcon name="chevL" size={17} />
          Atrás
        </Link>
        <span className={styles.trDetTit}>{titulo}</span>

        <div className={styles.trMenuWrap} ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            className={styles.trMenuBtn}
            aria-label="Más acciones"
            aria-expanded={menuAbierto}
          >
            <QosIcon name="dots" size={18} />
          </button>

          {menuAbierto && (
            <div className={styles.trMenu} role="menu">
              <button
                type="button"
                className={styles.trMenuItem}
                onClick={() => {
                  setMenuAbierto(false);
                  setRenombrando(true);
                }}
              >
                <QosIcon name="pencil" size={15} />
                Cambiar el nombre
              </button>

              {/* Editar el guion a mano existía desde que el guion existe y no
                  se sacó: se mudó acá para que la vista de lectura sea lo
                  primero que se ve. Lo que se edita es el texto crudo, con sus
                  encabezados — al guardar se vuelve a dibujar en bloques. */}
              {guion && (
                <button
                  type="button"
                  className={styles.trMenuItem}
                  onClick={() => {
                    setMenuAbierto(false);
                    setEditando(true);
                  }}
                >
                  <QosIcon name="doc" size={15} />
                  Editar el guion
                </button>
              )}

              {guion && (
                <button
                  type="button"
                  className={styles.trMenuItem}
                  onClick={() => {
                    setMenuAbierto(false);
                    void generarGuion();
                  }}
                >
                  <QosIcon name="sparkle" size={15} />
                  Generar de nuevo
                </button>
              )}

              <button
                type="button"
                className={`${styles.trMenuItem} ${styles.trMenuMal}`}
                onClick={() => {
                  setMenuAbierto(false);
                  const fd = new FormData();
                  fd.set("id", fila.id);
                  fd.set("volverA", VOLVER);
                  void deleteTranscriptionAction(fd);
                }}
              >
                <QosIcon name="x" size={15} />
                Borrar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.trTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "texto"}
          onClick={() => setPestana("texto")}
          className={`${styles.trTabBtn} ${pestana === "texto" ? styles.trTabOn : ""}`}
        >
          Transcripción
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === "guion"}
          onClick={() => setPestana("guion")}
          className={`${styles.trTabBtn} ${pestana === "guion" ? styles.trTabOn : ""}`}
        >
          Guion mejorado
        </button>
      </div>

      {pestana === "texto" ? (
        <PanelTranscripcion fila={fila} />
      ) : (
        <PanelGuion
          parseado={parseado}
          generando={generando}
          error={guionError}
          hayTranscripcion={fila.status === "done" && segments.length > 0}
          onGenerar={generarGuion}
        />
      )}

      <div className={styles.trPieAire} />
      <div className={styles.trPie}>
        {pestana === "texto" ? (
          <>
            <button
              type="button"
              onClick={() => copiar(segmentsToTimestampedText(segments))}
              disabled={segments.length === 0}
              className={styles.trPieRedondo}
              aria-label="Copiar la transcripción con tiempos"
              title="Copiar con tiempos"
            >
              <QosIcon name="copy" size={18} />
            </button>
            <button
              type="button"
              onClick={generarGuion}
              disabled={generando || fila.status !== "done" || segments.length === 0}
              className={styles.trPiePill}
            >
              <QosIcon name="sparkle" size={16} />
              {generando ? "Armando…" : guion ? "Ver mi guion" : "Armar mi guion"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={descargarGuion}
              disabled={!guion}
              className={styles.trPieRedondo}
              aria-label="Descargar el guion"
              title="Descargar el guion"
            >
              <QosIcon name="download" size={18} />
            </button>
            <button
              type="button"
              onClick={() => copiar(guion)}
              disabled={!guion}
              className={styles.trPiePill}
            >
              <QosIcon name="copy" size={16} />
              {copiado ? "Copiado" : "Copiar el guion"}
            </button>
          </>
        )}
      </div>

      {renombrando && (
        <HojaDeNombre
          id={fila.id}
          actual={fila.title ?? ""}
          onClose={() => setRenombrando(false)}
          onListo={() => {
            setRenombrando(false);
            router.refresh();
          }}
        />
      )}

      {editando && (
        <HojaDeGuion
          id={fila.id}
          actual={guion}
          onClose={() => setEditando(false)}
          onGuardado={(texto) => {
            setGuion(texto);
            setEditando(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Pestaña 1: la transcripción ---------------- */

function PanelTranscripcion({ fila }: { fila: Fila }) {
  const segments = fila.segments ?? [];

  if (fila.status === "error") {
    return (
      <div className={styles.trVacio}>
        <QosIcon name="alert" size={26} className={styles.trVacioIc} />
        <p className={styles.trVacioTxt}>
          {fila.error_message ?? "Esta transcripción no se completó."}
        </p>
      </div>
    );
  }

  // Una fila que quedó en 'processing' es la que se transcribía cuando alguien
  // cerró la pestaña: la subida murió con ella y nadie va a terminar el
  // trabajo. Decirlo es mejor que dejar un cargando eterno.
  if (fila.status !== "done" || segments.length === 0) {
    return (
      <div className={styles.trVacio}>
        <QosIcon name="clock" size={26} className={styles.trVacioIc} />
        <p className={styles.trVacioTxt}>
          Esta transcripción quedó a medias. Volvé a mandar el video desde la pantalla anterior.
        </p>
      </div>
    );
  }

  const chips = [
    duracionLegible(fila.duration_seconds),
    `${contarPalabras(segments)} palabras`,
    idiomaLegible(fila.language),
  ].filter(Boolean) as string[];

  return (
    <>
      {chips.length > 0 && (
        <div className={styles.trChips}>
          {chips.map((c) => (
            <span key={c} className={styles.trChip}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className={styles.trLista}>
        {segments.map((s, i) => (
          <div key={i} className={styles.trSeg}>
            <span className={styles.trSegTiempo}>{s.timestamp}</span>
            <span className={styles.trSegTxt}>{s.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- Pestaña 2: el guion ---------------- */

function PanelGuion({
  parseado,
  generando,
  error,
  hayTranscripcion,
  onGenerar,
}: {
  parseado: ReturnType<typeof parsearGuion>;
  generando: boolean;
  error: string | null;
  hayTranscripcion: boolean;
  onGenerar: () => void;
}) {
  if (generando) {
    return (
      <div className={styles.trVacio}>
        <div className={`${styles.trBarra} ${styles.trBarraIndet}`} />
        <p className={styles.trVacioTxt}>Armando el guion con lo que dijiste…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.trVacio}>
        <QosIcon name="alert" size={26} className={styles.trVacioIc} />
        <p className={styles.trVacioTxt}>{error}</p>
        <button
          type="button"
          onClick={onGenerar}
          className={`${styles.trBoton} ${styles.trBotonSec}`}
        >
          Probar de nuevo
        </button>
      </div>
    );
  }

  if (!parseado.texto && parseado.bloques.length === 0) {
    return (
      <div className={styles.trVacio}>
        <QosIcon name="sparkle" size={26} className={styles.trVacioIc} />
        <p className={styles.trVacioTxt}>
          {hayTranscripcion
            ? "Tomá esta transcripción y convertila en un guion listo para volver a grabar: gancho, cuerpo y cierre."
            : "Primero hace falta una transcripción completa."}
        </p>
        {hayTranscripcion && (
          <button
            type="button"
            onClick={onGenerar}
            className={`${styles.trBoton} ${styles.trBotonPrim}`}
          >
            Armar mi guion
          </button>
        )}
      </div>
    );
  }

  const chips = [parseado.formato, parseado.tono].filter(Boolean) as string[];

  return (
    <>
      {chips.length > 0 && (
        <div className={styles.trChips}>
          {chips.map((c, i) => (
            <span key={c} className={`${styles.trChip} ${i === 0 ? styles.trChipFuerte : ""}`}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className={styles.trLista}>
        {parseado.estructurado ? (
          parseado.bloques.map((b, i) => (
            <div key={i} className={styles.trBloque}>
              <span className={styles.trBloqueEtiq}>
                <span className={styles.trBloqueFase}>{b.fase}</span>
                {b.rango && <span className={styles.trBloqueRango}>{b.rango}</span>}
              </span>
              <span className={styles.trBloqueTxt}>{b.texto}</span>
            </div>
          ))
        ) : (
          // Un guion de los viejos, o uno que se editó hasta romperle el
          // formato: se muestra tal cual en vez de perderse.
          <div className={styles.trPlano}>{parseado.texto}</div>
        )}
      </div>

      {/* Lo que el modelo escribió fuera de los tres bloques. Casi siempre no
          hay nada; cuando hay, se muestra en vez de tirarse a la basura. */}
      {parseado.estructurado && parseado.texto && (
        <div className={styles.trTomas}>
          <div className={styles.trTomasTit}>Notas del guion</div>
          <div className={styles.trPlano} style={{ padding: 0 }}>
            {parseado.texto}
          </div>
        </div>
      )}

      {parseado.tomas.length > 0 && (
        <div className={styles.trTomas}>
          <div className={styles.trTomasTit}>Tomas que te faltan</div>
          <ul className={styles.trTomasLista}>
            {parseado.tomas.map((t, i) => (
              <li key={i} className={styles.trToma}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/* ---------------- Las dos hojas del menú ---------------- */

function HojaDeNombre({
  id,
  actual,
  onClose,
  onListo,
}: {
  id: string;
  actual: string;
  onClose: () => void;
  onListo: () => void;
}) {
  const [valor, setValor] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    const res = await renombrarTranscripcionAction(id, valor);
    setGuardando(false);
    if (res) setError(res.error);
    else onListo();
  }

  return (
    <Hoja
      titulo="Cambiar el nombre"
      bajada="Es lo que vas a ver en la lista."
      onClose={onClose}
      pie={
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className={`${styles.trBoton} ${styles.trBotonPrim}`}
          style={{ marginTop: 0 }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      }
    >
      <label className={styles.trLabel} htmlFor="tr-nombre">
        Nombre
      </label>
      <input
        id="tr-nombre"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        maxLength={80}
        placeholder="Reel del brunch dominical"
        className={styles.trInput}
        style={{ paddingLeft: 14 }}
      />
      {error && <p className={styles.trVacioTxt}>{error}</p>}
    </Hoja>
  );
}

function HojaDeGuion({
  id,
  actual,
  onClose,
  onGuardado,
}: {
  id: string;
  actual: string;
  onClose: () => void;
  onGuardado: (texto: string) => void;
}) {
  const [valor, setValor] = useState(actual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    const res = await saveImprovedScriptAction(id, valor);
    setGuardando(false);
    if (res) setError(res.error);
    else onGuardado(valor.trim());
  }

  return (
    <Hoja
      titulo="Editar el guion"
      bajada="Los encabezados entre corchetes son los que la app dibuja como bloques."
      onClose={onClose}
      pie={
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className={`${styles.trBoton} ${styles.trBotonPrim}`}
          style={{ marginTop: 0 }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      }
    >
      <textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className={styles.wsScriptArea}
        spellCheck={false}
        aria-label="Guion mejorado"
        style={{ minHeight: 320 }}
      />
      {error && <p className={styles.trVacioTxt}>{error}</p>}
    </Hoja>
  );
}
