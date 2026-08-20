"use client";

import { useEffect } from "react";
import { LABEL_TIPO_CUPON } from "@/lib/ugc/loyalty";
import styles from "@/styles/qos.module.css";

export type CuponQRData = {
  code: string;
  /** SVG del QR generado en el servidor. Null si no se pudo dibujar. */
  qr: string | null;
  title: string;
  brandName: string;
  brandLocation?: string | null;
  type: string;
  venceTexto: string;
  diasRestantes: number | null;
};

/**
 * El cupón a pantalla completa.
 *
 * Ocupa todo y va en violeta a propósito: este código se muestra en la mesa,
 * con el celular estirado hacia quien atiende. Cuanto menos haya alrededor y
 * más claro el contraste, más rápido escanea.
 */
export default function CuponQR({ cupon, onClose }: { cupon: CuponQRData; onClose: () => void }) {
  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", alTeclado);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onClose]);

  const vence =
    cupon.diasRestantes === null
      ? `Vence el ${cupon.venceTexto}`
      : cupon.diasRestantes <= 0
        ? "Vence hoy"
        : cupon.diasRestantes === 1
          ? "Vence mañana"
          : `Vence en ${cupon.diasRestantes} días`;

  return (
    <div className={styles.qrPantalla} role="dialog" aria-modal="true" aria-label={`Cupón ${cupon.title}`}>
      <div className={styles.qrBarra}>
        <span className={styles.qrTitulo}>Tu cupón</span>
        <button type="button" onClick={onClose} className={styles.qrCerrar} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className={styles.qrTarjeta}>
        {cupon.qr ? (
          <div className={styles.qrImg} dangerouslySetInnerHTML={{ __html: cupon.qr }} />
        ) : (
          // El código en texto es el respaldo real: quien atiende puede
          // buscarlo a mano en el panel de la marca sin escanear nada.
          <p style={{ fontSize: "13.5px", color: "var(--ink-2)" }}>
            No se pudo dibujar el QR. Dictá el código de abajo, sirve igual.
          </p>
        )}

        <div className={styles.qrCodigo}>{cupon.code}</div>
        <div className={styles.miRasgado} />
        <div className={styles.qrCuponTitulo}>{cupon.title}</div>
        <div className={styles.qrCuponMarca}>
          {[cupon.brandName, cupon.brandLocation].filter(Boolean).join(" · ")}
        </div>
        <div className={styles.qrChips}>
          <span className={styles.qrChipTipo}>{LABEL_TIPO_CUPON[cupon.type] ?? cupon.type}</span>
          <span className={styles.cuponChip}>{vence}</span>
        </div>
      </div>

      <p className={styles.qrAyuda}>
        Mostrale este código a quien te atiende.
        <br />
        Subí el brillo al máximo para el escaneo.
      </p>
    </div>
  );
}
