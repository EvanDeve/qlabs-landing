"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  duracionDeMp4,
  esArchivoAceptado,
  MAX_TRANSCRIPTION_FILE_BYTES,
  TRANSCRIPTION_BUCKET,
} from "@/lib/ugc/transcription";
import { pesoLegible, subirArchivoDirecto } from "@/lib/ugc/uploads";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

/**
 * Mide cuánto dura un video o un audio, en el navegador, antes de subirlo.
 *
 * Es la única forma de tener la duración: en el servidor haría falta un
 * demuxer, y ese es justo el binario de sistema que no existe en serverless —
 * la misma razón por la que se transcribe con Gemini y no con Whisper.
 *
 * Va por dos caminos y en este orden:
 *
 *   1. Un `<video>` y su `loadedmetadata`. Es barato —no lee el archivo
 *      entero— y sirve para cualquier formato.
 *   2. Si eso no contesta, los bytes del átomo `mvhd`. ⚠️ El paso 1 **no
 *      responde con la pestaña en segundo plano**: Chrome suspende ahí la
 *      carga de medios y no dispara ni `loadedmetadata` ni `error`. Verificado
 *      el 2026-08-25, y en el teléfono pasa apenas el creador se va a otra app
 *      mientras elige el archivo. El respaldo son bytes y no depende de eso,
 *      pero sí lee el archivo entero, por eso va segundo.
 *
 * Nunca rechaza: si los dos fallan devuelve null y la transcripción sigue
 * igual, solo que sin el chip de duración. Preferible un chip que falta a
 * bloquear una subida que iba a funcionar.
 */
async function medirDuracion(file: File): Promise<number | null> {
  const porElemento = await new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith("audio") ? "audio" : "video");
    const cerrar = (valor: number | null) => {
      URL.revokeObjectURL(url);
      resolve(valor);
    };
    // 2,5 s y no más: un archivo corrupto puede no disparar ni
    // `loadedmetadata` ni `error`, y en segundo plano no dispara NINGUNO. Lo
    // que sigue es el respaldo, así que esperar de más solo demora la subida.
    const reloj = setTimeout(() => cerrar(null), 2500);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(reloj);
      cerrar(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null);
    };
    el.onerror = () => {
      clearTimeout(reloj);
      cerrar(null);
    };
    el.src = url;
  });

  if (porElemento) return porElemento;

  try {
    return duracionDeMp4(await file.arrayBuffer());
  } catch {
    return null;
  }
}

type Trabajo = {
  nombre: string;
  /** "18.4 MB" o "18.4 MB · 2:14". Vacío cuando vino de un link. */
  meta: string;
  /** 0 a 1 mientras sube. Null cuando ya está en manos del modelo. */
  subida: number | null;
};

export default function TranscripcionForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

  const ocupado = trabajo !== null;

  async function pedirTranscripcion(body: Record<string, unknown>) {
    const res = await fetch("/api/ugc/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // La respuesta puede no ser JSON si la función se cortó por tiempo: ahí el
    // body viene vacío o con el HTML de error de la plataforma.
    let data: { id?: string; error?: string };
    try {
      data = await res.json();
    } catch {
      throw new Error("El video tardó demasiado y se cortó. Probá con uno más corto.");
    }
    if (!res.ok) throw new Error(data.error ?? "No se pudo transcribir.");
    return data;
  }

  /** Al terminar se entra directo al detalle: es donde está el resultado. */
  function alTerminar(id: string | undefined) {
    if (id) router.push(`/ugc/creador/transcripcion/${id}`);
    else router.refresh();
  }

  async function transcribirUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || ocupado) return;

    setError(null);
    // Un link no se sube: el trabajo arranca ya del lado del modelo, y por eso
    // no lleva porcentaje. Inventarle uno sería la parte del mockup que no es
    // cierta.
    setTrabajo({ nombre: url.trim(), meta: "", subida: null });

    try {
      const data = await pedirTranscripcion({ url });
      alTerminar(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo transcribir.");
      setTrabajo(null);
    }
  }

  async function transcribirArchivo(file: File) {
    if (ocupado) return;

    if (!esArchivoAceptado(file.name, file.type)) {
      setError("Ese formato no sirve. Subí un video (mp4, mov, webm) o un audio (mp3, m4a, wav).");
      return;
    }
    if (file.size > MAX_TRANSCRIPTION_FILE_BYTES) {
      setError(
        `El archivo pesa ${pesoLegible(file.size)} y el máximo es ${pesoLegible(MAX_TRANSCRIPTION_FILE_BYTES)}. Recortá el video o exportalo con menos calidad.`
      );
      return;
    }

    setError(null);
    setTrabajo({ nombre: file.name, meta: pesoLegible(file.size), subida: 0 });

    try {
      const segundos = await medirDuracion(file);
      if (segundos) {
        const m = Math.floor(segundos / 60);
        const ss = String(Math.round(segundos % 60)).padStart(2, "0");
        setTrabajo((t) => (t ? { ...t, meta: `${m}:${ss} · ${pesoLegible(file.size)}` } : t));
      }

      // Sube DIRECTO a Supabase Storage, sin pasar por el servidor: en Vercel
      // el body de una función tiene un tope de ~4.5 MB y un video no entra.
      const storagePath = await subirArchivoDirecto({
        bucket: TRANSCRIPTION_BUCKET,
        file,
        maxBytes: MAX_TRANSCRIPTION_FILE_BYTES,
        extFallback: "mp4",
        onProgreso: (p) => setTrabajo((t) => (t ? { ...t, subida: p } : t)),
      });

      // De acá en adelante ya no hay porcentaje que reportar.
      setTrabajo((t) => (t ? { ...t, subida: null } : t));

      const data = await pedirTranscripcion({
        storagePath,
        fileName: file.name,
        durationSeconds: segundos,
      });
      alTerminar(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo transcribir el archivo.");
      setTrabajo(null);
    } finally {
      if (inputArchivo.current) inputArchivo.current.value = "";
    }
  }

  if (trabajo) {
    const subiendo = trabajo.subida !== null;
    const pct = Math.round((trabajo.subida ?? 0) * 100);

    return (
      <div className={styles.trProg}>
        <div className={styles.trProgHead}>
          <span className={styles.trFilaIc}>
            <QosIcon name={trabajo.meta ? "film" : "link"} size={19} />
          </span>
          <span className={styles.trFilaTxt}>
            <span className={styles.trProgNom}>{trabajo.nombre}</span>
            {trabajo.meta && <span className={styles.trProgMeta}>{trabajo.meta}</span>}
          </span>
        </div>

        <div className={`${styles.trBarra} ${subiendo ? "" : styles.trBarraIndet}`}>
          {subiendo && <div className={styles.trBarraFill} style={{ width: `${pct}%` }} />}
        </div>

        <div className={styles.trProgLinea}>
          <span>{subiendo ? "Subiendo el archivo…" : "Pasando la voz a texto…"}</span>
          {/* El porcentaje existe SOLO en la subida, que es la única parte que
              reporta avance de verdad (XHR). Transcribir es una llamada al
              modelo: no hay número que mostrar, y el del mockup era de relleno. */}
          {subiendo && <span className={styles.trProgPct}>{pct}%</span>}
        </div>

        <div className={styles.trPasos}>
          <div
            className={`${styles.trPaso} ${
              subiendo ? styles.trPasoAhora : styles.trPasoHecho
            }`}
          >
            <span className={styles.trPasoIc}>{!subiendo && <QosIcon name="check" size={11} />}</span>
            {trabajo.meta ? "Subiendo el archivo" : "Leyendo el link"}
          </div>
          <div className={`${styles.trPaso} ${subiendo ? "" : styles.trPasoAhora}`}>
            <span className={styles.trPasoIc} />
            Pasando la voz a texto
          </div>
        </div>

        {/* El mockup decía "podés salir de acá, seguimos trabajando". No es
            cierto y la parte más larga es justamente la que menos lo es: la
            subida vive en esta pestaña y se muere con ella. */}
        <p className={styles.trNota}>
          {subiendo
            ? "No cierres esta pantalla mientras sube."
            : "Suele tardar menos de medio minuto."}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.trCard}>
      <form onSubmit={transcribirUrl}>
        <label className={styles.trLabel} htmlFor="tr-url">
          Link del video
        </label>
        <div className={styles.trInputWrap}>
          <QosIcon name="link" size={16} className={styles.trInputIc} />
          <input
            id="tr-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="youtube.com/watch?v=…"
            className={styles.trInput}
            inputMode="url"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim()}
          className={`${styles.trBoton} ${styles.trBotonPrim}`}
        >
          Transcribir
        </button>
      </form>

      <div className={styles.trO}>o</div>

      {/* El input nativo se esconde y se dispara desde un botón de verdad: el
          control por defecto es casi invisible y ya costó una ronda de
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
        className={`${styles.trBoton} ${styles.trBotonSec}`}
      >
        <QosIcon name="upload" size={16} />
        Subir un archivo
      </button>

      {error && (
        <div className={`${styles.trAviso} ${styles.trAvisoMal}`}>
          <QosIcon name="alert" size={15} className={styles.trAvisoIc} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.trAviso}>
        <QosIcon name="info" size={15} className={styles.trAvisoIc} />
        <span>
          Los links andan con <b>YouTube y Shorts</b>. Instagram y TikTok no dejan leer el video
          desde afuera: descargalo y subilo acá, hasta {pesoLegible(MAX_TRANSCRIPTION_FILE_BYTES)}.
        </span>
      </div>
    </div>
  );
}
