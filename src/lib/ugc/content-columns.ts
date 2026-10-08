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

