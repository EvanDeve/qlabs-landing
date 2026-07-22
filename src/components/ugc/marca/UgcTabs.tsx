"use client";

import { useState } from "react";
import Link from "next/link";
import { updateApplicationStatusAction } from "@/lib/actions/applications";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_STYLE } from "@/lib/ugc/campaign-status";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type Campaign = {
  id: string;
  title: string;
  status: "draft" | "published" | "in_progress" | "completed" | "cancelled";
  budget_amount: number;
  applicantCount: number;
  inProductionCount: number;
};

type Applicant = {
  applicationId: string;
  campaignId: string;
  campaignTitle: string;
  status: "pending" | "reviewing";
  creatorHandle: string | null;
  creatorDisplayName: string;
  verified: boolean;
  followersCount: number | null;
  engagementRate: number | null;
  niches: string[];
  pitchMessage: string | null;
};

const AV_GRADIENTS = [
  "linear-gradient(145deg,#8B7CF6,#6C5CE7)",
  "linear-gradient(145deg,#F97316,#C2410C)",
  "linear-gradient(145deg,#10B981,#047857)",
  "linear-gradient(145deg,#EC4899,#BE185D)",
  "linear-gradient(145deg,#0EA5E9,#0369A1)",
];

function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AV_GRADIENTS[hash % AV_GRADIENTS.length];
}

export default function UgcTabs({ campaigns, applicants }: { campaigns: Campaign[]; applicants: Applicant[] }) {
  const [tab, setTab] = useState<"campanas" | "aplicantes">("campanas");

  return (
    <div>
      <div className={styles.subtabs}>
        <button
          type="button"
          className={`${styles.subtab} ${tab === "campanas" ? styles.subtabOn : ""}`}
          onClick={() => setTab("campanas")}
        >
          Mis campañas
        </button>
        <button
          type="button"
          className={`${styles.subtab} ${tab === "aplicantes" ? styles.subtabOn : ""}`}
          onClick={() => setTab("aplicantes")}
        >
          Aplicantes {applicants.length > 0 && `(${applicants.length})`}
        </button>
      </div>

      {tab === "campanas" ? (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
            <Link href="/ugc/marca/campanas/nueva" className={`${styles.btn} ${styles.btnPrimary}`}>
              + Nueva campaña
            </Link>
          </div>
          {campaigns.length > 0 ? (
            <div>
              {campaigns.map((c) => (
                <div key={c.id} className={styles.campRow}>
                  <div className={styles.campBody}>
                    <b>{c.title}</b>
                    <span>₡{c.budget_amount.toLocaleString("es-CR")}</span>
                  </div>
                  <div className={styles.campN}>
                    <b>{c.applicantCount}</b>
                    <small>aplicantes</small>
                  </div>
                  <div className={styles.campN}>
                    <b>{c.inProductionCount}</b>
                    <small>en producción</small>
                  </div>
                  <span className={`${styles.riskPill} ${styles["risk" + CAMPAIGN_STATUS_STYLE[c.status]]}`}>
                    {CAMPAIGN_STATUS_LABEL[c.status]}
                  </span>
                  <Link href={`/ugc/marca/campanas/${c.id}`} className={`${styles.btn} ${styles.btnGhost}`}>
                    Ver
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${styles.card} ${styles.empty}`}>Todavía no publicaste ninguna campaña.</div>
          )}
        </div>
      ) : (
        <div>
          {applicants.length > 0 ? (
            <div>
              {applicants.map((a) => (
                <div key={a.applicationId} className={styles.applicantRow}>
                  <span className={styles.applicantAv} style={{ background: avatarGradient(a.applicationId) }}>
                    {(a.creatorHandle ?? a.creatorDisplayName).replace(/^@/, "").charAt(0).toUpperCase()}
                  </span>
                  <div className={styles.applicantBody}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <b>{a.creatorHandle ?? a.creatorDisplayName}</b>
                      {a.verified && (
                        <span
                          className={`${styles.riskPill} ${styles.riskOk}`}
                          style={{ fontSize: "10.5px", flexShrink: 0 }}
                        >
                          Verificado
                        </span>
                      )}
                    </div>
                    <span>
                      {a.followersCount ? `${a.followersCount.toLocaleString("es-CR")} seguidores` : a.campaignTitle}
                      {a.engagementRate ? ` · ${a.engagementRate}% engagement` : ""}
                    </span>
                  </div>
                  <span className={styles.miniStat}>{a.niches.slice(0, 2).join(" · ") || a.campaignTitle}</span>
                  <div className={styles.applicantActs}>
                    {a.creatorHandle && (
                      <Link
                        href={`/ugc/creadores/${a.creatorHandle.replace(/^@/, "")}`}
                        className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                      >
                        Ver book
                      </Link>
                    )}
                    <form action={updateApplicationStatusAction}>
                      <input type="hidden" name="application_id" value={a.applicationId} />
                      <input type="hidden" name="campaign_id" value={a.campaignId} />
                      <input type="hidden" name="status" value="rejected" />
                      <button type="submit" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
                        Rechazar
                      </button>
                    </form>
                    <form action={updateApplicationStatusAction}>
                      <input type="hidden" name="application_id" value={a.applicationId} />
                      <input type="hidden" name="campaign_id" value={a.campaignId} />
                      <input type="hidden" name="status" value="accepted" />
                      <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
                        Aceptar
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${styles.card} ${styles.empty}`}>No hay aplicantes esperando revisión.</div>
          )}
        </div>
      )}
    </div>
  );
}
