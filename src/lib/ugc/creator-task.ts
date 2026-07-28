import type { ContentPlatform } from "@/lib/database.types";

/**
 * Columnas con las que arranca un creador. Ya NO son un enum: son las filas que
 * se siembran la primera vez que entra al pipeline, y a partir de ahí las
 * cambia como quiera. Ver 20260727100000_creator_task_columns.sql.
 *
 * Los colores van en hex porque ahora son dato configurable; vienen de las
 * custom properties --st-* de qos.module.css para que el tablero recién
 * sembrado se lea igual que el resto del sistema.
 */
export const COLUMNAS_POR_DEFECTO: { name: string; color: string; is_done: boolean }[] = [
  { name: "Idea", color: "#8892a6", is_done: false },
  { name: "Guion", color: "#9b6cf0", is_done: false },
  { name: "Grabación", color: "#1f9ac9", is_done: false },
  { name: "Edición", color: "#3b6ef5", is_done: false },
  { name: "Publicado", color: "#14a06a", is_done: true },
];

/** Paleta que se ofrece al crear o editar una columna. */
export const COLORES_COLUMNA = [
  "#8892a6",
  "#6d54f3",
  "#9b6cf0",
  "#c07414",
  "#1f9ac9",
  "#3b6ef5",
  "#14a06a",
  "#df4650",
];

export const PLATFORM_LABEL: Record<ContentPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  reels: "Reels",
};

export const PLATFORMS: ContentPlatform[] = ["instagram", "tiktok", "reels"];

export function isPlatform(value: string): value is ContentPlatform {
  return (PLATFORMS as string[]).includes(value);
}

/**
 * Días que faltan para la fecha de una tarea. Negativo = ya venció.
 *
 * Compara en fecha local, no con `new Date(due) - Date.now()`: `due_date` es un
 * `date` de Postgres y llega como "2026-07-30", que el constructor interpreta
 * como medianoche UTC. En Costa Rica (UTC-6) eso hace que una tarea de hoy se
 * vea vencida desde las 6pm del día anterior.
 */
export function daysUntil(dueDate: string): number {
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((due.getTime() - hoySinHora.getTime()) / 86_400_000);
}

/** Texto corto para la tarjeta: "vence hoy", "en 3 días", "hace 2 días". */
export function dueLabel(dueDate: string): string {
  const dias = daysUntil(dueDate);
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "mañana";
  if (dias === -1) return "venció ayer";
  if (dias > 1) return `en ${dias} días`;
  return `venció hace ${Math.abs(dias)} días`;
}
