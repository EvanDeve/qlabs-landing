"use client";

import { useEffect, useState } from "react";
import HojaDeEntrega, { type ArchivoGuardado } from "@/components/ugc/creador/HojaDeEntrega";
import type { SlotEntrega } from "@/lib/ugc/delivery-slots";
import styles from "@/styles/qos.module.css";

/**
 * El botón "Entregar pieza" de la tarjeta y la hoja que abre.
 *
 * La hoja es una hoja y no una página porque entregar es una parada corta con
 * un contexto que ya está a la vista: se abre, se suben las piezas y se
 * vuelve a la lista sin perder el scroll. Mismo patrón que `PromoSheet`.
 */
export default function EntregarPieza({
  applicationId,
  titulo,
  marca,
  brief,
  slots,
  guardados,
}: {
  applicationId: string;
  titulo: string;
  marca: string | null;
  brief: string | null;
  slots: SlotEntrega[];
  guardados: ArchivoGuardado[];
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

  const listos = guardados.length;
  const faltan = slots.length - listos;

  return (
    <>
      <button type="button" className={styles.apliCta} onClick={() => setAbierta(true)}>
        Entregar pieza
      </button>
      {/* Que la tarjeta diga cuánto va evita abrir la hoja solo para mirar. */}
      {slots.length > 0 && listos > 0 && faltan > 0 && (
        <p className={styles.apliCtaPie}>
          {listos} de {slots.length} archivos listos
        </p>
      )}

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
              <HojaDeEntrega
                applicationId={applicationId}
                titulo={titulo}
                marca={marca}
                brief={brief}
                slots={slots}
                guardados={guardados}
                onListo={() => setAbierta(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
