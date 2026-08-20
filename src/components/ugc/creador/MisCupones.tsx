"use client";

import { useState } from "react";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import CuponQR, { type CuponQRData } from "@/components/ugc/creador/CuponQR";
import { LEYENDA_EVENTO } from "@/lib/ugc/loyalty";
import styles from "@/styles/qos.module.css";

export type MiCupon = {
  id: string;
  code: string;
  title: string;
  brandName: string;
  brandLocation: string | null;
  brandLogo: string | null;
  type: string;
  /** por_usar | canjeado | vencido — calculado en el servidor. */
  estado: "por_usar" | "canjeado" | "vencido";
  reclamadoTexto: string;
  venceTexto: string;
  venceCorto: string;
  /** Días de calendario que faltan; negativo si ya pasó. */
  diasRestantes: number;
  canjeadoTexto: string | null;
  eventLocation: string | null;
  qr: string | null;
};

export default function MisCupones({ cupones }: { cupones: MiCupon[] }) {
  const [abierto, setAbierto] = useState<CuponQRData | null>(null);

  if (cupones.length === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        Todavía no reclamaste ningún cupón. Los que reclames van a quedar acá con su código y su
        fecha de vencimiento.
      </div>
    );
  }

  // "Por usar" se ordena por vencimiento y no por fecha de reclamo: lo único
  // que importa en esta lista es qué se me vence primero.
  const porUsar = cupones
    .filter((c) => c.estado === "por_usar")
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
  // Canjeados y vencidos van juntos: los dos son historial y ya no se tocan.
  const usados = cupones.filter((c) => c.estado !== "por_usar");

  return (
    <>
      <div className={styles.recSeccion}>Por usar · {porUsar.length}</div>

      {porUsar.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          No tenés cupones por usar. Mirá la pestaña Disponibles.
        </div>
      ) : (
        <div className={styles.recLista}>
          {porUsar.map((c) => (
            <div key={c.id} className={styles.cuponCard}>
              <div className={styles.cuponHead}>
                <BrandAvatar name={c.brandName} logoUrl={c.brandLogo} size={44} radius={14} />
                <div style={{ minWidth: 0 }}>
                  <div className={styles.cuponTitulo}>{c.title}</div>
                  <div className={styles.cuponMarca}>
                    {[c.brandName, c.brandLocation].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>

              <div className={styles.miCuponDatos}>
                <div>
                  <div className={styles.miDatoLabel}>Reclamado</div>
                  <div className={styles.miDatoValor}>{c.reclamadoTexto}</div>
                </div>
                <div>
                  <div className={styles.miDatoLabel}>Vence</div>
                  <div className={styles.miDatoValor}>
                    {c.venceCorto} ·{" "}
                    {c.diasRestantes <= 0
                      ? "hoy"
                      : c.diasRestantes === 1
                        ? "mañana"
                        : `en ${c.diasRestantes} días`}
                  </div>
                </div>
              </div>

              {c.eventLocation && <p className={styles.cuponNota}>📍 {c.eventLocation}</p>}
              {c.type === "evento" && <p className={styles.cuponNota}>🎟️ {LEYENDA_EVENTO}</p>}

              <div className={styles.miRasgado} />

              <div className={styles.miCuponPie}>
                <div>
                  <div className={styles.miDatoLabel}>Código</div>
                  <div className={styles.miCodigo}>{c.code}</div>
                </div>
                <button
                  type="button"
                  className={styles.btnVerQR}
                  onClick={() =>
                    setAbierto({
                      code: c.code,
                      qr: c.qr,
                      title: c.title,
                      brandName: c.brandName,
                      brandLocation: c.brandLocation,
                      type: c.type,
                      venceTexto: c.venceTexto,
                      diasRestantes: c.diasRestantes,
                    })
                  }
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden>
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                  </svg>
                  Ver QR
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {usados.length > 0 && (
        <>
          <div className={styles.recSeccion}>Ya usados</div>
          <div className={styles.histCard}>
            {usados.map((c) => (
              <div key={c.id} className={styles.usadoFila}>
                <BrandAvatar name={c.brandName} logoUrl={c.brandLogo} size={38} radius={12} />
                <div style={{ minWidth: 0 }}>
                  <div className={styles.usadoTitulo}>{c.title}</div>
                  <div className={styles.usadoDetalle}>
                    {c.brandName} ·{" "}
                    {c.estado === "canjeado"
                      ? `canjeado ${c.canjeadoTexto ?? "—"}`
                      : `venció ${c.venceCorto}`}
                  </div>
                </div>
                <span
                  className={`${styles.usadoPill} ${c.estado === "vencido" ? styles.usadoPillVencido : ""}`}
                >
                  {c.estado === "canjeado" ? "Canjeado" : "Vencido"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {abierto && <CuponQR cupon={abierto} onClose={() => setAbierto(null)} />}
    </>
  );
}
