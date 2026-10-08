// `creator_profiles.niches` guarda ids de este catálogo ("gastronomia",
// "viajes"), no texto libre. Hasta 2026-10-08 era texto libre y en prod
// convivían "Food", "food" y "restaurantes" para lo mismo: buscar por nicho
// desde Q·OS no encontraba a la mitad. Como pasa con los idiomas, el id nunca
// se muestra crudo: siempre por `nichoLabel`.
//
// Agregar un nicho es agregar una línea acá. La base no tiene la lista (solo el
// tope de 5), así que no hace falta migración. Sacar uno sí: los creadores que
// lo tengan lo seguirían mostrando con el id crudo.

export const NICHOS = [
  { id: "gastronomia", label: "Gastronomía" },
  { id: "bebidas", label: "Bebidas y coctelería" },
  { id: "viajes", label: "Viajes y turismo" },
  { id: "hospedaje", label: "Hoteles y hospedaje" },
  { id: "aventura", label: "Aventura y naturaleza" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "belleza", label: "Belleza y skincare" },
  { id: "moda", label: "Moda" },
  { id: "fitness", label: "Fitness y deporte" },
  { id: "bienestar", label: "Salud y bienestar" },
  { id: "familia", label: "Mamás, papás y familia" },
  { id: "mascotas", label: "Mascotas" },
  { id: "hogar", label: "Hogar y decoración" },
  { id: "tecnologia", label: "Tecnología" },
  { id: "gaming", label: "Gaming" },
  { id: "negocios", label: "Negocios y emprendimiento" },
  { id: "finanzas", label: "Finanzas personales" },
  { id: "educacion", label: "Educación" },
  { id: "entretenimiento", label: "Humor y entretenimiento" },
  { id: "eventos", label: "Eventos y vida nocturna" },
  { id: "sostenibilidad", label: "Sostenibilidad" },
  { id: "autos", label: "Autos y motos" },
] as const;

/** Más de 5 y el filtro del admin deja de decir algo: todos son de todo. */
export const MAX_NICHOS = 5;

const LABELS: Record<string, string> = Object.fromEntries(NICHOS.map((n) => [n.id, n.label]));

export function nichoLabel(id: string) {
  return LABELS[id] ?? id;
}

export function esNicho(id: string | null | undefined): id is string {
  return Boolean(id && id in LABELS);
}

/**
 * Lo que llega del formulario ("gastronomia, viajes") a lo que se guarda: solo
 * ids del catálogo, sin repetidos y como mucho 5. El tope vale acá y en la
 * base; el de la pantalla es solo comodidad.
 */
export function parseNichos(valor: string) {
  const elegidos = valor
    .split(",")
    .map((v) => v.trim())
    .filter(esNicho);
  return [...new Set(elegidos)].slice(0, MAX_NICHOS);
}
