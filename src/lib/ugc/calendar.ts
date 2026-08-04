import { formatInTimeZone } from "date-fns-tz";
import type { CalendarEventType } from "@/lib/database.types";

export const COSTA_RICA_TZ = "America/Costa_Rica";

/**
 * El día calendario en Costa Rica, siempre como 'yyyy-MM-dd'.
 *
 * Toda comparación de fechas en Q·OS pasa por acá. La razón está en la
 * migración 20260801000000: comparar instantes (`new Date(x) < new Date()`)
 * parece funcionar y falla seis horas por día, porque CR es UTC-6 y el día
 * cambia en momentos distintos en cada zona. En 'yyyy-MM-dd' el orden
 * alfabético coincide con el cronológico, así que compararlas como texto es
 * correcto y no hay forma de que se cuele una hora.
 *
 * Acepta las dos formas que conviven en la base:
 *   - un día suelto ('2026-08-01', columnas `date`) — se devuelve tal cual,
 *     porque NO representa un instante y convertirlo lo correría un día;
 *   - un instante ISO ('2026-08-01T03:00:00Z', columnas `timestamptz`) — se
 *     traduce a la zona de Costa Rica.
 */
export function diaCR(fecha: string | Date): string {
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  return formatInTimeZone(typeof fecha === "string" ? new Date(fecha) : fecha, COSTA_RICA_TZ, "yyyy-MM-dd");
}

/**
 * La hora en Costa Rica, o null si la fecha no tiene hora.
 *
 * Contraparte de diaCR y con el mismo criterio: un día suelto ('2026-08-04',
 * columnas `date`) NO es un instante y no tiene hora que mostrar. Formatearlo
 * igual lo leería como medianoche UTC y devolvería "18:00" —las 18:00 del día
 * anterior en CR—, una hora que nadie eligió y que parece un dato real.
 *
 * Se usa en la agenda: las publicaciones salen de content_pieces.publish_date,
 * que es un día; las reuniones y grabaciones salen de calendar_events.starts_at,
 * que sí ocurren a una hora concreta.
 */
export function horaCR(fecha: string | Date): string | null {
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  return formatInTimeZone(typeof fecha === "string" ? new Date(fecha) : fecha, COSTA_RICA_TZ, "HH:mm");
}

/** Suma (o resta, con negativo) días a un instante. */
export function sumarDias(desde: Date, dias: number): Date {
  return new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000);
}

/** Formato corto para las tarjetas: "1 ago". Sin año, que en el tablero sobra. */
export function diaCorto(fecha: string | Date): string {
  const [anio, mes, dia] = diaCR(fecha).split("-").map(Number);
  // Se arma con Date.UTC y se formatea en UTC para que el día no se mueva:
  // acá ya no queda nada de zona horaria que resolver, es un día literal.
  return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Con cuántos días de anticipación una publicación pasa a "publica pronto".
 *
 * Vive acá y no en el tablero porque lo comparten el semáforo de las tarjetas y
 * el aviso de McLovin: si cada uno tuviera su número, la tarjeta podría estar
 * en ámbar días antes (o después) de que llegue el WhatsApp y el equipo dejaría
 * de confiar en los dos.
 */
export const DIAS_PUBLICA_PRONTO = 3;

export type EstadoPublicacion = "vencida" | "pronto" | "normal";

/**
 * El semáforo de una fecha de publicación.
 *
 * Compara días de Costa Rica en 'yyyy-MM-dd', igual que todo el resto del
 * módulo — ver el comentario de diaCR. Hoy cuenta como "pronto": una pieza que
 * sale hoy y todavía está en edición es justamente el caso que hay que ver.
 *
 * NO sabe nada de columnas: que una pieza terminada no se pinte lo decide quien
 * llama, porque la bandera is_done es del tablero y no de la fecha.
 */
export function estadoPublicacion(fecha: string | Date, ahora: Date = new Date()): EstadoPublicacion {
  const dia = diaCR(fecha);
  const hoy = diaCR(ahora);
  if (dia < hoy) return "vencida";
  if (dia <= diaCR(sumarDias(ahora, DIAS_PUBLICA_PRONTO))) return "pronto";
  return "normal";
}

export type CalendarItem = {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string;
  brandId: string | null;
  brandName: string | null;
  brandLogoUrl: string | null;
  /** Solo los eventos propios lo traen; los derivados de una pieza van en false. */
  createdByAgent: boolean;
  responsibleName: string | null;
  /** Para pintar la cara del responsable; null cuando no subió foto. */
  responsibleAvatarUrl: string | null;
  /** El color de staff_members: es el fondo del avatar cuando no hay foto. */
  responsibleColor: string | null;
  contentPieceId: string | null;
};

export const CALENDAR_EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  publicacion: "Publicación",
  grabacion: "Grabación",
  reunion: "Reunión",
  entrega: "Entrega",
  guion: "Guion",
};

export const CALENDAR_EVENT_TYPE_DOT: Record<CalendarEventType, string> = {
  publicacion: "var(--st-pub)",
  grabacion: "var(--st-grab)",
  reunion: "var(--st-estr)",
  entrega: "var(--st-aprob)",
  // El mismo violeta que usaba la columna "Guion" del Kanban, para que el
  // equipo lo reconozca ahora que el hito vive acá.
  guion: "var(--st-guion)",
};

export const CALENDAR_EVENT_TYPE_BG: Record<CalendarEventType, string> = {
  publicacion: "rgba(20,160,106,.12)",
  grabacion: "rgba(31,154,201,.12)",
  reunion: "rgba(109,84,243,.12)",
  entrega: "rgba(192,116,20,.12)",
  guion: "rgba(155,108,240,.12)",
};
