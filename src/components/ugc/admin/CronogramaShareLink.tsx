"use client";

import { useEffect, useState } from "react";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * El link que se le manda al Hero por WhatsApp para que revise y apruebe.
 *
 * La URL llega armada desde el servidor, que la saca de los headers de la
 * petición. Las dos alternativas eran peores: `NEXT_PUBLIC_SITE_URL` hoy apunta
 * a localhost, así que un link copiado en producción saldría inservible sin
 * ninguna señal de que está mal; y armarla con `location.origin` en un efecto
 * deja el input vacío en el primer render y obliga a un setState de arranque.
 */
export default function CronogramaShareLink({ url, aprobado }: { url: string; aprobado: boolean }) {
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
      const input = document.getElementById("crono-share") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  }

  return (
    <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "18px" }}>
      <div className={styles.sectionHead}>
        <h2>Link para el Hero</h2>
      </div>

      <p className={styles.formNote} style={{ marginBottom: "10px" }}>
        {aprobado
          ? "Ya lo aprobó. El link sigue sirviendo para que consulte el mes, pero ya no puede comentar."
          : "Mandáselo por WhatsApp. Puede ver el mes, comentar cada video y aprobar. No puede editar nada."}
      </p>

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          id="crono-share"
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
        Quien tenga este link entra sin contraseña, así que va solo al Hero. Es distinto para cada mes.
      </p>
    </div>
  );
}
