import type {
  ContentApproval,
  ContentPriority,
  ContentPlatform,
  HeroRisk,
  StaffRole,
} from "@/lib/database.types";

export const CONTENT_APPROVAL_LABEL: Record<ContentApproval, string> = {
  pendiente: "Pendiente",
  correccion: "Corrección",
  revisado: "Revisado",
};

export const CONTENT_APPROVAL_STYLE: Record<ContentApproval, string> = {
  pendiente: "bg-lavender text-ink-soft",
  correccion: "bg-coral-bg text-coral",
  revisado: "bg-trust-bg text-trust",
};

export const CONTENT_PRIORITY_LABEL: Record<ContentPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

export const CONTENT_PRIORITY_STYLE: Record<ContentPriority, string> = {
  baja: "bg-lavender text-ink-soft",
  media: "bg-lavender-deep text-violet-deep",
  alta: "bg-coral-bg text-coral",
};

export const CONTENT_PLATFORM_LABEL: Record<ContentPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  reels: "Reels",
};

export const HERO_RISK_LABEL: Record<HeroRisk, string> = {
  onboarding: "Onboarding",
  ok: "Al día",
  warn: "Atención",
  risk: "En riesgo",
};

export const HERO_RISK_STYLE: Record<HeroRisk, string> = {
  onboarding: "bg-lavender text-ink-soft",
  ok: "bg-trust-bg text-trust",
  warn: "bg-coral-bg text-coral",
  risk: "bg-coral-bg text-coral",
};

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  director: "Director",
  pm: "Project Manager",
  estratega: "Estratega",
  guionista: "Guionista",
  productor: "Productor",
  editor: "Editor",
  qa: "QA",
  community: "Community Manager",
  ventas: "Ventas",
};
