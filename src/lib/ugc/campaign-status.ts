import type { CampaignStatus } from "@/lib/database.types";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const CAMPAIGN_STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "bg-lavender text-ink-soft",
  published: "bg-trust-bg text-trust",
  in_progress: "bg-lavender-deep text-violet-deep",
  completed: "bg-trust-bg text-trust",
  cancelled: "bg-coral-bg text-coral",
};
