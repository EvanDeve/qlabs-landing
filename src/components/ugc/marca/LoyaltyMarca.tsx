"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  cambiarEstadoCuponAction,
  borrarCuponAction,
  canjearAction,
  type CanjeState,
} from "@/lib/actions/cupones";
import CuponForm from "./CuponForm";
import { buscarCodigoAction, type BusquedaState } from "@/lib/actions/validar";
import { ESTADO_CUPON, LABEL_TIPO_CUPON, LEYENDA_EVENTO } from "@/lib/ugc/loyalty";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import EscanearQR from "./EscanearQR";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";
import QrCupon from "./QrCupon";
import { CF } from "@/lib/cf/copy";
import type { CuponMarca, CanjeFila, MiembroFila, NivelOpcion } from "@/lib/ugc/loyalty-panel";
import type { CouponAudience } from "@/lib/database.types";

/**
 * Las piezas de cliente de Loyalty de la marca. Hasta el rediseño de
 * 2026-09-29 esto era una sola pantalla con pestañas (Cupones · Canjes ·
 * Clientes); ahora cada una tiene su ruta bajo `/ugc/marca/loyalty/*` y el
 * inicio es un índice. Los datos los arma `cargarLoyaltyMarca`.
 */

const PARA_QUIEN: Record<CouponAudience, string> = {
  creators: "creadores",
  members: "clientes",
  both: "creadores y clientes",
};

/**
 * Un cupón entero: lo que antes era su tarjeta en la lista. Acá viven el QR,
 * publicar/pausar y borrar; la lista del inicio es solo para elegir.
 */
export function CuponDetalle({ c, niveles }: { c: CuponMarca; niveles: NivelOpcion[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const usados = c.stockTotal - c.stockAvailable;
  const porcentaje = c.stockTotal > 0 ? (usados / c.stockTotal) * 100 : 0;

  return (
    <>
      <div className={styles.mcCard}>
        {c.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" className={styles.mcCuponFoto} />
        )}

        <div className={styles.mcCardTop}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.mcCardTitulo}>{c.title}</div>
            <div className={styles.mcCardMeta}>
              {LABEL_TIPO_CUPON[c.type] ?? c.type} · para {PARA_QUIEN[c.audience]}
              {c.audience !== "members" && c.minLevel > 1 ? ` (nivel ${c.minLevelName} o más)` : ""}
            </div>
          </div>
          <span
            className={`${styles.lmPill} ${
              c.status === "publicado" ? styles.lmPillOk : c.status === "borrador" ? styles.lmPillBorrador : ""
            }`}
          >
            {ESTADO_CUPON[c.status] ?? c.status}
          </span>
        </div>

        {c.description && <p className={styles.mcCuponDesc}>{c.description}</p>}

        {/* El stock: cuánto queda, no cuánto se usó. Lo que decide si hay que
            reponer es el número de la derecha. */}
        <div className={styles.mcStock}>
          <div className={styles.mcStockFila}>
            <span>Stock</span>
            <b>
              {c.stockAvailable} de {c.stockTotal} disponibles
            </b>
          </div>
          <div className={styles.mcStockVia}>
            <div className={styles.mcStockFill} style={{ width: `${porcentaje}%` }} />
          </div>
        </div>

        <div className={styles.mcCuponTabla}>
          <div className={styles.mcCanjeFila}>
            <span className={styles.mcCanjeK}>{c.type === "evento" ? "Fecha del evento" : "Vigencia"}</span>
            <span className={styles.mcCanjeV}>{c.vigencia}</span>
          </div>
          {c.type === "evento" && c.eventLocation && (
            <div className={styles.mcCanjeFila}>
              <span className={styles.mcCanjeK}>Lugar</span>
              <span className={styles.mcCanjeV}>{c.eventLocation}</span>
            </div>
          )}
          {c.conditions && (
            <div className={styles.mcCanjeFila}>
              <span className={styles.mcCanjeK}>Condiciones</span>
              <span className={styles.mcCanjeV}>{c.conditions}</span>
            </div>
          )}
          {c.reclamosVigentes > 0 && (
            <div className={styles.mcCanjeFila}>
              <span className={styles.mcCanjeK}>
                {c.reclamosVigentes === 1 ? "Código sin usar" : "Códigos sin usar"}
              </span>
              <span className={styles.mcCanjeV}>
                {c.reclamosVigentes}
                {c.ultimoVence && ` · vence el ${c.ultimoVence}`}
              </span>
            </div>
          )}
        </div>

        {c.type === "evento" && <p className={styles.mcCanjeAviso}>🎟️ {LEYENDA_EVENTO}</p>}

        {c.qr && <QrCupon qr={c.qr} />}

        <div className={styles.mcAplicanteBotones}>
          {c.status !== "vencido" && (
            <button type="button" onClick={() => setEditando(true)} className={styles.mcAceptar}>
              Editar
            </button>
          )}
          {c.status !== "publicado" && c.status !== "vencido" && (
            <form action={cambiarEstadoCuponAction} style={{ flex: 1, display: "flex" }}>
              <input type="hidden" name="coupon_id" value={c.id} />
              <input type="hidden" name="status" value="publicado" />
              <button type="submit" className={styles.mcVerBook}>
                {c.status === "pausado" ? "Reactivar" : "Publicar"}
              </button>
            </form>
          )}
          {c.status === "publicado" && (
            <form action={cambiarEstadoCuponAction} style={{ flex: 1, display: "flex" }}>
              <input type="hidden" name="coupon_id" value={c.id} />
              <input type="hidden" name="status" value="pausado" />
              <button type="submit" className={styles.mcVerBook}>
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
                router.push("/ugc/marca/loyalty");
              }}
              confirmMessage={`Se borra el cupón "${c.title}". No se puede deshacer.`}
              className={styles.mcRechazar}
            >
              <QosIcon name="x" size={16} />
            </ConfirmDeleteButton>
          )}
        </div>

        {c.reclamosVigentes > 0 && (
          <p className={styles.mcCuponNota}>
            {c.status === "pausado"
              ? "Está pausado, pero el código que ya reclamaron sigue valiendo."
              : "Si lo pausás, el código que ya reclamaron sigue valiendo."}
          </p>
        )}
      </div>

      {editando && (
        <CuponForm
          cupon={{
            id: c.id,
            title: c.title,
            description: c.description,
            type: c.type,
            minLevel: c.minLevel,
            stockTotal: c.stockTotal,
            reclamados: usados,
            claimValidityDays: c.claimValidityDays,
            eventDateInput: c.eventDateInput,
            eventLocation: c.eventLocation,
            conditions: c.conditions,
            imageUrl: c.imageUrl,
            audience: c.audience,
            memberScope: c.memberScope,
          }}
          niveles={niveles}
          onCerrar={() => setEditando(false)}
        />
      )}
    </>
  );
}

export function Validador({ nombreMarca }: { nombreMarca: string }) {
  const [busqueda, buscarAction, buscando] = useActionState<BusquedaState, FormData>(
    buscarCodigoAction,
    null
  );
  const [canje, canjearFormAction, canjeando] = useActionState<CanjeState, FormData>(canjearAction, null);
  const [codigo, setCodigo] = useState("");

  const encontrado = busqueda && "reclamo" in busqueda ? busqueda.reclamo : null;
  const yaCanjeado = canje && "ok" in canje;

  /**
   * El escaneo busca solo, sin pedir un toque más.
   *
   * La acción se despacha con un FormData armado a mano en vez de rellenar el
   * campo y enviar el formulario: `setCodigo` no llega a pintarse en el mismo
   * tick, así que un `requestSubmit()` acá mandaría el valor anterior.
   */
  function alEscanear(code: string) {
    setCodigo(code);
    const fd = new FormData();
    fd.set("code", code);
    buscarAction(fd);
  }

  return (
    <div id="buscar" className={`${styles.card} ${styles.cardPad}`} style={{ maxWidth: "560px", marginTop: 24 }}>
      <h2 style={{ fontSize: "16px", marginBottom: "6px" }}>Validar un canje</h2>
      <p style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "18px" }}>
        Escaneá el QR del creador o del cliente con la cámara, o digitá acá el código corto que te muestra.
      </p>

      <EscanearQR onCodigo={alEscanear} />

      <form action={buscarAction}>
        <div className={styles.field}>
          <label htmlFor="code">Código del cupón</label>
          <input
            id="code"
            name="code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
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

export function TablaCanjes({ canjes }: { canjes: CanjeFila[] }) {
  if (canjes.length === 0) {
    return (
      <div className={styles.mcVacio}>
        <QosIcon name="grid" size={26} className={styles.trVacioIc} />
        <p className={styles.mcVacioTxt}>Todavía nadie reclamó un cupón tuyo.</p>
      </div>
    );
  }

  // Los que esperan van arriba y con tarjeta: son los únicos que piden algo de
  // la marca. Los ya cerrados son historial y van en fila compacta.
  const esperando = canjes.filter((c) => c.status === "reclamado");
  const cerrados = canjes.filter((c) => c.status !== "reclamado");

  return (
    <>
      {esperando.length > 0 && (
        <>
          <h2 className={styles.mcSecTit}>Esperando que lleguen al local</h2>
          {esperando.map((c) => (
            <div key={c.id} className={styles.mcCard}>
              <div className={styles.mcAplicanteTop}>
                <span className={styles.mcDecididoFoto}>
                  {c.handle.replace(/^@/, "").slice(0, 2).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.mcAplicanteNombre}>
                    {c.handle}
                    <span className={styles.mcChip}>{c.nivel}</span>
                  </div>
                  <div className={styles.mcAplicanteMeta}>{c.cupon}</div>
                </div>
              </div>

              <div className={styles.mcCuponTabla}>
                <div className={styles.mcCanjeFila}>
                  <span className={styles.mcCanjeK}>Código</span>
                  <span className={`${styles.mcCanjeV} ${styles.mcCanjeCodigo}`}>{c.code}</span>
                </div>
                <div className={styles.mcCanjeFila}>
                  <span className={styles.mcCanjeK}>Reclamado</span>
                  <span className={styles.mcCanjeV}>{c.fecha}</span>
                </div>
                {c.vence && (
                  <div className={styles.mcCanjeFila}>
                    <span className={styles.mcCanjeK}>Vence</span>
                    <span className={styles.mcCanjeV}>
                      {c.vence}
                      {c.diasRestantes != null &&
                        c.diasRestantes > 0 &&
                        ` · en ${c.diasRestantes} día${c.diasRestantes === 1 ? "" : "s"}`}
                    </span>
                  </div>
                )}
              </div>

              <Link
                href={`/ugc/marca/validar/${encodeURIComponent(c.code)}`}
                className={styles.mcDecidirBtn}
                style={{ marginTop: 13 }}
              >
                <QosIcon name="grid" size={16} />
                <span style={{ marginLeft: 7 }}>Validar este canje</span>
              </Link>
            </div>
          ))}
        </>
      )}

      {cerrados.length > 0 && (
        <>
          <h2 className={styles.mcSecTit} style={{ marginTop: esperando.length > 0 ? 24 : 0 }}>
            Ya canjeados
          </h2>
          <div className={styles.trLista}>
            {cerrados.map((c) => (
              <div key={c.id} className={styles.mcDecidido}>
                <span className={styles.mcDecididoFoto}>
                  {c.handle.replace(/^@/, "").slice(0, 2).toUpperCase()}
                </span>
                <span className={styles.mcDecididoTxt}>
                  <span className={styles.mcDecididoNombre}>{c.handle}</span>
                  <span className={styles.mcDecididoSub}>
                    {c.cupon}
                    {c.fecha && ` · ${c.fecha}`}
                  </span>
                </span>
                <span
                  className={`${styles.mcEstado} ${
                    c.status === "canjeado" ? "" : styles.mcEstadoQuieto
                  }`}
                >
                  {c.status === "canjeado" ? "Canjeado" : "Vencido"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/**
 * Los clientes de la marca que se unieron a Close Friends. El contacto solo
 * aparece si la persona lo compartió con ESTE negocio; si no, es su nombre de
 * agente y nada más — así lo decide la base, no esta pantalla.
 */
export function ListaMiembros({ miembros }: { miembros: MiembroFila[] }) {
  if (miembros.length === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        Todavía no se unió nadie. Creá un cupón para clientes y mostrá su QR en tu local: quien lo escanea se une a{" "}
        {CF.programa} y aparece acá.
      </div>
    );
  }

  const conContacto = miembros.filter((m) => m.comparte).length;

  return (
    <>
      <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 2px 12px" }}>
        {conContacto} de {miembros.length} te compartieron su contacto. El resto lo ves solo por su nombre de agente.
      </p>
      <div className={styles.histCard}>
        {miembros.map((m) => (
          <div key={m.id} className={styles.usadoFila} style={{ alignItems: "flex-start" }}>
            <span
              aria-hidden
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "#ECE7FB",
                color: "#5641D8",
                fontWeight: 800,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {m.agente.slice(0, 1).toUpperCase()}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className={styles.usadoTitulo}>{m.agente}</div>
              {m.comparte ? (
                <div className={styles.usadoDetalle} style={{ lineHeight: 1.5 }}>
                  {m.nombre}
                  <br />
                  {m.telefono && (
                    <a href={`https://wa.me/${m.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "#5641D8", fontWeight: 700 }}>
                      {m.telefono}
                    </a>
                  )}
                  {m.email && <> · {m.email}</>}
                </div>
              ) : (
                <div className={styles.usadoDetalle}>No compartió su contacto</div>
              )}
              <div className={styles.usadoDetalle} style={{ marginTop: 4 }}>
                Desde {m.desde}
                {m.origen && <> · por &quot;{m.origen}&quot;</>} · {m.reclamados}{" "}
                {m.reclamados === 1 ? "reclamo" : "reclamos"} · {m.canjeados}{" "}
                {m.canjeados === 1 ? "canje" : "canjes"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
