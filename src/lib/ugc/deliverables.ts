export const DELIVERABLE_TYPES = ["reel", "stories", "tiktok", "photos"] as const;

export const FORMAT_LABEL: Record<string, string> = {
  reel: "Reel",
  stories: "Stories",
  tiktok: "TikTok",
  photos: "Fotos",
};

export type Entregable = { type: string; qty: number };

/**
 * Los entregables como se leen en una línea: "1× Reel · 3× TikTok".
 *
 * Sale del jsonb `campaigns.deliverables`, que es la única fuente — no hay
 * columnas por formato. Se ignoran los de cantidad cero: el formulario deja
 * bajar el contador hasta ahí y una campaña con "0× Fotos" no dice nada.
 */
export function entregablesEnLinea(deliverables: unknown): string {
  if (!Array.isArray(deliverables)) return "";
  return (deliverables as Entregable[])
    .filter((d) => d && Number(d.qty) > 0)
    .map((d) => `${d.qty}× ${FORMAT_LABEL[d.type] ?? d.type}`)
    .join(" · ");
}
