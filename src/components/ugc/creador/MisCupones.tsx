"use client";

import { useState } from "react";
import { LABEL_TIPO_CUPON, LEYENDA_EVENTO } from "@/lib/ugc/loyalty";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export type MiCupon = {
  id: string;
  code: string;
  title: string;
  brandName: string;
  type: string;
  /** por_usar | canjeado | vencido — calculado en el servidor. */
  estado: "por_usar" | "canjeado" | "vencido";
  venceTexto: string;
  /** Días de calendario que faltan; negativo si ya pasó. */
  diasRestantes: number;
  canjeadoTexto: string | null;
  eventLocation: string | null;
  imageUrl: string | null;
  qr: string | null;
};

const SECCIONES = [
  {
    estado: "por_usar" as const,
    titulo: "Para usar",
    ayuda: "Mostrá el QR en el local antes de ordenar. Un canje por cupón.",
    vacio: "No tenés cupones por usar. Mirá la pestaña Disponibles.",
  },
  {
    estado: "canjeado" as const,
    titulo: "Ya canjeados",
    ayuda: "Los que ya usaste. Quedan acá como historial.",
    vacio: "Todavía no canjeaste ninguno.",
  },
  {
    estado: "vencido" as const,
    titulo: "Vencidos",
    ayuda: "Se pasó la fecha y el código dejó de servir. El lugar se liberó para otro creador.",
    vacio: "No se te venció ninguno. 👏",
  },
];

export default function MisCupones({ cupones }: { cupones: MiCupon[] }) {
  const [qrAbierto, setQrAbierto] = useState<MiCupon | null>(null);

  if (cupones.length === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        Todavía no reclamaste ningún cupón. Los que reclames van a quedar acá con su código y su
        fecha de vencimiento.
      </div>
    );
  }

  return (
    <>
      {SECCIONES.map((seccion) => {
        // "Para usar" se ordena por vencimiento y no por fecha de reclamo: lo
        // único que importa en esa pestaña es qué se me vence primero. Las
        // otras dos secciones son historial, ahí manda lo más reciente.
        const items = cupones
          .filter((c) => c.estado === seccion.estado)
          .sort((a, b) =>
            seccion.estado === "por_usar" ? a.diasRestantes - b.diasRestantes : 0
          );
        // Las secciones vacías solo se muestran si es la única forma de
        // explicar que existen; si el creador ya tiene cupones en otra, una
        // tarjeta de "no tenés canjeados" no aporta.
        if (items.length === 0 && seccion.estado !== "por_usar") return null;

        return (
          <div key={seccion.estado} style={{ marginBottom: "26px" }}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionHeadBig} style={{ fontSize: "15px" }}>
                {seccion.titulo} {items.length > 0 && `(${items.length})`}
              </h3>
              <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>{seccion.ayuda}</span>
            </div>

            {items.length === 0 ? (
              <div className={`${styles.card} ${styles.empty}`}>{seccion.vacio}</div>
            ) : (
              <div className={styles.cardsGrid}>
                {items.map((c) => (
                  <div
                    key={c.id}
                    className={`${styles.card} ${styles.cardPad}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "9px",
                      opacity: c.estado === "por_usar" ? 1 : 0.75,
                    }}
                  >
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "112px",
                          objectFit: "cover",
                          borderRadius: "10px",
                          border: "1px solid var(--line)",
                          filter: c.estado === "por_usar" ? "none" : "grayscale(0.8)",
                        }}
                      />
                    )}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        className={`${styles.riskPill} ${
                          c.estado === "por_usar"
                            ? styles.riskOk
                            : c.estado === "canjeado"
                              ? styles.riskMuted
                              : styles.riskWarn
                        }`}
                      >
                        {c.estado === "por_usar"
                          ? "Por usar"
                          : c.estado === "canjeado"
                            ? "✓ Canjeado"
                            : "Vencido"}
                      </span>
                      <span className={`${styles.riskPill} ${styles.riskMuted}`}>
                        {LABEL_TIPO_CUPON[c.type] ?? c.type}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>{c.brandName}</div>
                      <h4 style={{ fontSize: "15px", fontWeight: 800, lineHeight: 1.3, marginTop: "2px" }}>
                        {c.title}
                      </h4>
                    </div>

                    {c.eventLocation && (
                      <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>📍 {c.eventLocation}</div>
                    )}

                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "14px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        background: "var(--surface-3)",
                        alignSelf: "flex-start",
                        textDecoration: c.estado === "por_usar" ? "none" : "line-through",
                      }}
                    >
                      {c.code}
                    </code>

                    <div style={{ fontSize: "12.5px", color: "var(--ink-2)" }}>
                      {c.estado === "canjeado"
                        ? `Canjeado el ${c.canjeadoTexto ?? "—"}`
                        : c.estado === "vencido"
                          ? `Venció el ${c.venceTexto}`
                          : c.diasRestantes <= 0
                            ? `Vence hoy — ${c.venceTexto}`
                            : c.diasRestantes === 1
                              ? `Vence mañana — ${c.venceTexto}`
                              : `Vence en ${c.diasRestantes} días — ${c.venceTexto}`}
                    </div>

                    {c.type === "evento" && c.estado === "por_usar" && (
                      <div
                        style={{
                          fontSize: "11.5px",
                          lineHeight: 1.45,
                          padding: "8px 10px",
                          borderRadius: "8px",
                          background: "var(--warn-bg)",
                          color: "var(--warn)",
                        }}
                      >
                        🎟️ {LEYENDA_EVENTO}
                      </div>
                    )}

                    {c.estado === "por_usar" && (
                      <button
                        type="button"
                        onClick={() => setQrAbierto(c)}
                        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                        style={{ alignSelf: "flex-start", marginTop: "auto" }}
                      >
                        Ver QR
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {qrAbierto && (
        <div className={styles.modalOverlay} onClick={() => setQrAbierto(null)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "380px", textAlign: "center" }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setQrAbierto(null)} className={styles.drawerClose}>
                <QosIcon name="x" size={16} />
              </button>
            </div>

            <h2 style={{ fontSize: "17px", marginBottom: "4px" }}>{qrAbierto.title}</h2>
            <p style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "18px" }}>
              {qrAbierto.brandName}
            </p>

            {qrAbierto.qr ? (
              <div
                style={{
                  display: "inline-block",
                  padding: "10px",
                  borderRadius: "12px",
                  background: "#fff",
                  lineHeight: 0,
                }}
                dangerouslySetInnerHTML={{ __html: qrAbierto.qr }}
              />
            ) : (
              <div className={styles.empty} style={{ padding: "20px" }}>
                No se pudo dibujar el QR. Mostrá el código de abajo.
              </div>
            )}

            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                marginTop: "16px",
              }}
            >
              {qrAbierto.code}
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "10px" }}>
              Mostralo en el local antes de ordenar · vence el {qrAbierto.venceTexto}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
