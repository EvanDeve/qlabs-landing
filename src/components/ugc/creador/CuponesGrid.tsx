"use client";

import { useActionState, useState } from "react";
import { reclamarCuponAction, type ReclamarState } from "@/lib/actions/loyalty";
import { LABEL_TIPO_CUPON, LEYENDA_EVENTO } from "@/lib/ugc/loyalty";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export type CuponVista = {
  id: string;
  title: string;
  type: string;
  description: string;
  conditions: string | null;
  minLevel: number;
  minLevelName: string;
  puntosFaltantes: number;
  brandName: string;
  brandInitials: string;
  brandLogo: string | null;
  imageUrl: string | null;
  stockAvailable: number;
  stockTotal: number;
  /** Ya formateada en el servidor, con la zona horaria de Costa Rica. */
  vigencia: string;
  eventLocation: string | null;
  reclamo: {
    code: string;
    status: string;
    venceTexto: string;
    /** SVG en línea, generado en el servidor. */
    qr: string | null;
  } | null;
};

type ModalQR = { cupon: CuponVista; code: string; vence: string; qr: string | null };

export default function CuponesGrid({
  cupones,
  nivelActual,
}: {
  cupones: CuponVista[];
  nivelActual: number;
}) {
  const [state, formAction, pending] = useActionState<ReclamarState, FormData>(
    reclamarCuponAction,
    null
  );

  // Qué cupón se tocó último. El estado del action es uno solo para toda la
  // grilla, así que sin esto no se sabría en qué tarjeta mostrar el error ni
  // qué cupón nombrar en el modal.
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [manual, setManual] = useState<ModalQR | null>(null);
  const [descartado, setDescartado] = useState<string | null>(null);

  // El modal de un reclamo recién hecho se DERIVA del resultado del action, no
  // se copia a estado dentro de un efecto: copiarlo obliga a un render extra y
  // deja dos fuentes de verdad que se pueden desincronizar. `descartado` es lo
  // único que hace falta para poder cerrarlo.
  const cuponReclamado = ultimo ? cupones.find((c) => c.id === ultimo) : undefined;
  const fresco: ModalQR | null =
    state?.reclamo && cuponReclamado && state.reclamo.code !== descartado
      ? {
          cupon: cuponReclamado,
          code: state.reclamo.code,
          vence: new Date(state.reclamo.expires_at).toLocaleDateString("es-CR", {
            day: "numeric",
            month: "long",
            timeZone: "America/Costa_Rica",
          }),
          qr: state.reclamo.qr,
        }
      : null;

  const modal = manual ?? fresco;
  const cerrarModal = () => {
    if (manual) setManual(null);
    else if (fresco) setDescartado(fresco.code);
  };

  return (
    <>
      <div className={styles.cardsGrid}>
        {cupones.map((c) => {
          const desbloqueado = nivelActual >= c.minLevel;
          const agotado = c.stockAvailable <= 0;
          const reclamado = c.reclamo?.status === "reclamado";
          const canjeado = c.reclamo?.status === "canjeado";
          const vencido = c.reclamo?.status === "expirado";
          const error = state?.error && ultimo === c.id ? state.error : null;

          return (
            <div
              key={c.id}
              className={`${styles.card} ${styles.cardPad}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                opacity: desbloqueado ? 1 : 0.72,
              }}
            >
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "136px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: "1px solid var(--line)",
                    filter: desbloqueado ? "none" : "grayscale(0.7)",
                  }}
                />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  className={styles.avSm}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "10px",
                    background: "var(--surface-3)",
                    fontSize: "12px",
                    fontWeight: 700,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {c.brandLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.brandLogo}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    c.brandInitials
                  )}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700 }}>{c.brandName}</div>
                  <div style={{ fontSize: "11.5px", color: "var(--ink-3)" }}>
                    {LABEL_TIPO_CUPON[c.type] ?? c.type}
                  </div>
                </div>
                {!desbloqueado && (
                  <span className={`${styles.riskPill} ${styles.riskMuted}`} style={{ marginLeft: "auto" }}>
                    🔒 {c.minLevelName}
                  </span>
                )}
              </div>

              <h3 style={{ fontSize: "15.5px", fontWeight: 800, lineHeight: 1.3 }}>{c.title}</h3>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>{c.description}</p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px 14px",
                  fontSize: "12px",
                  color: "var(--ink-3)",
                }}
              >
                <span>
                  Para: <b style={{ color: "var(--ink-2)" }}>{c.minLevel === 1 ? "Todos" : `${c.minLevelName}+`}</b>
                </span>
                <span>
                  Vigencia: <b style={{ color: "var(--ink-2)" }}>{c.vigencia}</b>
                </span>
                <span>
                  Quedan:{" "}
                  <b style={{ color: agotado ? "var(--risk)" : "var(--ink-2)" }}>
                    {c.stockAvailable} de {c.stockTotal}
                  </b>
                </span>
              </div>

              {c.eventLocation && (
                <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>📍 {c.eventLocation}</div>
              )}

              {c.type === "evento" && (
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

              {c.conditions && (
                <p style={{ fontSize: "11.5px", color: "var(--ink-3)" }}>{c.conditions}</p>
              )}

              {error && <p style={{ fontSize: "12.5px", color: "var(--risk)" }}>{error}</p>}

              <div style={{ marginTop: "auto", paddingTop: "6px" }}>
                {!desbloqueado ? (
                  <div style={{ fontSize: "12.5px", color: "var(--ink-3)" }}>
                    Te faltan <b>{c.puntosFaltantes.toLocaleString("es-CR")} pts</b> para desbloquearlo
                  </div>
                ) : canjeado ? (
                  <span className={`${styles.riskPill} ${styles.riskOk}`}>✓ Canjeado</span>
                ) : vencido ? (
                  <span className={`${styles.riskPill} ${styles.riskMuted}`}>Venció sin usarse</span>
                ) : reclamado ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "13px",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        padding: "5px 10px",
                        borderRadius: "8px",
                        background: "var(--surface-3)",
                      }}
                    >
                      {c.reclamo!.code}
                    </code>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                      onClick={() =>
                        setManual({
                          cupon: c,
                          code: c.reclamo!.code,
                          vence: c.reclamo!.venceTexto,
                          qr: c.reclamo!.qr,
                        })
                      }
                    >
                      Ver QR
                    </button>
                  </div>
                ) : agotado ? (
                  <button type="button" disabled className={`${styles.btn} ${styles.btnGhost}`}>
                    Agotado
                  </button>
                ) : confirmando === c.id ? (
                  /* Reclamar es irreversible: un canje por creador por cupón, sin
                     deshacer. Un toque accidental en el celular quemaba la única
                     oportunidad de esa persona y le descontaba stock a la marca.
                     La confirmación es in-page y no `window.confirm`, que congela
                     la automatización del navegador. */
                  <div
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      padding: "12px",
                      background: "var(--surface-3)",
                    }}
                  >
                    <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginBottom: "10px" }}>
                      Vas a reclamar <b>{c.title}</b>. Tenés <b>{c.vigencia.toLowerCase()}</b> para
                      usarlo y <b>no se puede reclamar de nuevo</b>.
                    </p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <form action={formAction} onSubmit={() => setUltimo(c.id)}>
                        <input type="hidden" name="coupon_id" value={c.id} />
                        <button
                          type="submit"
                          disabled={pending}
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                        >
                          {pending && ultimo === c.id ? "Reclamando…" : "Sí, reclamarlo"}
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(c.id)}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    Reclamar cupón
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className={styles.modalOverlay} onClick={cerrarModal}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "380px", textAlign: "center" }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={cerrarModal} className={styles.drawerClose}>
                <QosIcon name="x" size={16} />
              </button>
            </div>

            <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Cupón reclamado 🎉</h2>
            <p style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "18px" }}>
              {modal.cupon.title} · {modal.cupon.brandName}
            </p>

            {modal.qr ? (
              <div
                style={{
                  display: "inline-block",
                  padding: "10px",
                  borderRadius: "12px",
                  background: "#fff",
                  lineHeight: 0,
                }}
                dangerouslySetInnerHTML={{ __html: modal.qr }}
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
              {modal.code}
            </div>

            <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "10px" }}>
              Mostralo en el local antes de ordenar · vence el {modal.vence}
            </p>
            <p style={{ fontSize: "11.5px", color: "var(--ink-3)", marginTop: "6px" }}>
              Si el QR no escanea, dictá el código: se lee igual.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
