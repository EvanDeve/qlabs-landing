"use client";

import { useState } from "react";
import Link from "next/link";
import ApplyForm from "@/components/ugc/creador/ApplyForm";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { creatorPayout } from "@/lib/ugc/payout";
import type { ApplicationStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

type FeedCampaign = {
  id: string;
  title: string;
  brief: string;
  budget_amount: number;
  compensation_details: string | null;
  deadline_days: number | null;
  target_audience: string | null;
  deliverables: { type: string; qty: number }[];
  brandName: string | null;
  brandIndustry: string | null;
  brandLogoUrl: string | null;
  brandLocation: string | null;
  brandSlug: string | null;
  brandVerified: boolean;
  applicationStatus: ApplicationStatus | null;
};

// Sin prop `verified`: al feed solo llega un creador verificado, así que
// aplicar siempre está disponible. La variante "Perfil en revisión" se fue con
// el bloqueo duro.
export default function CreadorFeedGrid({ campaigns }: { campaigns: FeedCampaign[] }) {
  const industries = [...new Set(campaigns.map((c) => c.brandIndustry).filter((v): v is string => !!v))];
  const [activeIndustry, setActiveIndustry] = useState<string>("all");

  const visible =
    activeIndustry === "all" ? campaigns : campaigns.filter((c) => c.brandIndustry === activeIndustry);

  return (
    <div>
      {industries.length > 1 && (
        <div className={styles.subtabs}>
          <button
            type="button"
            className={`${styles.subtab} ${activeIndustry === "all" ? styles.subtabOn : ""}`}
            onClick={() => setActiveIndustry("all")}
          >
            Todas
          </button>
          {industries.map((industry) => (
            <button
              key={industry}
              type="button"
              className={`${styles.subtab} ${activeIndustry === industry ? styles.subtabOn : ""}`}
              onClick={() => setActiveIndustry(industry)}
            >
              {industry}
            </button>
          ))}
        </div>
      )}

      {visible.length > 0 ? (
        <div className={styles.cardsGrid}>
          {visible.map((campaign) => (
            <div key={campaign.id} className={`${styles.card} ${styles.cardPad} ${styles.sysCard}`}>
              <div className={styles.promoHead}>
                <BrandAvatar
                  name={campaign.brandName ?? "Marca"}
                  logoUrl={campaign.brandLogoUrl}
                  size={36}
                  radius={10}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className={styles.promoBrand}>
                    {campaign.brandName}
                    {campaign.brandVerified && (
                      <i
                        className="fa-solid fa-circle-check"
                        title="Marca verificada"
                        style={{ marginLeft: "5px", color: "var(--ok)", fontSize: "11px" }}
                      />
                    )}
                  </div>
                  <div className={styles.promoBrandMeta}>
                    {[campaign.brandIndustry, campaign.brandLocation].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>

              <Link href={`/ugc/creador/promos/${campaign.id}`} className={styles.promoTitle}>
                {campaign.title}
              </Link>
              {/* Acotado a 3 líneas: el brief completo vive en el detalle, así
                  todas las tarjetas de la grilla miden lo mismo. */}
              <p className={styles.promoBrief}>{campaign.brief}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "12.5px", color: "var(--ink-3)" }}>
                {/* "neto" al lado del monto: en la tarjeta no cabe el desglose
                    entero, pero el número pelado es el que hacía dudar. El
                    detalle de la promo sí muestra las tres cifras. */}
                <span style={{ fontWeight: 700, color: "var(--ink)" }} title="Ya con la comisión de Q Labs descontada">
                  ₡{creatorPayout(campaign.budget_amount).toLocaleString("es-CR")}{" "}
                  <span style={{ fontWeight: 600, color: "var(--ink-3)" }}>neto</span>
                </span>
                {campaign.deadline_days && <span>· {campaign.deadline_days} días</span>}
                {campaign.target_audience && <span>· {campaign.target_audience}</span>}
              </div>

              {campaign.compensation_details && (
                <p style={{ fontSize: "12.5px", color: "var(--b-600)" }}>+ {campaign.compensation_details}</p>
              )}

              {campaign.deliverables.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {campaign.deliverables.map((d) => (
                    <span key={d.type} className={styles.tag}>
                      {d.qty}x {FORMAT_LABEL[d.type] ?? d.type}
                    </span>
                  ))}
                </div>
              )}

              <div className={styles.promoFoot}>
                <Link href={`/ugc/creador/promos/${campaign.id}`} className={styles.promoMore}>
                  Ver detalle →
                </Link>
                {campaign.applicationStatus ? (
                  <span
                    className={`${styles.riskPill} ${styles["risk" + APPLICATION_STATUS_STYLE[campaign.applicationStatus]]}`}
                  >
                    Ya aplicaste — {APPLICATION_STATUS_LABEL[campaign.applicationStatus]}
                  </span>
                ) : (
                  <ApplyForm campaignId={campaign.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${styles.card} ${styles.empty}`}>No hay campañas en esta categoría por ahora.</div>
      )}
    </div>
  );
}
