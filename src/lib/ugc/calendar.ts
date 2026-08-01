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

export type CalendarItem = {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string;
  brandId: string | null;
  brandName: string | null;
  responsibleName: string | null;
  contentPieceId: string | null;
};

export const CALENDAR_EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  publicacion: "Publicación",
  grabacion: "Grabación",
  reunion: "Reunión",
  entrega: "Entrega",
};

export const CALENDAR_EVENT_TYPE_DOT: Record<CalendarEventType, string> = {
  publicacion: "var(--st-pub)",
  grabacion: "var(--st-grab)",
  reunion: "var(--st-estr)",
  entrega: "var(--st-aprob)",
};

export const CALENDAR_EVENT_TYPE_BG: Record<CalendarEventType, string> = {
  publicacion: "rgba(20,160,106,.12)",
  grabacion: "rgba(31,154,201,.12)",
  reunion: "rgba(109,84,243,.12)",
  entrega: "rgba(192,116,20,.12)",
};
