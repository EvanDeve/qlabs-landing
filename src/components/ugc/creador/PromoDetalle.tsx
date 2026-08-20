import Link from "next/link";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import ApplyForm from "@/components/ugc/creador/ApplyForm";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { desglosePago } from "@/lib/ugc/payout";
import { usageRightsChips, usageRightsFrase } from "@/lib/ugc/usage-rights";
import type { UsageScope, UsageDuration } from "@/lib/ugc/usage-rights";
import type { ApplicationStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

export type PromoDetalleData = {
  id: string;
  title: string;
  brief: string;
  budget_amount: number;
  compensation_details: string | null;
  deadline_days: number | null;
  target_audience: string | null;
  deliverables: { type: string; qty: number }[];
  usage_rights_scope: UsageScope | null;
  usage_rights_duration: UsageDuration | null;
  usage_rights_editing: boolean | null;
  usage_rights_notes: string | null;
  brandName: string | null;
  brandIndustry: string | null;
  brandLocation: string | null;
  brandLogoUrl: string | null;
  brandSlug: string | null;
  brandVerified: boolean;
  applicationStatus: ApplicationStatus | null;
};

/**
 * El detalle de una promo: lo mismo que ve el creador en la hoja que sube desde
 * el feed y en la página con URL propia (`/ugc/creador/promos/[id]`, que es a
 * donde llevan las notificaciones y los links compartidos).
 *
 * Es un solo componente para las dos superficies a propósito: son la misma
 * decisión —aplicar o no— y con dos implementaciones alcanzaba con tocar una
 * para que la otra empezara a decir algo distinto sobre los mismos derechos.
 *
 * No lleva "use client": no usa hooks. Lo puede montar tanto la página (server)
 * como la hoja (cliente); lo único interactivo es `ApplyForm`, que ya trae el
 * suyo.
 */
export default function PromoDetalle({ promo }: { promo: PromoDetalleData }) {
  const brandName = promo.brandName ?? "Marca";
  const { bruto, comision, neto, porcentaje } = desglosePago(promo.budget_amount);
  const derechos = usageRightsChips(promo);
  const frase = usageRightsFrase(promo);

  const encabezado = (
    <>
      <BrandAvatar name={brandName} logoUrl={promo.brandLogoUrl} size={44} radius={13} />
      <div style={{ minWidth: 0 }}>
        <div className={styles.promoBrand}>
          {brandName}
          {promo.brandVerified && (
            <i
              className="fa-solid fa-circle-check"
              title="Marca verificada"
              style={{ marginLeft: "5px", color: "var(--ok)", fontSize: "12px" }}
            />
          )}
        </div>
        <div className={styles.promoBrandMeta}>
          {[promo.brandIndustry, promo.brandLocation].filter(Boolean).join(" · ")}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* El encabezado es el link al perfil de la marca cuando lo tiene: en la
          hoja no entra una tarjeta aparte con la descripción y los links, y
          tocar la cara de quien publica para ver quién es ya es un gesto
          conocido. */}
      {promo.brandSlug ? (
        <Link href={`/ugc/marcas/${promo.brandSlug}`} className={styles.hojaMarca} title={`Ver el perfil de ${brandName}`}>
          {encabezado}
        </Link>
      ) : (
        <div className={styles.hojaMarca}>{encabezado}</div>
      )}

      <h2 className={styles.hojaTitulo}>{promo.title}</h2>

      {/* Las mismas tres cifras que ve la marca. Acá se escribe a mano en vez de
          reusar <DesglosePago> porque la hoja le da otra forma —caja lavanda,
          sin bordes— pero los números salen de la misma función. */}
      <div className={styles.hojaPago}>
        <div className={styles.hojaPagoFila}>
          <span>Presupuesto de la campaña</span>
          <span>₡{bruto.toLocaleString("es-CR")}</span>
        </div>
        <div className={styles.hojaPagoFila}>
          <span>Comisión de Q Labs ({porcentaje}%)</span>
          <span>− ₡{comision.toLocaleString("es-CR")}</span>
        </div>
        <div className={`${styles.hojaPagoFila} ${styles.hojaPagoTotal}`}>
          <span>Recibís vos</span>
          <span>₡{neto.toLocaleString("es-CR")}</span>
        </div>
      </div>

      <div className={styles.promoChips}>
        {promo.deliverables.map((d) => (
          <span key={d.type} className={styles.promoChip}>
            {d.qty}x {FORMAT_LABEL[d.type] ?? d.type}
          </span>
        ))}
        {/* Gris y no violeta: los entregables son lo que entregás, el plazo es
            una condición. Que se lean distinto es el punto. */}
        {promo.deadline_days && (
          <span className={styles.promoChipPlazo}>{promo.deadline_days} días de plazo</span>
        )}
      </div>

      {/* El brief no está en el mockup, pero sin él no hay con qué decidir:
          es lo único que dice qué hay que grabar. */}
      <p className={styles.hojaBrief}>{promo.brief}</p>

      {promo.target_audience && (
        <p className={styles.hojaDato}>
          <b>A quién busca:</b> {promo.target_audience}
        </p>
      )}

      {promo.compensation_details && (
        <div className={styles.hojaBeneficio}>
          <span className={styles.hojaBeneficioIc} aria-hidden>
            +
          </span>
          <span>{promo.compensation_details}</span>
        </div>
      )}

      <div className={styles.hojaDivisor} />

      <h3 className={styles.hojaSubtitulo}>Derechos de uso</h3>
      {frase ? (
        <>
          <div className={styles.hojaDerechos}>
            {derechos.map((chip) => (
              <span key={chip} className={styles.hojaDerecho}>
                {chip}
              </span>
            ))}
          </div>
          <p className={styles.hojaDerechosTexto}>
            {brandName} puede usar la pieza en <b>{frase.alcance}</b> {frase.duracion} desde que
            aprueba la entrega, y {frase.edicion}. Vos siempre podés publicarla en tu propio perfil.
          </p>
          {promo.usage_rights_notes && (
            <p className={styles.hojaDerechosTexto}>{promo.usage_rights_notes}</p>
          )}
        </>
      ) : (
        <p className={styles.hojaDerechosTexto}>
          Esta promo se publicó sin especificar derechos de uso. Antes de entregar, acordá con{" "}
          {brandName} dónde y por cuánto tiempo va a usar el contenido.
        </p>
      )}

      <div className={styles.hojaAplicar}>
        {promo.applicationStatus ? (
          <span
            className={`${styles.riskPill} ${styles["risk" + APPLICATION_STATUS_STYLE[promo.applicationStatus]]} ${styles.hojaEstado}`}
          >
            Ya aplicaste — {APPLICATION_STATUS_LABEL[promo.applicationStatus]}
          </span>
        ) : (
          <ApplyForm campaignId={promo.id} />
        )}
        <p className={styles.hojaPie}>
          El pago lo coordina Q Labs por fuera de la app.{" "}
          <Link href="/legal/terminos#pagos" className={styles.linkMore} target="_blank">
            Términos
          </Link>
        </p>
      </div>
    </>
  );
}
