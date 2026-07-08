import type { ContentStage } from "@/lib/database.types";

// orden = columnas del Kanban, también usado para "avanzar a la siguiente etapa"
export const CONTENT_STAGE_ORDER: ContentStage[] = [
  "pendiente",
  "estrategia",
  "guion",
  "aprobacion_guion",
  "grabacion",
  "edicion",
  "qa",
  "revision_cliente",
  "programado",
  "publicado",
];

export const CONTENT_STAGE_LABEL: Record<ContentStage, string> = {
  pendiente: "Pendiente",
  estrategia: "Estrategia",
  guion: "Guion",
  aprobacion_guion: "Aprob. Guion",
  grabacion: "Grabación",
  edicion: "Edición",
  qa: "QA",
  revision_cliente: "Rev. Cliente",
  programado: "Programado",
  publicado: "Publicado",
};

// colores de etapa para Q·OS (referencian las custom properties --st-* del prototipo)
export const CONTENT_STAGE_COLOR: Record<ContentStage, string> = {
  pendiente: "var(--st-pend)",
  estrategia: "var(--st-estr)",
  guion: "var(--st-guion)",
  aprobacion_guion: "var(--st-aprob)",
  grabacion: "var(--st-grab)",
  edicion: "var(--st-edit)",
  qa: "var(--st-qa)",
  revision_cliente: "var(--st-rev)",
  programado: "var(--st-prog)",
  publicado: "var(--st-pub)",
};

export const CONTENT_STAGE_STYLE: Record<ContentStage, string> = {
  pendiente: "bg-lavender text-ink-soft",
  estrategia: "bg-lavender-deep text-violet-deep",
  guion: "bg-lavender-deep text-violet-deep",
  aprobacion_guion: "bg-coral-bg text-coral",
  grabacion: "bg-lavender-deep text-violet-deep",
  edicion: "bg-lavender-deep text-violet-deep",
  qa: "bg-lavender-deep text-violet-deep",
  revision_cliente: "bg-coral-bg text-coral",
  programado: "bg-trust-bg text-trust",
  publicado: "bg-trust-bg text-trust",
};

// SOP y rol dueño de cada etapa, del roadmap operativo de Q Labs
export const CONTENT_STAGE_SOP: Record<ContentStage, { sopCode: string | null; ownerRole: string | null }> = {
  pendiente: { sopCode: null, ownerRole: null },
  estrategia: { sopCode: "SOP-002", ownerRole: "Estratega" },
  guion: { sopCode: "SOP-002", ownerRole: "Guionista" },
  aprobacion_guion: { sopCode: null, ownerRole: "Cliente" },
  grabacion: { sopCode: "SOP-003", ownerRole: "Productor" },
  edicion: { sopCode: "SOP-004", ownerRole: "Editor" },
  qa: { sopCode: "SOP-005", ownerRole: "QA" },
  revision_cliente: { sopCode: "SOP-006", ownerRole: "Cliente" },
  programado: { sopCode: null, ownerRole: null },
  publicado: { sopCode: null, ownerRole: null },
};

export function nextContentStage(stage: ContentStage): ContentStage | null {
  const index = CONTENT_STAGE_ORDER.indexOf(stage);
  return index >= 0 && index < CONTENT_STAGE_ORDER.length - 1
    ? CONTENT_STAGE_ORDER[index + 1]
    : null;
}
