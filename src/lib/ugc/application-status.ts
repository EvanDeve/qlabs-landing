import type { ApplicationStatus } from "@/lib/database.types";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Pendiente",
  reviewing: "En revisión",
  accepted: "Aceptada",
  rejected: "Rechazada",
  delivered: "Entregada",
  approved: "Aprobada",
  cancelled: "Cancelada",
  disputed: "En disputa",
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
  cancelled: "Muted",
  disputed: "Risk",
};

/** Estados en los que la colaboración ya terminó: no admiten más acciones. */
export const APPLICATION_CLOSED: ApplicationStatus[] = ["rejected", "approved", "cancelled"];

/**
 * Cancelar solo se puede mientras no haya entrega. Después hay trabajo hecho y
 * plata de por medio, así que la salida es disputar, no cancelar.
 */
export function canCancel(status: ApplicationStatus): boolean {
  return status === "accepted";
}

/** Disputar aplica cuando ya hay material entregado y algo salió mal. */
export function canDispute(status: ApplicationStatus): boolean {
  return status === "delivered";
}
