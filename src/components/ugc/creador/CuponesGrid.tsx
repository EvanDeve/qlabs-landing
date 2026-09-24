"use client";

import { useActionState, useState } from "react";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import CuponQR, { type CuponQRData } from "@/components/ugc/creador/CuponQR";
import { reclamarCuponAction, type ReclamarState } from "@/lib/actions/loyalty";
import { LABEL_TIPO_CUPON, LEYENDA_EVENTO, diasRestantes } from "@/lib/ugc/loyalty";
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
  brandLocation: string | null;
  brandLogo: string | null;
  imageUrl: string | null;
  stockAvailable: number;
  stockTotal: number;
  /** Ya formateada en el servidor, con la zona horaria de Costa Rica. */
  vigencia: string;
  /** La misma vigencia en corto, para el chip de la tarjeta. */
  vigenciaChip: string | null;
  eventLocation: string | null;
  reclamo: {
    code: string;
    status: string;
    venceTexto: string;
    qr: string | null;
  } | null;
};

const FILTROS = [
  { valor: "todos", label: "Todos" },
  { valor: "producto", label: "Producto" },
  { valor: "servicio", label: "Servicio" },
  { valor: "evento", label: "Evento" },
];

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
  // qué cupón nombrar en el QR.
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [manual, setManual] = useState<CuponQRData | null>(null);
  const [descartado, setDescartado] = useState<string | null>(null);
  const [tipo, setTipo] = useState("todos");
  const [filtroAbierto, setFiltroAbierto] = useState(false);

  // El QR de un reclamo recién hecho se DERIVA del resultado del action, no se
  // copia a estado dentro de un efecto: copiarlo obliga a un render extra y
  // deja dos fuentes de verdad que se pueden desincronizar. `descartado` es lo
  // único que hace falta para poder cerrarlo.
  const cuponReclamado = ultimo ? cupones.find((c) => c.id === ultimo) : undefined;
  const fresco: CuponQRData | null =
    state?.reclamo && cuponReclamado && state.reclamo.code !== descartado
      ? {
          code: state.reclamo.code,
          qr: state.reclamo.qr,
          title: cuponReclamado.title,
          brandName: cuponReclamado.brandName,
          brandLocation: cuponReclamado.brandLocation,
          type: cuponReclamado.type,
          venceTexto: new Date(state.reclamo.expires_at).toLocaleDateString("es-CR", {
            day: "numeric",
            month: "long",
            timeZone: "America/Costa_Rica",
          }),
          diasRestantes: diasRestantes(state.reclamo.expires_at),
        }
      : null;

  const abierto = manual ?? fresco;
  const cerrarQR = () => {
    if (manual) setManual(null);
    else if (fresco) setDescartado(fresco.code);
  };

  const visibles = tipo === "todos" ? cupones : cupones.filter((c) => c.type === tipo);
  // "Para tu nivel" es lo que puede reclamar hoy: desbloqueado, con stock y sin
  // reclamar. Los bloqueados siguen en la lista más abajo —son el motivo para
  // seguir entregando— pero no entran en esta cuenta.
  const paraSuNivel = visibles.filter(
    (c) => nivelActual >= c.minLevel && c.stockAvailable > 0 && !c.reclamo
  ).length;

  return (
    <>
      <div className={styles.recListaHead}>
        <span>
          {paraSuNivel === 1 ? "1 cupón para tu nivel" : `${paraSuNivel} cupones para tu nivel`}
        </span>
        <button type="button" className={styles.recFiltrar} onClick={() => setFiltroAbierto((v) => !v)}>
          {filtroAbierto ? "Listo" : "Filtrar"}
        </button>
      </div>

      {filtroAbierto && (
        <div className={styles.filterRow} style={{ marginBottom: "14px" }}>
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={`${styles.filterChip} ${tipo === f.valor ? styles.filterChipOn : ""}`}
              onClick={() => setTipo(f.valor)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {visibles.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          No hay cupones de ese tipo por ahora.
        </div>
      ) : (
        <div className={styles.recLista}>
          {visibles.map((c) => {
            const desbloqueado = nivelActual >= c.minLevel;
            const agotado = c.stockAvailable <= 0;
            const reclamado = c.reclamo?.status === "reclamado";
            const canjeado = c.reclamo?.status === "canjeado";
            const vencido = c.reclamo?.status === "expirado";
            const error = state?.error && ultimo === c.id ? state.error : null;

            return (
              <div key={c.id} className={styles.cuponCard} style={{ opacity: desbloqueado ? 1 : 0.75 }}>
                {/* La foto es lo que hace que un cupón se vea deseable al lado
                    de otros cinco — por eso existe `coupons.image_url`. Solo
                    aparece si la marca subió una; sin foto la tarjeta se ve
                    igual que siempre. */}
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className={styles.cuponFoto} />
                )}
                <div className={styles.cuponHead}>
                  <BrandAvatar name={c.brandName} logoUrl={c.brandLogo} size={44} radius={14} />
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.cuponTitulo}>{c.title}</div>
                    <div className={styles.cuponMarca}>
                      {[c.brandName, c.brandLocation].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>

                <div className={styles.cuponChips}>
                  <span className={styles.cuponChip}>{LABEL_TIPO_CUPON[c.type] ?? c.type}</span>
                  {c.vigenciaChip && <span className={styles.cuponChip}>{c.vigenciaChip}</span>}
                  <span className={`${styles.cuponChip} ${agotado ? styles.cuponChipAlerta : ""}`}>
                    {agotado ? "Agotado" : `Quedan ${c.stockAvailable}`}
                  </span>
                </div>

                {c.eventLocation && <p className={styles.cuponNota}>📍 {c.eventLocation}</p>}
                {c.type === "evento" && <p className={styles.cuponNota}>🎟️ {LEYENDA_EVENTO}</p>}
                {c.conditions && <p className={styles.cuponNota}>{c.conditions}</p>}
                {error && (
                  <p className={styles.cuponNota} style={{ color: "var(--risk)" }}>
                    {error}
                  </p>
                )}

                <div style={{ marginTop: "14px" }}>
                  {!desbloqueado ? (
                    <div className={styles.cuponBloqueo}>
                      Te faltan {c.puntosFaltantes.toLocaleString("es-CR")} pts para desbloquearlo
                    </div>
                  ) : canjeado ? (
                    <div className={styles.cuponBloqueo}>✓ Ya lo canjeaste</div>
                  ) : vencido ? (
                    <div className={styles.cuponBloqueo}>Venció sin usarse</div>
                  ) : reclamado ? (
                    <button
                      type="button"
                      className={styles.btnAplicar}
                      onClick={() =>
                        setManual({
                          code: c.reclamo!.code,
                          qr: c.reclamo!.qr,
                          title: c.title,
                          brandName: c.brandName,
                          brandLocation: c.brandLocation,
                          type: c.type,
                          venceTexto: c.reclamo!.venceTexto,
                          diasRestantes: null,
                        })
                      }
                    >
                      Ver mi QR
                    </button>
                  ) : agotado ? (
                    <div className={styles.cuponBloqueo}>Se agotó — no quedan lugares</div>
                  ) : confirmando === c.id ? (
                    /* Reclamar es irreversible: un canje por creador por cupón,
                       sin deshacer. Un toque accidental en el celular quemaba la
                       única oportunidad de esa persona y le descontaba stock a la
                       marca. La confirmación es in-page y no `window.confirm`,
                       que congela la automatización del navegador. */
                    <div>
                      <p className={styles.cuponNota} style={{ marginBottom: "10px" }}>
                        Vas a reclamar <b>{c.title}</b>. Tenés <b>{c.vigencia.toLowerCase()}</b> para
                        usarlo y <b>no se puede reclamar de nuevo</b>.
                      </p>
                      <form action={formAction} onSubmit={() => setUltimo(c.id)}>
                        <input type="hidden" name="coupon_id" value={c.id} />
                        <button type="submit" disabled={pending} className={styles.btnAplicar}>
                          {pending && ultimo === c.id ? "Reclamando…" : "Sí, reclamarlo"}
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className={styles.recFiltrar}
                        style={{ display: "block", margin: "10px auto 0" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(c.id)}
                      className={styles.btnAplicar}
                    >
                      Reclamar cupón
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {abierto && <CuponQR cupon={abierto} onClose={cerrarQR} />}
    </>
  );
}
