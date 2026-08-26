"use client";

import Link from "next/link";

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
import EscanearQR from "./EscanearQR";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";
import PantallaHeader from "@/components/ugc/PantallaHeader";

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
  reclamosVigentes: number;
  ultimoVence: string | null;
};

export type CanjeFila = {
  id: string;
  fecha: string;
  handle: string;
  nivel: string;
  cupon: string;
  code: string;
  status: string;
  vence: string | null;
  diasRestantes: number | null;
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
  nombreMarca,
}: {
  cupones: CuponMarca[];
  canjes: CanjeFila[];
  niveles: { level: number; name: string }[];
  nombreMarca: string;
}) {
  const [tab, setTab] = useState<Tab>("cupones");

  const activos = cupones.filter((c) => c.status === "publicado").length;
  const reclamados = canjes.filter((c) => c.status === "reclamado").length;
  const hechos = canjes.filter((c) => c.status === "canjeado").length;

  if (tab === "nuevo") {
    return (
      <>
        <div className={styles.mcFormBar}>
          <button type="button" onClick={() => setTab("cupones")} className={styles.mcCancelar}>
            Cancelar
          </button>
          <span className={styles.mcFormTitulo}>Nuevo cupón</span>
        </div>
        {/* Vuelve a la lista al guardar: es una acción con principio y fin, no
            una pestaña donde quedarse. */}
        <CuponForm niveles={niveles} onListo={() => setTab("cupones")} />
      </>
    );
  }

  return (
    <>
      <PantallaHeader
        titulo="Loyalty"
        descripcion="Cupones para que los creadores lleguen a tu local."
        accion={
          <button type="button" className={styles.mcNuevo} onClick={() => setTab("nuevo")}>
            <QosIcon name="plus" size={15} />
            Nuevo
          </button>
        }
      />

      {/* La tarjeta negra lleva a la cámara. Es el gesto que se hace con alguien
          parado enfrente, así que va arriba de todo y no escondido en una
          pestaña. */}
      <Link href="/ugc/marca/validar" className={styles.mcValidarCard}>
        <span className={styles.mcValidarIc}>
          <QosIcon name="grid" size={20} />
        </span>
        <span className={styles.mcDecidirTxt}>
          <span className={styles.mcDecidirNum}>Validar un canje</span>
          <span className={styles.mcDecidirSub}>Escaneá el QR del creador</span>
        </span>
        <QosIcon name="chevR" size={17} />
      </Link>

      <div className={styles.mcStats}>
        {(
          [
            [activos, activos === 1 ? "cupón activo" : "cupones activos"],
            [reclamados, reclamados === 1 ? "reclamado" : "reclamados"],
            [hechos, hechos === 1 ? "canje hecho" : "canjes hechos"],
          ] as const
        ).map(([n, label]) => (
          <div key={label} className={styles.mcStat}>
            <div className={styles.mcStatNum}>{n}</div>
            <div className={styles.mcStatLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div className={styles.trTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "cupones"}
          onClick={() => setTab("cupones")}
          className={`${styles.trTabBtn} ${tab === "cupones" ? styles.trTabOn : ""}`}
        >
          Cupones{cupones.length > 0 ? ` · ${cupones.length}` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "canjes"}
          onClick={() => setTab("canjes")}
          className={`${styles.trTabBtn} ${tab === "canjes" ? styles.trTabOn : ""}`}
        >
          Canjes{canjes.length > 0 ? ` · ${canjes.length}` : ""}
        </button>
      </div>

      {tab === "cupones" ? (
        <ListaCupones cupones={cupones} niveles={niveles} />
      ) : (
        <>
          <TablaCanjes canjes={canjes} />
          {/* El buscador manual vive con los canjes: es la salida para cuando la
              cámara no sirve, y es adonde manda "Buscar el código a mano" de la
              pantalla del escáner. */}
          <Validador nombreMarca={nombreMarca} />
        </>
      )}
    </>
  );
}

function ListaCupones({
  cupones,
  niveles,
}: {
  cupones: CuponMarca[];
  niveles: { level: number; name: string }[];
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
    <div>
      {cupones.map((c) => {
        const usados = c.stockTotal - c.stockAvailable;
        const porcentaje = c.stockTotal > 0 ? (usados / c.stockTotal) * 100 : 0;

        return (
          <div key={c.id} className={styles.mcCard}>
            {c.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt="" className={styles.mcCuponFoto} />
            )}

            <div className={styles.mcCardTop}>
              <div style={{ minWidth: 0 }}>
                <div className={styles.mcCardTitulo}>{c.title}</div>
                <div className={styles.mcCardMeta}>
                  {LABEL_TIPO_CUPON[c.type] ?? c.type}
                  {c.minLevel > 1 ? ` · para nivel ${c.minLevelName} o más` : " · para todos"}
                </div>
              </div>
              <span
                className={`${styles.mcEstado} ${
                  c.status === "publicado" ? "" : styles.mcEstadoQuieto
                }`}
              >
                {ESTADO_LABEL[c.status] ?? c.status}
              </span>
            </div>

            {c.description && <p className={styles.mcCuponDesc}>{c.description}</p>}

            {/* El stock: cuánto queda, no cuánto se usó. Lo que decide si hay
                que reponer es el número de la derecha. */}
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
              {c.claimValidityDays && (
                <div className={styles.mcCanjeFila}>
                  <span className={styles.mcCanjeK}>Vigencia del reclamo</span>
                  <span className={styles.mcCanjeV}>{c.claimValidityDays} días</span>
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

            <div className={styles.mcAplicanteBotones}>
              {c.status !== "publicado" && c.status !== "vencido" && (
                <form action={cambiarEstadoCuponAction} style={{ flex: 1 }}>
                  <input type="hidden" name="coupon_id" value={c.id} />
                  <input type="hidden" name="status" value="publicado" />
                  <button type="submit" className={styles.mcVerBook} style={{ width: "100%" }}>
                    {c.status === "pausado" ? "Reactivar" : "Publicar"}
                  </button>
                </form>
              )}
              {c.status === "publicado" && (
                <form action={cambiarEstadoCuponAction} style={{ flex: 1 }}>
                  <input type="hidden" name="coupon_id" value={c.id} />
                  <input type="hidden" name="status" value="pausado" />
                  <button type="submit" className={styles.mcVerBook} style={{ width: "100%" }}>
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
                  className={styles.mcAceptar}
                  style={{ background: "var(--b-100)", color: "var(--b-700)" }}
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
          <CuponForm cupon={editando} niveles={niveles} onListo={() => setEditando(null)} />
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
    <div className={`${styles.card} ${styles.cardPad}`} style={{ maxWidth: "560px" }}>
      <h2 style={{ fontSize: "16px", marginBottom: "6px" }}>Validar un canje</h2>
      <p style={{ fontSize: "13px", color: "var(--ink-2)", marginBottom: "18px" }}>
        Escaneá el QR del creador con la cámara, o digitá acá el código corto que te muestra.
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

function TablaCanjes({ canjes }: { canjes: CanjeFila[] }) {
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
