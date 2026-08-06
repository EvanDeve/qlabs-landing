"use client";

import { useActionState, useState } from "react";
import {
  cambiarEstadoCuponAction,
  borrarCuponAction,
  canjearAction,
  type CanjeState,
} from "@/lib/actions/cupones";
import CuponForm, { type CuponEditable } from "./CuponForm";
import { buscarCodigoAction, type BusquedaState } from "@/lib/actions/validar";
import { LABEL_TIPO_CUPON, LEYENDA_EVENTO } from "@/lib/ugc/loyalty";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export type CuponMarca = {
  id: string;
  title: string;
  type: string;
  description: string;
  status: string;
  minLevel: number;
  minLevelName: string;
  stockTotal: number;
  stockAvailable: number;
  vigencia: string;
  eventLocation: string | null;
  conditions: string | null;
  imageUrl: string | null;
  claimValidityDays: number | null;
  /** YYYY-MM-DD para el <input type="date"> de la edición. */
  eventDateInput: string | null;
};

export type CanjeFila = {
  id: string;
  fecha: string;
  handle: string;
  nivel: string;
  cupon: string;
  code: string;
  status: string;
};

const ESTADO_PILL: Record<string, string> = {
  borrador: "riskMuted",
  publicado: "riskOk",
  pausado: "riskWarn",
  agotado: "riskWarn",
  vencido: "riskMuted",
};

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  pausado: "Pausado",
  agotado: "Agotado",
  vencido: "Vencido",
};

type Tab = "cupones" | "nuevo" | "validar" | "canjes";

export default function LoyaltyMarcaTabs({
  cupones,
  canjes,
  niveles,
  verificada,
  nombreMarca,
}: {
  cupones: CuponMarca[];
  canjes: CanjeFila[];
  niveles: { level: number; name: string }[];
  verificada: boolean;
  nombreMarca: string;
}) {
  const [tab, setTab] = useState<Tab>("cupones");

  return (
    <div>
      <div className={styles.subtabs}>
        {(
          [
            ["cupones", `Mis cupones${cupones.length ? ` (${cupones.length})` : ""}`],
            ["nuevo", "+ Nuevo cupón"],
            ["validar", "Validar canje"],
            ["canjes", `Canjes${canjes.length ? ` (${canjes.length})` : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${styles.subtab} ${tab === id ? styles.subtabOn : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cupones" && (
        <ListaCupones cupones={cupones} niveles={niveles} verificada={verificada} />
      )}
      {tab === "nuevo" && (
        <div className={`${styles.card} ${styles.cardPad}`} style={{ maxWidth: "760px" }}>
          <CuponForm niveles={niveles} verificada={verificada} />
        </div>
      )}
      {tab === "validar" && <Validador nombreMarca={nombreMarca} />}
      {tab === "canjes" && <TablaCanjes canjes={canjes} />}
    </div>
  );
}

function ListaCupones({
  cupones,
  niveles,
  verificada,
}: {
  cupones: CuponMarca[];
  niveles: { level: number; name: string }[];
  verificada: boolean;
}) {
  const [editando, setEditando] = useState<CuponEditable | null>(null);

  if (cupones.length === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        Todavía no creaste ningún cupón. Empezá por &quot;+ Nuevo cupón&quot;.
      </div>
    );
  }

  return (
    <>
    <div className={styles.cardsGrid}>
      {cupones.map((c) => {
        const usados = c.stockTotal - c.stockAvailable;
        const porcentaje = c.stockTotal > 0 ? (usados / c.stockTotal) * 100 : 0;

        return (
          <div
            key={c.id}
            className={`${styles.card} ${styles.cardPad}`}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {c.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.imageUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "132px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                }}
              />
            )}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span className={`${styles.riskPill} ${styles[ESTADO_PILL[c.status] ?? "riskMuted"]}`}>
                {ESTADO_LABEL[c.status] ?? c.status}
              </span>
              <span className={`${styles.riskPill} ${styles.riskMuted}`}>
                {LABEL_TIPO_CUPON[c.type] ?? c.type}
              </span>
            </div>

            <h3 style={{ fontSize: "15.5px", fontWeight: 800, lineHeight: 1.3 }}>{c.title}</h3>
            <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>{c.description}</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: "12px", color: "var(--ink-3)" }}>
              <span>
                Audiencia:{" "}
                <b style={{ color: "var(--ink-2)" }}>{c.minLevel === 1 ? "Todos" : `${c.minLevelName}+`}</b>
              </span>
              <span>
                Vigencia: <b style={{ color: "var(--ink-2)" }}>{c.vigencia}</b>
              </span>
            </div>

            {c.eventLocation && (
              <div style={{ fontSize: "12px", color: "var(--ink-3)" }}>📍 {c.eventLocation}</div>
            )}

            <div>
              <div style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "5px" }}>
                Stock:{" "}
                <b style={{ color: "var(--ink-2)" }}>
                  {c.stockAvailable} de {c.stockTotal} disponibles
                </b>
              </div>
              <div className={styles.loadTrack}>
                <div className={styles.loadFill} style={{ width: `${porcentaje}%`, background: "#6d54f3" }} />
              </div>
            </div>

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

            <div style={{ marginTop: "auto", paddingTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {c.status !== "publicado" && c.status !== "vencido" && (
                <form action={cambiarEstadoCuponAction}>
                  <input type="hidden" name="coupon_id" value={c.id} />
                  <input type="hidden" name="status" value="publicado" />
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
                    {c.status === "pausado" ? "Reactivar" : "Publicar"}
                  </button>
                </form>
              )}
              {c.status === "publicado" && (
                <form action={cambiarEstadoCuponAction}>
                  <input type="hidden" name="coupon_id" value={c.id} />
                  <input type="hidden" name="status" value="pausado" />
                  <button type="submit" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
                    Pausar
                  </button>
                </form>
              )}
              {c.status !== "vencido" && (
                <button
                  type="button"
                  onClick={() =>
                    setEditando({
                      id: c.id,
                      title: c.title,
                      description: c.description,
                      type: c.type,
                      minLevel: c.minLevel,
                      stockTotal: c.stockTotal,
                      claimValidityDays: c.claimValidityDays,
                      eventDateInput: c.eventDateInput,
                      eventLocation: c.eventLocation,
                      conditions: c.conditions,
                      imageUrl: c.imageUrl,
                    })
                  }
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                >
                  Editar
                </button>
              )}
              {/* Solo se puede borrar lo que nadie reclamó: si alguien ya tiene
                  el código, borrar el cupón le desaparece el QR de la mano. */}
              {usados === 0 && (
                <ConfirmDeleteButton
                  action={async () => {
                    const fd = new FormData();
                    fd.set("coupon_id", c.id);
                    await borrarCuponAction(fd);
                  }}
                  confirmMessage={`Se borra el cupón "${c.title}". Nadie lo reclamó todavía.`}
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                >
                  Borrar
                </ConfirmDeleteButton>
              )}
            </div>
          </div>
        );
      })}
    </div>

    {editando && (
      <div className={styles.modalOverlay} onClick={() => setEditando(null)}>
        <div
          className={styles.modalCard}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "680px", maxHeight: "88vh", overflowY: "auto" }}
        >
          <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Editar cupón</h2>
          <CuponForm
            cupon={editando}
            niveles={niveles}
            verificada={verificada}
            onListo={() => setEditando(null)}
          />
        </div>
      </div>
    )}
    </>
  );
}

function Validador({ nombreMarca }: { nombreMarca: string }) {
  const [busqueda, buscarAction, buscando] = useActionState<BusquedaState, FormData>(
    buscarCodigoAction,
    null
  );
  const [canje, canjearFormAction, canjeando] = useActionState<CanjeState, FormData>(canjearAction, null);

  const encontrado = busqueda && "reclamo" in busqueda ? busqueda.reclamo : null;
  const yaCanjeado = canje && "ok" in canje;

  return (
    <div className={`${styles.card} ${styles.cardPad}`} style={{ maxWidth: "560px" }}>
      <h2 style={{ fontSize: "16px", marginBottom: "6px" }}>Validar un canje</h2>
      <p style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "18px" }}>
        Escaneá el QR del creador con la cámara de tu teléfono, o digitá acá el código corto que te
        muestra.
      </p>

      <form action={buscarAction}>
        <div className={styles.field}>
          <label htmlFor="code">Código del cupón</label>
          <input
            id="code"
            name="code"
            placeholder="QL-XXXX-XX"
            className={styles.inp}
            style={{
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          />
        </div>
        <button type="submit" disabled={buscando} className={`${styles.btn} ${styles.btnPrimary}`}>
          {buscando ? "Buscando…" : "Buscar código"}
        </button>
      </form>

      {busqueda && "error" in busqueda && busqueda.error && (
        <div
          className={styles.card}
          style={{ marginTop: "16px", padding: "14px", borderColor: "var(--risk)" }}
        >
          <b style={{ color: "var(--risk)" }}>
            No encontramos ese código entre los cupones de {nombreMarca}.
          </b>
          <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
            Puede estar mal digitado, o ser de <b>otro negocio</b>: cada cuenta solo valida los
            cupones que publicó. Si el cupón es de otro local tuyo, entrá con esa cuenta.
          </p>
        </div>
      )}

      {encontrado && (
        <div
          className={styles.card}
          style={{
            marginTop: "16px",
            padding: "16px",
            borderColor: yaCanjeado ? "var(--ok)" : encontrado.status === "reclamado" ? "var(--ok)" : "var(--warn)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <span
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                background: "var(--surface-3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "13px",
                overflow: "hidden",
              }}
            >
              {encontrado.creatorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={encontrado.creatorAvatar}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                encontrado.creatorHandle.replace(/^@/, "").slice(0, 2).toUpperCase()
              )}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <b>{encontrado.creatorHandle}</b>
                <span className={`${styles.riskPill} ${styles.riskMuted}`}>{encontrado.creatorLevelName}</span>
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "2px" }}>
                {encontrado.couponTitle}
              </div>
            </div>
          </div>

          {encontrado.esEvento && (
            <div
              style={{
                fontSize: "11.5px",
                lineHeight: 1.45,
                padding: "8px 10px",
                borderRadius: "8px",
                background: "var(--warn-bg)",
                color: "var(--warn)",
                marginBottom: "12px",
              }}
            >
              🎟️ Entrada al evento — el consumo corre por cuenta del creador.
            </div>
          )}

          {yaCanjeado ? (
            <div>
              <b style={{ color: "var(--ok)" }}>Canje confirmado ✓</b>
              <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
                Quedó registrado en tus canjes. El código está quemado.
              </p>
            </div>
          ) : encontrado.status === "canjeado" ? (
            <div>
              <b style={{ color: "var(--warn)" }}>Este código ya fue canjeado.</b>
              <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
                Cada código se quema al confirmarse — un canje por creador por cupón.
              </p>
            </div>
          ) : encontrado.status === "expirado" ? (
            <div>
              <b style={{ color: "var(--warn)" }}>Este código venció.</b>
              <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
                El creador puede volver a reclamar el cupón si todavía queda stock.
              </p>
            </div>
          ) : (
            <form action={canjearFormAction}>
              <input type="hidden" name="code" value={encontrado.code} />
              <button
                type="submit"
                disabled={canjeando}
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ width: "100%" }}
              >
                {canjeando ? "Confirmando…" : "✓ Confirmar canje"}
              </button>
            </form>
          )}

          {canje && "error" in canje && canje.error && (
            <p style={{ fontSize: "12.5px", color: "var(--risk)", marginTop: "10px" }}>{canje.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TablaCanjes({ canjes }: { canjes: CanjeFila[] }) {
  if (canjes.length === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        Todavía nadie reclamó un cupón tuyo.
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${styles.cardPad}`}>
      <table className={styles.acctTable}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Creador</th>
            <th>Nivel</th>
            <th>Cupón</th>
            <th>Código</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {canjes.map((c) => (
            <tr key={c.id}>
              <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>{c.fecha}</td>
              <td>
                <b>{c.handle}</b>
              </td>
              <td>
                <span className={`${styles.riskPill} ${styles.riskMuted}`}>{c.nivel}</span>
              </td>
              <td>{c.cupon}</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{c.code}</td>
              <td>
                <span
                  className={`${styles.riskPill} ${
                    c.status === "canjeado"
                      ? styles.riskOk
                      : c.status === "expirado"
                        ? styles.riskMuted
                        : styles.riskWarn
                  }`}
                >
                  {c.status === "canjeado" ? "Canjeado" : c.status === "expirado" ? "Expirado" : "Reclamado"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
