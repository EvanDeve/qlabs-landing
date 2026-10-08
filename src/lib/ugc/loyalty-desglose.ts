import { labelAccion, fechaCorta } from "@/lib/ugc/loyalty";

export type EventoPuntos = {
  action: string;
  points: number;
  created_at: string;
  reference_type: string | null;
  reference_id: string | null;
};

export type GrupoPuntos = {
  action: string;
  label: string;
  /** "Brunch de fin de semana · 26 ago", "3 aplicaciones", "12 jun". */
  detalle: string;
  puntos: number;
  /** Eventos cargados a mano para probar, no por algo que pasó en la app. */
  prueba: boolean;
};

/** Cómo se cuenta cada motivo cuando hay más de uno. */
const UNIDAD: Record<string, [string, string]> = {
  application: ["aplicación", "aplicaciones"],
  campaign_selected: ["campaña", "campañas"],
  delivery_approved: ["entrega", "entregas"],
  book_upload: ["pieza", "piezas"],
  rating_5: ["calificación", "calificaciones"],
  rating_4: ["calificación", "calificaciones"],
};

/**
 * "De dónde salen sus puntos" (mockup 1d): el ledger agrupado por motivo, de
 * más puntos a menos. Si un motivo pasó una sola vez y viene de una
 * aplicación, el detalle es la campaña y la fecha; si no, cuántas veces.
 *
 * Los eventos con `reference_type = 'prueba'` van aparte y marcados: son
 * puntos cargados a mano en una prueba, y mezclados con los reales parecían
 * entregas que nunca existieron (le pasó a @evanmarin, 2026-10-07).
 */
export function desglosePuntos(
  eventos: EventoPuntos[],
  campanaDeAplicacion: Map<string, string>,
): GrupoPuntos[] {
  const grupos = new Map<string, EventoPuntos[]>();
  for (const e of eventos) {
    const prueba = e.reference_type === "prueba";
    const clave = `${e.action}${prueba ? ":prueba" : ""}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), e]);
  }

  return [...grupos.entries()]
    .map(([clave, lista]) => {
      const action = lista[0].action;
      const prueba = clave.endsWith(":prueba");
      const masNuevo = [...lista].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      let detalle: string;
      if (lista.length === 1) {
        const campana =
          masNuevo.reference_type === "application" && masNuevo.reference_id
            ? campanaDeAplicacion.get(masNuevo.reference_id)
            : undefined;
        detalle = campana
          ? `${campana} · ${fechaCorta(masNuevo.created_at)}`
          : fechaCorta(masNuevo.created_at);
      } else {
        const [uno, varios] = UNIDAD[action] ?? ["vez", "veces"];
        detalle = `${lista.length} ${lista.length === 1 ? uno : varios} · la última el ${fechaCorta(masNuevo.created_at)}`;
      }
      return {
        action,
        label: labelAccion(action) + (prueba ? " (prueba)" : ""),
        detalle,
        puntos: lista.reduce((n, e) => n + e.points, 0),
        prueba,
      };
    })
    .sort((a, b) => Number(a.prueba) - Number(b.prueba) || b.puntos - a.puntos);
}
