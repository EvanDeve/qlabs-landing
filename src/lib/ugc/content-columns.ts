import type { Database } from "@/lib/database.types";

export type ContentColumn = Database["public"]["Tables"]["content_columns"]["Row"];

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
