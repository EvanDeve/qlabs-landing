import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarReclamoPorCodigo } from "@/lib/ugc/loyalty-marca";
import { fechaLarga, LEYENDA_EVENTO } from "@/lib/ugc/loyalty";
import ConfirmarCanje from "@/components/ugc/marca/ConfirmarCanje";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * A dónde lleva el QR del creador.
 *
 * Vive dentro de `(dashboard)/marca` a propósito: así hereda `requireRole`, y
 * escanear sin sesión de marca manda al login en vez de mostrar datos de un
 * canje. El celular que escanea es el de quien atiende, con su cuenta abierta.
 */
export default async function ValidarCodigoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [reclamo, { data: marca }] = await Promise.all([
    buscarReclamoPorCodigo(supabase, decodeURIComponent(code)),
    supabase.from("brand_profiles").select("brand_name").eq("profile_id", user!.id).maybeSingle(),
  ]);

  const nombreMarca = marca?.brand_name ?? "tu negocio";

  // Días que le quedan al cupón. El mockup dice "Vence en 12 días" y no la
  // fecha: parado en la caja, lo que se necesita saber es si sirve HOY, no en
  // qué día de septiembre cae.
  // Server Component con `force-dynamic`: se renderiza una vez por escaneo y la
  // pregunta es justamente cuántos días le quedan HOY.
  // eslint-disable-next-line react-hooks/purity
  const hoy = Date.now();
  const diasRestantes = reclamo
    ? Math.ceil((new Date(reclamo.expiresAt).getTime() - hoy) / 86_400_000)
    : 0;

  return (
    <div className={styles.mcCanjeFondo}>
      <div className={styles.mcEscanerBar}>
        <span className={styles.mcEscanerTit}>Validar canje</span>
        <Link href="/ugc/marca/loyalty" className={styles.mcEscanerX} aria-label="Cerrar">
          <QosIcon name="x" size={17} />
        </Link>
      </div>
      <div style={{ flex: 1 }} />
      <div className={styles.mcCanjeHoja}>
        <div className={styles.mcCanjeAgarre} aria-hidden />

      {!reclamo ? (
        <div className={styles.mcCanje}>
          <span className={`${styles.mcCanjeSello} ${styles.mcCanjeSelloNo}`}>
            <QosIcon name="x" size={26} />
          </span>
          <div className={styles.mcCanjeTit}>Código no encontrado</div>
          <p className={styles.mcCanjeSub}>
            No está entre los cupones de {nombreMarca}.
          </p>
          <p className={styles.mcCanjeAviso} style={{ marginTop: 16 }}>
            Cada cuenta valida únicamente los cupones que publicó. Si este cupón es de otro de tus
            negocios, entrá con esa cuenta y volvé a escanear. Si es de este, revisá que el código
            esté bien digitado.
          </p>
          <Link href="/ugc/marca/loyalty" className={styles.mcCanjeBtn}>
            Buscar a mano
          </Link>
        </div>
      ) : (
        <div className={styles.mcCanje}>
          <span
            className={`${styles.mcCanjeSello} ${
              reclamo.status === "reclamado" ? "" : styles.mcCanjeSelloMal
            }`}
          >
            <QosIcon name={reclamo.status === "reclamado" ? "check" : "alert"} size={26} />
          </span>
          <div className={styles.mcCanjeTit}>
            {reclamo.status === "canjeado"
              ? "Ya fue canjeado"
              : reclamo.status === "expirado"
                ? "Cupón vencido"
                : "Canje válido"}
          </div>
          <p className={styles.mcCanjeSub}>
            Código <span className={styles.mcCanjeCodigo}>{reclamo.code}</span> · verificado por Q
            Labs
          </p>

          <div className={styles.mcCanjeTabla}>
            <div className={styles.mcCanjeFila}>
              <span className={styles.mcCanjeK}>Cupón</span>
              <span className={styles.mcCanjeV}>{reclamo.couponTitle}</span>
            </div>
            <div className={styles.mcCanjeFila}>
              <span className={styles.mcCanjeK}>Creador</span>
              <span className={styles.mcCanjeV}>
                {reclamo.creatorHandle} · {reclamo.creatorLevelName}
              </span>
            </div>
            <div className={styles.mcCanjeFila}>
              <span className={styles.mcCanjeK}>Vigencia</span>
              <span
                className={`${styles.mcCanjeV} ${
                  reclamo.status === "reclamado" && diasRestantes > 0 ? styles.mcCanjeVOk : ""
                }`}
              >
                {diasRestantes > 0
                  ? `Vence en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"}`
                  : `Venció el ${fechaLarga(reclamo.expiresAt)}`}
              </span>
            </div>
          </div>

          {reclamo.esEvento && <p className={styles.mcCanjeAviso}>🎟️ {LEYENDA_EVENTO}</p>}

          {reclamo.status === "canjeado" ? (
            <p className={styles.mcCanjeAviso}>
              Cada código se quema al confirmarse — un canje por creador por cupón.
            </p>
          ) : reclamo.status === "expirado" ? (
            <p className={styles.mcCanjeAviso}>
              Venció el {fechaLarga(reclamo.expiresAt)}. Si todavía queda stock, el creador puede
              volver a reclamarlo.
            </p>
          ) : (
            <>
              <ConfirmarCanje code={reclamo.code} />
              {/* El mockup decía "Rechazar". No existe ese estado: lo único que
                  hace es volver sin confirmar, y llamarlo rechazar prometería
                  que queda registrado en algún lado. */}
              <Link href="/ugc/marca/loyalty" className={styles.mcCanjeAhoraNo}>
                Ahora no
              </Link>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
