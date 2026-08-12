import type { Database, PipelineSection } from "@/lib/database.types";

export type ContentColumn = Database["public"]["Tables"]["content_columns"]["Row"];

/**
 * Las pestañas del tablero. El orden de este array ES el orden en que se
 * pintan, y "video" va primero porque es donde el equipo pasa el mes: los
 * guiones se escriben en una tanda de dos o tres días y después esas columnas
 * quedan quietas.
 *
 * "IT" va última: es el carril de trabajo técnico de la plataforma, no de
 * contenido de un Hero, así que es el que menos gente abre.
 *
 * ⚠️ La sección solo reparte columnas entre pestañas. Los conteos por Hero
 * —publicados del mes, atrasadas, carga, y la agenda de McLovin— NO la miran,
 * así que una pieza de IT suma como cualquier otra. Lo que la deja afuera es
 * lo mismo que con los guiones: su columna final marcada `is_done` y no
 * cargarle nunca `publish_date`.
 *
 * Agregar una sección: sumar el valor al check (migración 20260803100000, y
 * 20260807100000 para 'it') y una entrada acá. No hay ningún otro lugar que
 * enumere las secciones.
 */
export const SECCIONES_PIPELINE: { id: PipelineSection; label: string }[] = [
  { id: "video", label: "Videos" },
  // El id sigue siendo 'guion' aunque la pestaña diga Cronogramas: está en el
  // check de content_columns y en las URLs que el equipo tiene guardadas.
  // Ver la migración 20260812200000.
  { id: "guion", label: "Cronogramas" },
  { id: "it", label: "IT" },
];

/** La sección que abre el tablero cuando la URL no dice otra cosa. */
export const SECCION_POR_DEFECTO: PipelineSection = "video";

/**
 * Valida el `?seccion=` de la URL. Devuelve null para "Todo" —que es una vista
 * real, no la ausencia de filtro— y el default cuando el valor no existe, para
 * que una URL vieja o mal tipeada no muestre un tablero vacío sin explicación.
 */
export function parseSeccion(valor: string | undefined): PipelineSection | null {
  if (valor === "todo") return null;
  if (SECCIONES_PIPELINE.some((s) => s.id === valor)) return valor as PipelineSection;
  return SECCION_POR_DEFECTO;
}

/**
 * La sección que viene del formulario de columna. A diferencia de parseSeccion,
 * acá "todo" NO es válido: es una vista del tablero, no un lugar donde una
 * columna pueda vivir. Cae al default en vez de fallar porque el check de la
 * base rechazaría el insert con un error de Postgres que nadie puede leer.
 */
export function parseSeccionColumna(valor: unknown): PipelineSection {
  return SECCIONES_PIPELINE.some((s) => s.id === valor)
    ? (valor as PipelineSection)
    : SECCION_POR_DEFECTO;
}

/**
 * Columnas con las que arranca el pipeline de la agencia. Ya NO son un enum:
 * las siembra la migración 20260727200000 y desde ahí el equipo las edita.
 * Esto queda como referencia de con qué nació el tablero.
 */
export const COLUMNAS_POR_DEFECTO = [
  { name: "Pendiente", color: "#8892a6", sop: null, role: null },
  { name: "Estrategia", color: "#6d54f3", sop: "SOP-002", role: "Estratega" },
  { name: "Guion", color: "#9b6cf0", sop: "SOP-002", role: "Guionista" },
  { name: "Aprob. Guion", color: "#c07414", sop: null, role: "Cliente" },
  { name: "Grabación", color: "#1f9ac9", sop: "SOP-003", role: "Productor" },
  { name: "Edición", color: "#3b6ef5", sop: "SOP-004", role: "Editor" },
  { name: "QA", color: "#7c4de0", sop: "SOP-005", role: "QA" },
  { name: "Rev. Cliente", color: "#c9791b", sop: "SOP-006", role: "Cliente" },
  { name: "Programado", color: "#14a08a", sop: null, role: null },
  { name: "Publicado", color: "#14a06a", sop: null, role: null },
] as const;

/** Paleta que se ofrece al crear o editar una columna. */
export const COLORES_COLUMNA = [
  "#8892a6",
  "#6d54f3",
  "#9b6cf0",
  "#c07414",
  "#1f9ac9",
  "#3b6ef5",
  "#7c4de0",
  "#14a06a",
  "#df4650",
];

/**
 * La columna que sigue en el tablero, para el botón "Avanzar" del drawer.
 * Antes era el índice en un orden fijo; ahora es la siguiente por `position`.
 */
export function nextColumn(columns: ContentColumn[], columnId: string): ContentColumn | null {
  const i = columns.findIndex((c) => c.id === columnId);
  return i >= 0 && i < columns.length - 1 ? columns[i + 1] : null;
}

/**
 * Helpers de significado. El resto del admin pregunta por estos y NUNCA por el
 * nombre de la columna: el equipo puede renombrarlas y los cálculos del Pase de
 * servicio tienen que seguir dando lo mismo.
 */
export function doneColumnIds(columns: ContentColumn[]): Set<string> {
  return new Set(columns.filter((c) => c.is_done).map((c) => c.id));
}

export function pendingApprovalColumnIds(columns: ContentColumn[]): Set<string> {
  return new Set(columns.filter((c) => c.is_pending_approval).map((c) => c.id));
}
