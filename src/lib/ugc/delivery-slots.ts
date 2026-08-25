import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import type { Json } from "@/lib/database.types";

/**
 * Las cajas de la hoja de entrega salen de lo que la marca pidió.
 *
 * `campaigns.deliverables` es `[{type, qty}]` — "1 Reel + 2 Stories" son tres
 * cajas y el "de 3" del encabezado. La identidad de cada caja se guarda en
 * `application_deliveries.slot` como "<tipo>#<n>", así que tiene que ser
 * estable: derivarla del ORDEN del array la rompería si la marca reordena los
 * entregables, por eso el índice es por tipo y no por posición.
 */
export type SlotEntrega = {
  /** Lo que va en la columna `slot`. Estable entre recargas. */
  id: string;
  type: string;
  /** "REEL", "STORY 1", "STORY 2" — el badge de la caja. */
  etiqueta: string;
};

/** Cuántos archivos de un tipo pide la campaña, sin confiar en el JSON crudo. */
function normalizar(deliverables: Json | null): { type: string; qty: number }[] {
  if (!Array.isArray(deliverables)) return [];
  return deliverables.flatMap((d) => {
    if (!d || typeof d !== "object" || Array.isArray(d)) return [];
    const type = (d as Record<string, unknown>).type;
    const qty = (d as Record<string, unknown>).qty;
    if (typeof type !== "string" || !type) return [];
    const n = typeof qty === "number" && Number.isFinite(qty) ? Math.floor(qty) : 1;
    // Un qty de 0 o negativo no es una caja; uno absurdo tampoco. El tope de 20
    // existe para que un dato malo no dibuje mil cajas.
    return n > 0 ? [{ type, qty: Math.min(n, 20) }] : [];
  });
}

/**
 * Nombre en singular para el badge. FORMAT_LABEL está en plural porque describe
 * lo que la campaña pide ("Stories"), pero cada caja es UNA pieza.
 */
const SINGULAR: Record<string, string> = {
  reel: "Reel",
  stories: "Story",
  tiktok: "TikTok",
  photos: "Foto",
};

export function slotsDeCampana(deliverables: Json | null): SlotEntrega[] {
  const tipos = normalizar(deliverables);
  return tipos.flatMap(({ type, qty }) => {
    const nombre = SINGULAR[type] ?? FORMAT_LABEL[type] ?? type;
    return Array.from({ length: qty }, (_, i) => ({
      id: `${type}#${i + 1}`,
      type,
      // Con una sola pieza el número sobra: "REEL" se lee mejor que "REEL 1".
      etiqueta: qty === 1 ? nombre.toUpperCase() : `${nombre.toUpperCase()} ${i + 1}`,
    }));
  });
}

/** Qué extensiones ofrece el selector según lo que se está entregando. */
export function aceptaDeSlot(type: string): string {
  if (type === "photos") return "image/*";
  if (type === "stories") return "image/*,video/*";
  return "video/*";
}
