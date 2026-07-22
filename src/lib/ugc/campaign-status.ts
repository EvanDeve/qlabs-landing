import type { CampaignStatus } from "@/lib/database.types";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

// Sufijo de las clases riskOk/riskWarn/riskRisk/riskMuted en qos.module.css —
// className={`${styles.riskPill} ${styles["risk" + CAMPAIGN_STATUS_STYLE[status]]}`}
export const CAMPAIGN_STATUS_STYLE: Record<CampaignStatus, "Ok" | "Warn" | "Risk" | "Muted"> = {
  draft: "Muted",
  published: "Ok",
  in_progress: "Warn",
  completed: "Ok",
  cancelled: "Risk",
};
