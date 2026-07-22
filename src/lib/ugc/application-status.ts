import type { ApplicationStatus } from "@/lib/database.types";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Pendiente",
  reviewing: "En revisión",
  accepted: "Aceptada",
  rejected: "Rechazada",
  delivered: "Entregada",
  approved: "Aprobada",
};

// Sufijo de las clases riskOk/riskWarn/riskRisk/riskMuted en qos.module.css —
// className={`${styles.riskPill} ${styles["risk" + APPLICATION_STATUS_STYLE[status]]}`}
export const APPLICATION_STATUS_STYLE: Record<ApplicationStatus, "Ok" | "Warn" | "Risk" | "Muted"> = {
  pending: "Muted",
  reviewing: "Warn",
  accepted: "Ok",
  rejected: "Risk",
  delivered: "Ok",
  approved: "Ok",
};
