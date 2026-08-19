"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

/**
 * `BarcodeDetector` no está en las librerías de TypeScript porque todavía no es
 * estándar en todos lados. Se declara lo mínimo que se usa acá.
 */
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/**
 * Saca el código corto de lo que traiga el QR.
 *
 * El QR del creador codifica la URL absoluta de validación
 * (`.../ugc/marca/validar/QL-XXXX-XX`), no el código pelado. El host se ignora
 * a propósito: producción, preview de Vercel y localhost generan orígenes
 * distintos y un QR emitido en uno tiene que poder leerse en otro.
 */
export function extraerCodigo(texto: string): string | null {
  const limpio = texto.trim();
  const enUrl = limpio.match(/\/ugc\/marca\/validar\/([^/?#\s]+)/);
  if (enUrl) return decodeURIComponent(enUrl[1]).toUpperCase();
  // Un QR que ya venga con el código solo. No pasa hoy, pero leerlo es gratis.
  if (/^QL-[A-Z0-9]{4}-[A-Z0-9]{2}$/i.test(limpio)) return limpio.toUpperCase();
  return null;
}

/** Cuántas veces por segundo se mira la imagen buscando un código. */
const INTERVALO_MS = 220;

/**
 * Lee el QR del creador con la cámara del teléfono y devuelve el código.
 *
 * Existe aunque la cámara nativa del teléfono ya abra la pantalla de validación
 * al leer el mismo QR: quien atiende ya está adentro del panel, y salir a la
 * app de la cámara y volver es exactamente el paso que se quiere evitar cuando
 * hay alguien esperando del otro lado del mostrador.
 *
 * Dos motores, en este orden:
 *  1. `BarcodeDetector`, nativo del navegador (Chrome/Android): sin descargas.
 *  2. jsQR, que se importa SOLO al abrir la cámara. Es el camino de iPhone,
 *     donde Safari no trae `BarcodeDetector` — sin esto, el botón no serviría
 *     justamente en el teléfono más común del mostrador.
 */
export default function EscanearQR({ onCodigo }: { onCodigo: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Apaga la cámara. La luz encendida después de cerrar asusta con razón. */
  const cerrar = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAbierto(false);
    setAviso(null);
  }, []);

  // Cubre el caso de cambiar de pestaña con la cámara abierta.
  useEffect(() => cerrar, [cerrar]);

  async function abrir() {
    setError(null);
    setAviso(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no da acceso a la cámara. Digitá el código a mano.");
      return;
    }

    let stream: MediaStream;
    try {
      // `environment` es la cámara de atrás: la de adelante apunta a la cara de
      // quien atiende, no al teléfono del creador.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
    } catch (e) {
      const nombre = e instanceof DOMException ? e.name : "";
      setError(
        nombre === "NotAllowedError"
          ? "No nos diste permiso de usar la cámara. Podés habilitarlo desde el candado de la barra de direcciones, o digitar el código a mano."
          : nombre === "NotFoundError"
            ? "No encontramos una cámara en este dispositivo. Digitá el código a mano."
            : "No pudimos abrir la cámara. Digitá el código a mano."
      );
      return;
    }

    streamRef.current = stream;
    setAbierto(true);
  }

  /**
   * El arranque de la lectura va en un efecto y no dentro de `abrir()`: el
   * <video> recién existe en el DOM después de que React pinte `abierto`, así
   * que asignarle el stream en la misma vuelta no encontraba el nodo.
   */
  useEffect(() => {
    if (!abierto) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let vivo = true;
    video.srcObject = stream;
    video.play().catch(() => {
      // Safari puede rechazar el play si el gesto quedó lejos; el usuario
      // siempre tiene el campo manual.
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector;
    let nativo: BarcodeDetectorLike | null = null;
    try {
      if (Detector) nativo = new Detector({ formats: ["qr_code"] });
    } catch {
      // Existe el constructor pero no soporta QR: se usa jsQR igual.
    }

    // Solo se descarga en el navegador que lo necesita, y solo al abrir.
    const jsQRPromise = nativo ? null : import("jsqr").then((m) => m.default);

    function aceptar(texto: string) {
      const code = extraerCodigo(texto);
      if (!code) {
        setAviso("Ese QR no es de un cupón de Q Labs.");
        return;
      }
      onCodigo(code);
      cerrar();
    }

    async function mirar() {
      if (!vivo || !video || !ctx || video.readyState < 2) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (!canvas.width || !canvas.height) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        if (nativo) {
          const [primero] = await nativo.detect(canvas);
          if (primero && vivo) aceptar(primero.rawValue);
          return;
        }
        const jsQR = await jsQRPromise;
        if (!jsQR || !vivo) return;
        const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const leido = jsQR(imagen.data, imagen.width, imagen.height, {
          inversionAttempts: "dontInvert",
        });
        if (leido?.data && vivo) aceptar(leido.data);
      } catch {
        // Un cuadro ilegible es lo normal mientras se encuadra: se ignora y se
        // vuelve a intentar con el siguiente.
      }
    }

    timerRef.current = setInterval(mirar, INTERVALO_MS);
    return () => {
      vivo = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [abierto, cerrar, onCodigo]);

  return (
    <div style={{ marginBottom: "16px" }}>
      {abierto && (
        <div className={styles.scanBox}>
          <video ref={videoRef} className={styles.scanVideo} muted playsInline />
          <div className={styles.scanMira} />
          <p className={styles.scanHint}>
            {aviso ?? "Poné el QR del creador dentro del recuadro"}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={abierto ? cerrar : abrir}
        className={`${styles.btn} ${abierto ? styles.btnGhost : styles.btnSoft}`}
      >
        <QosIcon name={abierto ? "x" : "camera"} size={16} />
        {abierto ? "Cerrar la cámara" : "Escanear código QR"}
      </button>

      {error && (
        <p className={styles.fieldHint} style={{ color: "var(--risk)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
