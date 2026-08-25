import type {
  ContentApproval,
  ContentPriority,
  ContentPlatform,
  StaffRole,
} from "@/lib/database.types";
import { diaCR, sumarDias } from "@/lib/ugc/calendar";

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

// Q·OS conserva "Reels" en plural: acá la etiqueta describe el canal donde
// publica el equipo, no una pieza suelta. Los tres últimos existen para el
// tablero del creador —Q·OS no los ofrece— pero necesitan etiqueta igual, por
// si un día aparece uno en el calendario.
export const CONTENT_PLATFORM_LABEL: Record<ContentPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  reels: "Reels",
  stories: "Stories",
  photos: "Fotos",
  facebook: "Facebook",
};

/** El punto de color de cada prioridad, para las listas de filtro. */
export const CONTENT_PRIORITY_DOT: Record<ContentPriority, string> = {
  alta: "#df4650",
  media: "#c07414",
  baja: "#9793ad",
};

/**
 * Veinticuatro colores, y el número no es de adorno: el reparto es sobre TODOS
 * los Heroes —archivados incluidos, ver `coloresDeHeroes`—, que al 2026-08-14
 * son 16. Con menos colores que Heroes, dos marcas comparten el suyo y el punto
 * deja de servir para reconocerlas. Esto da aire hasta 24; pasado eso empiezan a
 * repetirse de a uno, sin romperse.
 */
const COLORES_HERO = [
  "#6d54f3",
  "#c0392b",
  "#2aa5c0",
  "#3f8f4f",
  "#b3487f",
  "#8a5a2b",
  "#1f9ac9",
  "#e07b39",
  "#4a7ab8",
  "#7c4de0",
  "#d4a017",
  "#2f9e8f",
  "#a8442a",
  "#5c6bc0",
  "#9c27b0",
  "#00897b",
  "#f4511e",
  "#546e7a",
  "#d81b60",
  "#43a047",
  "#5e35b1",
  "#00acc1",
  "#8d6e63",
  "#ef6c00",
];

/**
 * Un color por Hero, repartiendo la paleta entre TODOS.
 *
 * Los Heroes no tienen columna de color: la identidad visual la da el logo. Pero
 * en una lista sin logos —el filtro del tablero— hace falta algo que distinga a
 * Zonna de Snowty de un vistazo.
 *
 * Reparte por posición y no por un hash del id, que fue el primer intento y
 * falló medido: los UUID de Postgres comparten demasiada estructura y los 11
 * Heroes activos caían en 6 colores, con tres marcas compartiendo el mismo
 * marrón. Por posición no hay dos iguales mientras haya menos Heroes que
 * colores.
 *
 * Se ordena por id —no por nombre— para que el color de cada uno NO cambie al
 * renombrar una marca ni al archivar otra. Hay que pasarle la lista COMPLETA
 * (archivados incluidos) por la misma razón: una lista que se achica corre los
 * colores de todos los que vienen después.
 */
export function coloresDeHeroes(ids: string[]): Map<string, string> {
  const ordenados = [...ids].sort();
  return new Map(ordenados.map((id, i) => [id, COLORES_HERO[i % COLORES_HERO.length]]));
}

/**
 * Filtro por fecha de publicación del pipeline.
 *
 * Es un solo select con presets y no dos date-pickers a propósito: lo que el
 * equipo pregunta a diario es "¿qué sale esta semana?" y "¿qué se me pasó?",
 * no un rango arbitrario. Un rango libre son cuatro clics para responder lo
 * mismo.
 *
 * "Sin fecha" es un preset y no un olvido: una pieza sin publicación planeada
 * es un problema —no entra en ningún cronograma ni en el Pase de servicio— y
 * hasta ahora no había forma de listarlas.
 */
export type FiltroFecha = "atrasadas" | "dias7" | "dias15" | "mes" | "sin_fecha";

export const FILTROS_FECHA: { id: FiltroFecha; label: string }[] = [
  { id: "atrasadas", label: "Atrasadas" },
  { id: "dias7", label: "Publica en 7 días" },
  { id: "dias15", label: "Publica en 15 días" },
  { id: "mes", label: "Publica este mes" },
  { id: "sin_fecha", label: "Sin fecha de publicación" },
];

export function parseFiltroFecha(valor: string | undefined): FiltroFecha | null {
  return FILTROS_FECHA.some((f) => f.id === valor) ? (valor as FiltroFecha) : null;
}

/**
 * Un día exacto ('yyyy-MM-dd') del `?dia=` de la URL.
 *
 * Convive con los presets pero NO se combina: elegir un día borra el preset y
 * viceversa. Combinarlos daría cosas como "atrasadas Y el 10 de agosto", que
 * casi siempre es el conjunto vacío y se lee como que el tablero se rompió.
 *
 * Se valida la forma antes de mandarla a Postgres: un `?dia=hoy` escrito a mano
 * haría fallar la consulta entera y el tablero saldría vacío sin decir por qué.
 */
export function parseDia(valor: string | undefined): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

/**
 * Las claves de la URL que definen CÓMO quedó el tablero: qué pestaña, qué
 * filtros y qué se buscó.
 *
 * Existen como lista porque entrar a una pieza es salir del tablero: la pieza
 * tiene URL propia, así que el query con los filtros se queda atrás y volver
 * dejaba el Pipeline en blanco. El equipo tenía que volver a filtrar después de
 * abrir CADA tarjeta.
 *
 * `q` es el buscador. No vive en la URL mientras se escribe —filtra en el
 * navegador, ver KanbanBoard— pero sí viaja acá: para quien vuelve, que se le
 * borre el texto buscado es exactamente el mismo problema que perder un filtro.
 */
const CLAVES_VISTA_PIPELINE = [
  "seccion",
  "brand",
  "owner",
  "priority",
  "fecha",
  "dia",
  "archivados",
  "q",
] as const;

/**
 * El query del tablero recortado a esas claves, para llevárselo al entrar a una
 * pieza. La lista blanca es lo que evita que un `?volver=` escrito a mano meta
 * cualquier cosa en la URL a la que se regresa.
 */
export function vistaDelPipeline(query: string): string {
  const params = new URLSearchParams(query);
  const vista = new URLSearchParams();
  for (const clave of CLAVES_VISTA_PIPELINE) {
    const valor = params.get(clave);
    if (valor) vista.set(clave, valor);
  }
  return vista.toString();
}

/** El tablero tal como lo dejó quien entró a la pieza. */
export function hrefDelPipeline(volver: string | undefined): string {
  const vista = vistaDelPipeline(volver ?? "");
  return vista ? `/admin/pipeline?${vista}` : "/admin/pipeline";
}

/**
 * El filtro traducido a condiciones sobre `publish_date`, en días de Costa Rica.
 *
 * Devuelve días sueltos ('yyyy-MM-dd') porque la columna es `date`: mandarle un
 * ISO con hora la haría comparar contra medianoche UTC y correría el corte seis
 * horas. Ver la migración 20260801000000.
 */
export function rangoFiltroFecha(
  filtro: FiltroFecha,
  ahora: Date = new Date()
): { gte?: string; lte?: string; lt?: string; esNulo?: boolean } {
  const hoy = diaCR(ahora);

  switch (filtro) {
    case "atrasadas":
      return { lt: hoy };
    case "dias7":
      return { gte: hoy, lte: diaCR(sumarDias(ahora, 7)) };
    case "dias15":
      return { gte: hoy, lte: diaCR(sumarDias(ahora, 15)) };
    case "mes": {
      // El último día se calcula con Date.UTC(año, mes, 0) —el "día 0" del mes
      // siguiente— para no tener que saber cuál tiene 30, 31 o 28.
      const anio = Number(hoy.slice(0, 4));
      const mes = Number(hoy.slice(5, 7));
      const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
      return { gte: `${hoy.slice(0, 7)}-01`, lte: `${hoy.slice(0, 7)}-${String(ultimo).padStart(2, "0")}` };
    }
    case "sin_fecha":
      return { esNulo: true };
  }
}

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
