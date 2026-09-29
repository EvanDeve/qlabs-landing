import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cargarLoyaltyMarca, type CuponMarca } from "@/lib/ugc/loyalty-panel";
import { diaCR } from "@/lib/ugc/calendar";
import { ESTADO_CUPON } from "@/lib/ugc/loyalty";
import PantallaHeader from "@/components/ugc/PantallaHeader";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { CF } from "@/lib/cf/copy";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

const PARA_QUIEN = { creators: "Creadores", members: "Clientes", both: "Creadores y clientes" } as const;

/** "1 activo · 1 borrador": solo los estados que hay, en el orden en que importan. */
function resumenEstados(cupones: CuponMarca[]) {
  const nombres: [string, string, string][] = [
    ["publicado", "activo", "activos"],
    ["pausado", "pausado", "pausados"],
    ["borrador", "borrador", "borradores"],
    ["agotado", "agotado", "agotados"],
    ["vencido", "vencido", "vencidos"],
  ];
  return nombres
    .map(([estado, uno, varios]) => {
      const n = cupones.filter((c) => c.status === estado).length;
      return n ? `${n} ${n === 1 ? uno : varios}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}

/**
 * El inicio de Loyalty (mockup 4a, 2026-09-29): dos acciones arriba, los
 * cupones en filas y abajo las tres pantallas que se consultan. Sin pestañas y
 * sin los números de antes: cada cifra quedó en la fila que lleva a su detalle.
 */
export default async function LoyaltyMarcaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { cupones, canjes, miembros } = await cargarLoyaltyMarca(supabase, user!.id);

  const mes = diaCR(new Date()).slice(0, 7);
  const canjesMes = canjes.filter((c) => c.status === "canjeado" && c.diaCanje?.startsWith(mes)).length;
  const escaneos = cupones.reduce((n, c) => n + (c.qr?.scans ?? 0), 0);

  return (
    <div className={styles.mcCol}>
      <PantallaHeader titulo="Loyalty" />

      <div className={styles.lmAcciones}>
        {/* Escanear va primero: es el gesto que se hace con alguien parado
            enfrente esperando. */}
        <Link href="/ugc/marca/validar" className={`${styles.lmAccion} ${styles.lmAccionOscura}`}>
          <span className={styles.lmAccionIc}>
            <QosIcon name="scan" size={22} />
          </span>
          <span>
            <span className={styles.lmAccionTit}>Escanear canje</span>
            <span className={styles.lmAccionSub}>Abre la cámara</span>
          </span>
        </Link>
        <Link href="/ugc/marca/loyalty/nuevo" className={`${styles.lmAccion} ${styles.lmAccionVioleta}`}>
          <span className={styles.lmAccionIc}>
            <QosIcon name="plus" size={22} />
          </span>
          <span>
            <span className={styles.lmAccionTit}>Nuevo cupón</span>
            <span className={styles.lmAccionSub}>Listo en un minuto</span>
          </span>
        </Link>
      </div>

      <div className={styles.lmSecHead}>
        <h2 className={styles.lmSecTit}>Tus cupones</h2>
        {cupones.length > 0 && <span className={styles.lmSecMeta}>{resumenEstados(cupones)}</span>}
      </div>

      {cupones.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          Todavía no creaste ningún cupón. Empezá por &quot;Nuevo cupón&quot;.
        </div>
      ) : (
        <div className={styles.lmLista}>
          {cupones.map((c) => {
            const usados = c.stockTotal - c.stockAvailable;
            const borrador = c.status === "borrador";
            return (
              <Link key={c.id} href={`/ugc/marca/loyalty/cupon/${c.id}`} className={styles.lmCupon}>
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className={styles.lmThumb} />
                ) : (
                  <span className={styles.lmThumb}>
                    <QosIcon name="image" size={22} />
                  </span>
                )}
                <span className={styles.lmCuponTxt}>
                  <span className={styles.lmCuponTit} style={{ display: "block" }}>
                    {c.title}
                  </span>
                  <span className={styles.lmCuponMeta} style={{ display: "block" }}>
                    {PARA_QUIEN[c.audience]} ·{" "}
                    {borrador ? "sin publicar" : `${c.stockAvailable} de ${c.stockTotal} disponibles`}
                  </span>
                  {!borrador && (
                    <span className={styles.lmBarra} style={{ display: "block" }}>
                      <span
                        className={styles.lmBarraFill}
                        style={{
                          display: "block",
                          width: `${c.stockTotal > 0 ? (usados / c.stockTotal) * 100 : 0}%`,
                        }}
                      />
                    </span>
                  )}
                </span>
                <span
                  className={`${styles.lmPill} ${
                    c.status === "publicado" ? styles.lmPillOk : borrador ? styles.lmPillBorrador : ""
                  }`}
                >
                  {ESTADO_CUPON[c.status] ?? c.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className={styles.lmLista} style={{ marginTop: 20 }}>
        {(
          [
            ["/ugc/marca/loyalty/canjes", "check", "Canjes", `${canjesMes} este mes`],
            [
              "/ugc/marca/loyalty/clientes",
              "users",
              CF.programa,
              `${miembros.length} ${miembros.length === 1 ? "cliente" : "clientes"}`,
            ],
            ["/ugc/marca/loyalty/qr", "qr", "QR del local", `${escaneos} ${escaneos === 1 ? "escaneo" : "escaneos"}`],
          ] as const
        ).map(([href, icono, titulo, valor]) => (
          <Link key={href} href={href} className={styles.lmNavFila}>
            <span className={styles.lmNavIc}>
              <QosIcon name={icono} size={18} />
            </span>
            <span className={styles.lmNavTit}>{titulo}</span>
            <span className={styles.lmNavVal}>{valor}</span>
            <QosIcon name="chevR" size={16} className={styles.lmChev} />
          </Link>
        ))}
      </div>
    </div>
  );
}
