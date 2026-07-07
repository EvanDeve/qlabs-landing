import type { ApplicationStatus } from "@/lib/database.types";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "Pendiente",
  reviewing: "En revisión",
  accepted: "Aceptada",
  rejected: "Rechazada",
  delivered: "Entregada",
  approved: "Aprobada",
};

export const APPLICATION_STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending: "bg-lavender text-ink-soft",
  reviewing: "bg-lavender-deep text-violet-deep",
  accepted: "bg-trust-bg text-trust",
  rejected: "bg-coral-bg text-coral",
  delivered: "bg-trust-bg text-trust",
  approved: "bg-trust-bg text-trust",
};
