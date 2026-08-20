"use client";

import { useEffect } from "react";
import PromoDetalle, { type PromoDetalleData } from "@/components/ugc/creador/PromoDetalle";
import styles from "@/styles/qos.module.css";

/**
 * La hoja que sube desde el feed con el detalle de una promo.
 *
 * Es una hoja y no una página nueva porque decidir si aplicás o no es una
 * parada corta: se abre, se lee, se aplica o se cierra, y el feed sigue
 * detrás en el mismo lugar donde se dejó el scroll. La página con URL propia
 * sigue existiendo para los links compartidos y las notificaciones.
 */
export default function PromoSheet({
  promo,
  onClose,
}: {
  promo: PromoDetalleData;
  onClose: () => void;
}) {
  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", alTeclado);
    // Sin esto, el scroll del dedo sobre la hoja arrastra el feed de atrás y al
    // cerrar aparece en otro lugar del que se dejó.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onClose]);

  return (
    <div className={styles.hojaFondo} onClick={onClose} role="presentation">
      <div
        className={styles.hoja}
        role="dialog"
        aria-modal="true"
        aria-label={promo.title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* El agarre no hace nada por sí solo: es la señal de que esto se cierra
            hacia abajo. Cerrar de verdad son la X, la tecla Escape y tocar
            afuera. */}
        <div className={styles.hojaAgarre} aria-hidden />
        <button type="button" onClick={onClose} className={styles.hojaCerrar} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div className={styles.hojaScroll}>
          <PromoDetalle promo={promo} />
        </div>
      </div>
    </div>
  );
}
