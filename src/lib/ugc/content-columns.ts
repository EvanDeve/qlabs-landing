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


/*
 * Orden de las columnas dentro de un board.
 *
 * Importa más de lo que parece: la ÚLTIMA columna de cada board es la que
 * cuenta como publicada/cerrada (`is_done`), y eso no se elige con una
 * casilla: lo pone el trigger content_columns_columna_final (migración
 * 20260818140000) mirando la posición. Así que reordenar es también decidir
 * qué cuenta como publicado. El 2026-11-19 se creó "Por Grabar" al final del
 * board video, se llevó la bandera de Publicado, y el Dashboard pasó a contar
 * 393 atrasadas en vez de 13.
 */
export type ColumnaOrdenable = { id: string; position: number; created_at: string };

function ordenarColumnas<T extends ColumnaOrdenable>(columnas: T[]): T[] {
  return [...columnas].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

/**
 * Mueve una columna un lugar dentro de su board (`columnas` = las de UN board).
 * Devuelve solo las posiciones que cambian, o null si no se puede mover.
 *
 * Reusa las posiciones que el board ya tiene, en vez de renumerar desde 0: en
 * la vista "Todo" los boards se muestran ordenados por posición global, y
 * renumerar uno lo mezclaría con los otros.
 */
export function moverEnCarril(
  columnas: ColumnaOrdenable[],
  id: string,
  direccion: -1 | 1
): { id: string; position: number }[] | null {
  const ordenadas = ordenarColumnas(columnas);
  const i = ordenadas.findIndex((c) => c.id === id);
  const j = i + direccion;
  if (i === -1 || j < 0 || j >= ordenadas.length) return null;

  // Posiciones estrictamente crecientes: si dos empatan, intercambiarlas no
  // cambiaría nada.
  const posiciones: number[] = [];
  for (const c of ordenadas) {
    const anterior = posiciones[posiciones.length - 1];
    posiciones.push(anterior === undefined ? c.position : Math.max(c.position, anterior + 1));
  }

  const nuevoOrden = [...ordenadas];
  [nuevoOrden[i], nuevoOrden[j]] = [nuevoOrden[j], nuevoOrden[i]];

  return nuevoOrden
    .map((c, k) => ({ id: c.id, position: posiciones[k] }))
    .filter((c) => c.position !== columnas.find((x) => x.id === c.id)!.position);
}

/**
 * Dónde nace una columna nueva: ANTES de la final de su board, para que crear
 * un paso no cambie en silencio qué cuenta como publicado. La final corre un
 * lugar y la nueva toma el suyo. Si alguien quiere que la nueva sea la final,
 * la mueve después. `maxGlobal` = la posición más alta de todos los boards,
 * para un board que todavía no tiene columnas.
 */
export function posicionParaNueva(
  delCarril: ColumnaOrdenable[],
  maxGlobal: number
): { position: number; correrFinal: { id: string; position: number } | null } {
  const ordenadas = ordenarColumnas(delCarril);
  const final = ordenadas[ordenadas.length - 1];
  if (!final) return { position: maxGlobal + 1, correrFinal: null };
  return { position: final.position, correrFinal: { id: final.id, position: final.position + 1 } };
}
