"use client";

import { useActionState, useState } from "react";
import {
  crearCuponAction,
  cambiarEstadoCuponAction,
  borrarCuponAction,
  canjearAction,
  type CuponState,
  type CanjeState,
} from "@/lib/actions/cupones";
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
}: {
  cupones: CuponMarca[];
  canjes: CanjeFila[];
  niveles: { level: number; name: string }[];
  verificada: boolean;
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

      {tab === "cupones" && <ListaCupones cupones={cupones} />}
      {tab === "nuevo" && <FormularioCupon niveles={niveles} verificada={verificada} />}
      {tab === "validar" && <Validador />}
      {tab === "canjes" && <TablaCanjes canjes={canjes} />}
    </div>
  );
}

function ListaCupones({ cupones }: { cupones: CuponMarca[] }) {
  if (cupones.length === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        Todavía no creaste ningún cupón. Empezá por &quot;+ Nuevo cupón&quot;.
      </div>
    );
  }

  return (
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
  );
}

function FormularioCupon({
  niveles,
  verificada,
}: {
  niveles: { level: number; name: string }[];
  verificada: boolean;
}) {
  const [state, formAction, pending] = useActionState<CuponState, FormData>(crearCuponAction, null);
  const [tipo, setTipo] = useState("producto");

  return (
    <div className={`${styles.card} ${styles.cardPad}`} style={{ maxWidth: "760px" }}>
      <form action={formAction}>
        <div className={styles.field}>
          <label htmlFor="title">Título del cupón</label>
          <input id="title" name="title" required placeholder="Ej: 2x1 en cócteles de autor" className={styles.inp} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className={styles.field}>
            <label htmlFor="type">Tipo</label>
            <select
              id="type"
              name="type"
              className={styles.selectInp}
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
              <option value="evento">Evento</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="min_level">¿Quién puede reclamarlo?</label>
            <select id="min_level" name="min_level" className={styles.selectInp} defaultValue={1}>
              {niveles.map((n) => (
                <option key={n.level} value={n.level}>
                  {n.level === 1 ? "Todos los creadores" : `Nivel mínimo: ${n.name}`}
                </option>
              ))}
            </select>
            <p className={styles.fieldHint}>
              Los niveles altos reflejan entregas aprobadas y ratings reales.
            </p>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="description">Descripción — qué incluye exactamente</label>
          <textarea
            id="description"
            name="description"
            required
            rows={3}
            placeholder="Contale al creador qué recibe al canjear este cupón"
            className={styles.inp}
            style={{ resize: "vertical" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className={styles.field}>
            <label htmlFor="stock_total">Stock (canjes disponibles)</label>
            <input
              id="stock_total"
              name="stock_total"
              type="number"
              min={1}
              defaultValue={20}
              required
              className={styles.inp}
            />
          </div>

          {tipo !== "evento" && (
            <div className={styles.field}>
              <label htmlFor="claim_validity_days">Vigencia del reclamo</label>
              <select id="claim_validity_days" name="claim_validity_days" className={styles.selectInp} defaultValue={14}>
                <option value={7}>7 días desde el reclamo</option>
                <option value={14}>14 días desde el reclamo</option>
                <option value={30}>30 días desde el reclamo</option>
              </select>
              <p className={styles.fieldHint}>Si vence sin usarse, el código expira y el stock se libera.</p>
            </div>
          )}
        </div>

        {tipo === "evento" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div className={styles.field}>
                <label htmlFor="event_date">Fecha del evento</label>
                <input id="event_date" name="event_date" type="date" required className={styles.inp} />
              </div>
              <div className={styles.field}>
                <label htmlFor="event_location">Ubicación</label>
                <input
                  id="event_location"
                  name="event_location"
                  placeholder="Ej: Local principal, Escazú"
                  className={styles.inp}
                />
              </div>
            </div>
            <div
              style={{
                fontSize: "12px",
                lineHeight: 1.5,
                padding: "10px 12px",
                borderRadius: "10px",
                background: "var(--warn-bg)",
                color: "var(--warn)",
                marginBottom: "14px",
              }}
            >
              🎟️ <b>Leyenda automática en la ficha:</b> &quot;{LEYENDA_EVENTO}&quot; — no es editable.
              El QR vale hasta la fecha del evento, no por días desde el reclamo.
            </div>
          </>
        )}

        <div className={styles.field}>
          <label htmlFor="conditions">Condiciones adicionales (opcional)</label>
          <input
            id="conditions"
            name="conditions"
            placeholder="Ej: válido solo de lunes a jueves"
            className={styles.inp}
          />
        </div>

        {state && "error" in state && state.error && (
          <p style={{ fontSize: "13px", color: "var(--risk)", marginBottom: "12px" }}>{state.error}</p>
        )}
        {state && "ok" in state && state.ok && (
          <p style={{ fontSize: "13px", color: "var(--ok)", marginBottom: "12px" }}>{state.ok}</p>
        )}

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="submit"
            name="publicar"
            value="1"
            disabled={pending || !verificada}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {pending ? "Guardando…" : "Publicar cupón"}
          </button>
          <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnGhost}`}>
            Guardar borrador
          </button>
        </div>

        <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--ink-3)" }}>
          {verificada
            ? "Tu negocio está verificado ✓ — tus cupones se publican al instante. Un canje por creador por cupón."
            : "Tu negocio todavía está en revisión: podés dejar cupones en borrador y publicarlos apenas quede verificado."}
        </p>
      </form>
    </div>
  );
}

function Validador() {
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
          <b style={{ color: "var(--risk)" }}>No encontramos ese código.</b>
          <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
            Verificá que esté bien digitado o pedile al creador que muestre el QR de nuevo.
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
