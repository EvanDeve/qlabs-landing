"use client";

import { useEffect } from "react";
import styles from "@/styles/qos.module.css";

/**
 * La hoja que sube desde abajo, compartida por todo el panel del creador.
 *
 * Existe porque el mismo bloque —agarre, X, Escape, bloquear el scroll de
 * atrás— ya iba por su tercera copia (el detalle de la promo, la entrega, y
 * ahora las dos del pipeline). Lo que se repetía no era el markup sino el
 * `useEffect`: olvidarse de restaurar `body.overflow` deja la página trabada
 * al cerrar, y es un bug que no se nota hasta que alguien intenta scrollear.
 */
export default function Hoja({
  titulo,
  bajada,
  onClose,
  children,
  pie,
}: {
  titulo: string;
  bajada?: string | null;
  onClose: () => void;
  children: React.ReactNode;
  /** Acciones fijas al pie, fuera del scroll. */
  pie?: React.ReactNode;
}) {
  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", alTeclado);
    // Sin esto el dedo arrastra la página de atrás y al cerrar aparece en otro
    // punto del scroll.
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
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        {/* El agarre no hace nada por sí solo: es la señal de que esto se cierra
            hacia abajo. Cerrar de verdad son la X, Escape y tocar afuera. */}
        <div className={styles.hojaAgarre} aria-hidden />
        <button type="button" onClick={onClose} className={styles.hojaCerrar} aria-label="Cerrar">
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
          <div className={styles.hojaHead}>
            <h2 className={styles.hojaTituloGrande}>{titulo}</h2>
            {bajada && <p className={styles.hojaBajada}>{bajada}</p>}
          </div>
          {children}
        </div>

        {pie && <div className={styles.hojaPieFijo}>{pie}</div>}
      </div>
    </div>
  );
}
