import type { Database, PipelineBoardKind, PipelineSection } from "@/lib/database.types";

export type ContentColumn = Database["public"]["Tables"]["content_columns"]["Row"];

/**
 * Un board del Pipeline (una pestaña). Desde 20261006120000 son filas de
 * `pipeline_boards`, las crea el director y cada uno tiene su gente: la RLS
 * solo devuelve los boards —y las columnas y tarjetas— donde estás.
 *
 * ⚠️ El board solo reparte columnas entre pestañas. Los conteos por Hero
 * —publicados del mes, atrasadas, carga— miran solo el board 'video'.
 */
export type PipelineBoard = { id: PipelineSection; name: string; kind: PipelineBoardKind };

/**
 * Los boards donde una tarjeta es una tarea y no un video: sin guion, sin
 * plataforma, sin hora de salida, y su fecha es "para cuándo tiene que estar"
 * y no una publicación. El editor, el modal de pieza nueva, el Calendario y la
 * agenda de McLovin preguntan esto y NUNCA por el id del board.
 *
 * Se resuelve con el id, sin ir a buscar el board: el tipo no cambia después
 * de creado y viaja en el id (`t_…`), cosa que la base garantiza con el check
 * `pipeline_boards_kind_en_id`. IT y Admin son los dos de antes.
 */
export function esCarrilDeTareas(section: PipelineSection | null | undefined): boolean {
  return !!section && (section === "it" || section === "admin" || section.startsWith("t_"));
}

/**
 * Valida el `?seccion=` de la URL contra los boards que esta persona puede
 * ver. Devuelve null para "Todo" —que es una vista real, no la ausencia de
 * filtro— y el primer board visible cuando el valor no existe o no es suyo,
 * para que una URL vieja o ajena no muestre un tablero vacío sin explicación.
 */
export function parseSeccion(valor: string | undefined, boards: PipelineBoard[]): PipelineSection | null {
  if (valor === "todo") return null;
  if (boards.some((b) => b.id === valor)) return valor as PipelineSection;
  return boards[0]?.id ?? null;
}

/**
 * El board que viene del formulario de columna. Si no existe o no es tuyo, el
 * insert lo frena la base (FK y RLS); acá solo se descarta lo que no es texto.
 */
export function parseSeccionColumna(valor: unknown): PipelineSection {
  // "todo" es una vista, no un lugar donde una columna pueda vivir.
  return typeof valor === "string" && valor && valor !== "todo" ? valor : "video";
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
