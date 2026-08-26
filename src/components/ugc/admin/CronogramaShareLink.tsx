"use client";

import { useEffect, useState } from "react";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

/**
 * Un link privado del cronograma, listo para copiar y mandar por WhatsApp.
 *
 * Sirve a los dos: el del Hero, que es para aprobar, y el de grabación, que es
 * para trabajar. Los textos los pone quien lo usa porque son lo único que
 * cambia — y son justamente lo que evita mandar el que no era.
 *
 * La URL llega armada desde el servidor, que la saca de los headers de la
 * petición. Las dos alternativas eran peores: `NEXT_PUBLIC_SITE_URL` hoy apunta
 * a localhost, así que un link copiado en producción saldría inservible sin
 * ninguna señal de que está mal; y armarla con `location.origin` en un efecto
 * deja el input vacío en el primer render y obliga a un setState de arranque.
 */
export default function CronogramaShareLink({
  url,
  titulo,
  descripcion,
  pie,
  inputId,
}: {
  url: string;
  titulo: string;
  /** Qué puede hacer quien reciba este link. */
  descripcion: string;
  /** El recordatorio de a quién va y a quién no. */
  pie: string;
  /** Propio por link: dos elementos con el mismo id rompen el foco del fallback. */
  inputId: string;
}) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = window.setTimeout(() => setCopiado(false), 2000);
    return () => window.clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles (o fuera de HTTPS) queda seleccionado para
      // copiarlo a mano, que es mejor que un botón que no hace nada.
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  }

  return (
    <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "18px" }}>
      <div className={styles.sectionHead}>
        <h2>{titulo}</h2>
      </div>

      <p className={styles.formNote} style={{ marginBottom: "10px" }}>
        {descripcion}
      </p>

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          id={inputId}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className={styles.inp}
          style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "12px" }}
        />
        <button
          type="button"
          onClick={copiar}
          disabled={!url}
          className={`${styles.btn} ${copiado ? styles.btnSoft : styles.btnPrimary} ${styles.btnSm}`}
          style={{ flexShrink: 0 }}
        >
          <QosIcon name={copiado ? "check" : "copy"} size={15} />
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>

      <p className={styles.formNote} style={{ marginTop: "9px" }}>
        {pie}
      </p>
    </div>
  );
}
