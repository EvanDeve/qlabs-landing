"use client";

import { useEffect, useState } from "react";
import { QosIcon } from "@/lib/ugc/qos-icons";
import Hoja from "./Hoja";
import styles from "@/styles/qos.module.css";

/**
 * Compartir el perfil público: copiar el link, mandarlo por WhatsApp o mostrar
 * el QR.
 *
 * La URL se arma con `window.location.origin` y no con `NEXT_PUBLIC_SITE_URL`:
 * esa variable hoy vale `http://localhost:3000` en el repo y no está claro qué
 * tiene Vercel. Para un link que el creador le va a mandar a una marca, el
 * origen del navegador es el único dato que no puede estar mal.
 *
 * ⚠️ El mockup mostraba `ugccrc.cr/creadores/<handle>`. Ese dominio no existe
 * —Evan lo confirmó— y un link que no abre es peor que uno largo.
 */
export default function CompartirPerfil({ handle }: { handle: string }) {
  const [abierta, setAbierta] = useState(false);
  const [url, setUrl] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const limpio = handle.replace(/^@/, "");

  useEffect(() => {
    if (abierta) setUrl(`${window.location.origin}/ugc/creadores/${limpio}`);
  }, [abierta, limpio]);

  useEffect(() => {
    if (!copiado) return;
    const id = setTimeout(() => setCopiado(false), 2200);
    return () => clearTimeout(id);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles (Safari sin gesto, http sin TLS): se
      // selecciona el texto para que se pueda copiar a mano.
      const el = document.getElementById("perfil-url");
      if (el) {
        const rango = document.createRange();
        rango.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(rango);
      }
    }
  }

  async function mostrarQr() {
    if (qr) {
      setQr(null);
      return;
    }
    // Import dinámico: la librería son ~50 KB y esta hoja se abre poco. Traerla
    // en el bundle de la pantalla la pagaría todo el mundo, siempre.
    const { default: QRCode } = await import("qrcode");
    setQr(
      await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
        width: 200,
        color: { dark: "#1a1730", light: "#ffffff" },
      })
    );
  }

  return (
    <>
      <button type="button" className={styles.perfilVerPublico} onClick={() => setAbierta(true)}>
        Ver público
      </button>

      {abierta && (
        <Hoja
          titulo="Compartir tu perfil"
          onClose={() => {
            setAbierta(false);
            setQr(null);
          }}
          pie={
            <button
              type="button"
              className={styles.hojaBorrarChico}
              style={{ width: "100%" }}
              onClick={() => {
                setAbierta(false);
                setQr(null);
              }}
            >
              Cerrar
            </button>
          }
        >
          <div className={styles.perfilLinkCard}>
            <div className={styles.perfilHandle}>@{limpio}</div>
            <div id="perfil-url" className={styles.perfilUrl}>
              {url}
            </div>
          </div>

          <div className={styles.perfilAcciones}>
            <button type="button" className={styles.perfilAccion} onClick={copiar}>
              <QosIcon name="copy" size={17} />
              {copiado ? "¡Copiado!" : "Copiar el enlace"}
            </button>
            <a
              className={styles.perfilAccion}
              href={`https://wa.me/?text=${encodeURIComponent(`Mirá mi book de creador: ${url}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <QosIcon name="chat" size={17} />
              Compartir por WhatsApp
            </a>
            <a
              className={styles.perfilAccion}
              href={`/ugc/creadores/${limpio}`}
              target="_blank"
              rel="noreferrer"
            >
              <QosIcon name="external" size={17} />
              Abrir el perfil
            </a>
            <button type="button" className={styles.perfilAccion} onClick={mostrarQr}>
              <QosIcon name="grid" size={17} />
              {qr ? "Ocultar el código QR" : "Mostrar código QR"}
            </button>
          </div>

          {qr && (
            <div className={styles.perfilQr} dangerouslySetInnerHTML={{ __html: qr }} />
          )}

          {/* Lo que se comparte NO es todo el perfil: conviene decirlo antes de
              que alguien mande el link creyendo que expone sus pagos. */}
          <p className={styles.perfilNota}>
            Cualquiera con el enlace ve tu book, tus habilidades y las marcas con las que
            trabajaste. No ve tus pagos ni tus aplicaciones.
          </p>
        </Hoja>
      )}
    </>
  );
}
