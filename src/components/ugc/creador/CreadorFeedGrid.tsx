"use client";

import { useState } from "react";
import Link from "next/link";
import BrandAvatar, { brandGradient } from "@/components/ugc/BrandAvatar";
import PromoSheet from "@/components/ugc/creador/PromoSheet";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { APPLICATION_STATUS_LABEL } from "@/lib/ugc/application-status";
import { creatorPayout } from "@/lib/ugc/payout";
import { usageRightsChips } from "@/lib/ugc/usage-rights";
import type { PromoDetalleData } from "@/components/ugc/creador/PromoDetalle";
import styles from "@/styles/qos.module.css";

/** La tarjeta trae el detalle entero: la hoja abre sin ir a buscar nada. */
type FeedCampaign = PromoDetalleData & { coverUrl: string | null };

// Sin prop `verified`: al feed solo llega un creador verificado, así que
// aplicar siempre está disponible. La variante "Perfil en revisión" se fue con
// el bloqueo duro.
export default function CreadorFeedGrid({ campaigns }: { campaigns: FeedCampaign[] }) {
  const industries = [...new Set(campaigns.map((c) => c.brandIndustry).filter((v): v is string => !!v))];
  const [activeIndustry, setActiveIndustry] = useState<string>("all");
  // Se guarda el id y no la promo entera: cuando aplicar revalida el feed, la
  // hoja abierta tiene que pasar sola a "Ya aplicaste". Con una copia del
  // objeto se quedaba mostrando el botón de aplicar sobre algo ya aplicado.
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const abierta = campaigns.find((c) => c.id === abiertaId) ?? null;

  const visible =
    activeIndustry === "all" ? campaigns : campaigns.filter((c) => c.brandIndustry === activeIndustry);

  return (
    <div>
      {industries.length > 1 && (
        <div className={styles.filterRow}>
          <button
            type="button"
            className={`${styles.filterChip} ${activeIndustry === "all" ? styles.filterChipOn : ""}`}
            onClick={() => setActiveIndustry("all")}
          >
            Todas
          </button>
          {industries.map((industry) => (
            <button
              key={industry}
              type="button"
              className={`${styles.filterChip} ${activeIndustry === industry ? styles.filterChipOn : ""}`}
              onClick={() => setActiveIndustry(industry)}
            >
              {industry}
            </button>
          ))}
        </div>
      )}

      {visible.length > 0 ? (
        <div className={styles.feedGrid}>
          {visible.map((campaign) => {
            const brandName = campaign.brandName ?? "Marca";
            const derechos = usageRightsChips(campaign);
            return (
              // La tarjeta entera es el link: en un celular, un "Ver detalle" de
              // 12 px al pie era el único blanco tocable de una tarjeta de 300.
              <Link
                key={campaign.id}
                href={`/ugc/creador/promos/${campaign.id}`}
                className={styles.promoCard}
                onClick={(e) => {
                  // Sigue siendo un link de verdad: cmd/ctrl+clic y "abrir en
                  // pestaña nueva" tienen que llevar a la página con URL propia.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  setAbiertaId(campaign.id);
                }}
              >
                <div className={styles.promoCover}>
                  {campaign.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={campaign.coverUrl} alt="" className={styles.promoCoverImg} />
                  ) : (
                    <div
                      className={styles.promoCoverFallback}
                      style={{ background: brandGradient(brandName) }}
                      aria-hidden
                    >
                      {/* Sobre el degradado, las iniciales solas se perderían:
                          si no hay logo va una caja translúcida que las levanta. */}
                      <BrandAvatar
                        name={brandName}
                        logoUrl={campaign.brandLogoUrl}
                        size={58}
                        radius={16}
                        color={campaign.brandLogoUrl ? null : "rgba(255,255,255,0.24)"}
                      />
                    </div>
                  )}
                  {campaign.applicationStatus && (
                    <span className={styles.promoCoverPill}>
                      Ya aplicaste · {APPLICATION_STATUS_LABEL[campaign.applicationStatus]}
                    </span>
                  )}
                </div>

                <div className={styles.promoBody}>
                  <div className={styles.promoHead}>
                    <BrandAvatar name={brandName} logoUrl={campaign.brandLogoUrl} size={40} radius={12} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className={styles.promoBrand}>
                        {campaign.brandName}
                        {campaign.brandVerified && (
                          <i
                            className="fa-solid fa-circle-check"
                            title="Marca verificada"
                            style={{ marginLeft: "5px", color: "var(--ok)", fontSize: "12px" }}
                          />
                        )}
                      </div>
                      <div className={styles.promoBrandMeta}>
                        {[campaign.brandIndustry, campaign.brandLocation].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>

                  <h3 className={styles.promoTitle}>{campaign.title}</h3>

                  {/* "neto para vos" pegado al monto: el número pelado es el que
                      hacía dudar si había un cobro escondido. El desglose entero
                      —bruto, comisión, neto— está en el detalle. */}
                  <div className={styles.promoPriceRow}>
                    <span className={styles.promoPrice}>
                      ₡{creatorPayout(campaign.budget_amount).toLocaleString("es-CR")}
                    </span>
                    <span className={styles.promoPriceNote}>neto para vos</span>
                    {campaign.deadline_days && (
                      <span className={styles.promoDays}>{campaign.deadline_days} días</span>
                    )}
                  </div>

                  {campaign.deliverables.length > 0 && (
                    <div className={styles.promoChips}>
                      {campaign.deliverables.map((d) => (
                        <span key={d.type} className={styles.promoChip}>
                          {d.qty}x {FORMAT_LABEL[d.type] ?? d.type}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Los derechos son el bloque de confianza del producto: se
                      ven antes de entrar, no solo adentro del detalle. Las
                      campañas viejas no tienen pactado nada y no muestran fila:
                      "no hay" no es lo mismo que "cualquier medio". */}
                  {derechos.length > 0 && (
                    <p className={styles.promoRights}>
                      <b>Derechos:</b>
                      {derechos.join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={`${styles.card} ${styles.empty}`}>No hay campañas en esta categoría por ahora.</div>
      )}

      {abierta && <PromoSheet promo={abierta} onClose={() => setAbiertaId(null)} />}
    </div>
  );
}
