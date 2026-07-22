"use client";

import { useState } from "react";
import ApplyForm from "@/components/ugc/creador/ApplyForm";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { creatorPayout } from "@/lib/ugc/payout";
import type { ApplicationStatus } from "@/lib/database.types";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

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
  applicationStatus: ApplicationStatus | null;
};

export default function CreadorFeedGrid({
  campaigns,
  verified,
}: {
  campaigns: FeedCampaign[];
  verified: boolean;
}) {
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-2)" }}>
                  {campaign.brandName}
                </span>
                {campaign.brandIndustry && <span className={styles.chip}>{campaign.brandIndustry}</span>}
              </div>

              <h3 style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.01em" }}>{campaign.title}</h3>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.5 }}>{campaign.brief}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "12.5px", color: "var(--ink-3)" }}>
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                  ₡{creatorPayout(campaign.budget_amount).toLocaleString("es-CR")}
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

              <div style={{ marginTop: "auto", paddingTop: "4px" }}>
                {campaign.applicationStatus ? (
                  <span
                    className={`${styles.riskPill} ${styles["risk" + APPLICATION_STATUS_STYLE[campaign.applicationStatus]]}`}
                  >
                    Ya aplicaste — {APPLICATION_STATUS_LABEL[campaign.applicationStatus]}
                  </span>
                ) : verified ? (
                  <ApplyForm campaignId={campaign.id} />
                ) : (
                  <span className={`${styles.riskPill} ${styles.riskMuted}`}>Perfil en revisión</span>
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
