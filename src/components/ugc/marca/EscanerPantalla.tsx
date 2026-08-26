"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLectorQR } from "./EscanearQR";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

/**
 * La cámara a pantalla completa para validar un canje.
 *
 * Existe aparte de la cámara de Loyalty —que es un paso adentro de un
 * formulario— porque este es el gesto de mostrador: alguien llegó, muestra su
 * QR, y lo único que tiene que haber en pantalla es dónde apuntar. Comparte el
 * motor de lectura con aquella (`useLectorQR`); lo único propio es la
 * presentación.
 *
 * Al leer un código navega a `/ugc/marca/validar/<code>`, que es la MISMA ruta
 * a la que apunta el QR impreso. Así hay un solo lugar donde vive el resultado,
 * y da igual si se escaneó desde acá o desde la cámara del sistema.
 */
export default function EscanerPantalla() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Apaga la cámara. La luz encendida después de salir asusta con razón. */
  const apagar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function abrir() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no da acceso a la cámara.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        // Si el componente se desmontó mientras se pedía el permiso, el stream
        // llega igual: hay que apagarlo o la cámara queda prendida sola.
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            // Safari puede rechazar el play; siempre queda el camino manual.
          });
        }
        setListo(true);
      } catch {
        setError("No se pudo abrir la cámara. Revisá el permiso del navegador.");
      }
    }

    void abrir();
    return () => {
      cancelado = true;
      apagar();
    };
  }, [apagar]);

  const alLeer = useCallback(
    (code: string) => {
      apagar();
      router.push(`/ugc/marca/validar/${encodeURIComponent(code)}`);
    },
    [apagar, router]
  );

  useLectorQR({ videoRef, activo: listo, onCodigo: alLeer, onAviso: setAviso });

  return (
    <div className={styles.mcEscaner}>
      <div className={styles.mcEscanerBar}>
        <span className={styles.mcEscanerTit}>Validar canje</span>
        <Link href="/ugc/marca/loyalty" className={styles.mcEscanerX} aria-label="Cerrar">
          <QosIcon name="x" size={17} />
        </Link>
      </div>

      <div className={styles.mcEscanerVista}>
        <video ref={videoRef} className={styles.mcEscanerVideo} muted playsInline />
        <div className={styles.mcEscanerMira} aria-hidden>
          <span className={styles.mcEscanerEsq} />
          <span className={styles.mcEscanerEsq} />
          <span className={styles.mcEscanerEsq} />
          <span className={styles.mcEscanerEsq} />
        </div>
      </div>

      <div className={styles.mcEscanerPie}>
        {error ?? aviso ?? "Poné el QR del creador dentro del recuadro."}
        {/* Siempre a la vista y no solo cuando falla: en un mostrador con mala
            luz, buscar el camino manual recién cuando la cámara no anda es
            justo el momento en que menos se quiere buscar nada. */}
        <br />
        <Link href="/ugc/marca/loyalty" className={styles.mcEscanerManual}>
          Buscar el código a mano
        </Link>
      </div>
    </div>
  );
}
