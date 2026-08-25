"use client";

import { useEffect, useState } from "react";
import DeliverySubmitForm from "@/components/ugc/creador/DeliverySubmitForm";
import styles from "@/styles/qos.module.css";

/**
 * El botón "Entregar pieza" de la tarjeta y la hoja que abre.
 *
 * Es un puente a propósito: adentro va el formulario de entrega tal como
 * existe hoy, hasta que se diseñe la pantalla de entrega del creador. Lo que
 * ya queda armado es el lugar —la hoja sube desde abajo, con el nombre de la
 * campaña arriba— así que cambiar el contenido después no toca la lista.
 */
export default function EntregarPieza({
  applicationId,
  titulo,
  marca,
}: {
  applicationId: string;
  titulo: string;
  marca: string | null;
}) {
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierta(false);
    }
    document.addEventListener("keydown", alTeclado);
    // Mismo motivo que en PromoSheet: sin esto el dedo arrastra la lista de
    // atrás y al cerrar aparece en otro punto del scroll.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierta]);

  return (
    <>
      <button type="button" className={styles.apliCta} onClick={() => setAbierta(true)}>
        Entregar pieza
      </button>

      {abierta && (
        <div className={styles.hojaFondo} onClick={() => setAbierta(false)} role="presentation">
          <div
            className={styles.hoja}
            role="dialog"
            aria-modal="true"
            aria-label={`Entregar pieza — ${titulo}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.hojaAgarre} aria-hidden />
            <button
              type="button"
              onClick={() => setAbierta(false)}
              className={styles.hojaCerrar}
              aria-label="Cerrar"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>

            <div className={styles.hojaScroll}>
              <div className={styles.apliHojaHead}>
                <h2 className={styles.hojaTitulo}>{titulo}</h2>
                {marca && <p className={styles.apliHojaMarca}>{marca}</p>}
              </div>
              <DeliverySubmitForm applicationId={applicationId} onListo={() => setAbierta(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
