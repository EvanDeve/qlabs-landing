import { formatInTimeZone } from "date-fns-tz";
import type { CalendarEventType, ContentApproval, ContentPlatform } from "@/lib/database.types";

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
  /**
   * La hora que se muestra, o null cuando el item no tiene ninguna.
   *
   * NO se deriva sola de `date`: las tres fuentes del calendario guardan la
   * hora de forma distinta y dos de ellas directamente no la tienen.
   *   - `calendar_events.starts_at` es un timestamptz: la hora sale de horaCR.
   *   - `content_pieces.publish_date` es un `date`, pero al lado vive
   *     `publish_time`, que es la hora que el equipo eligió para publicar.
   *   - `content_pieces.record_date` es un `date` y NO tiene columna de hora:
   *     una grabación derivada de una pieza va siempre en null.
   *
   * Medido sobre agosto 2026: de 129 items, 29 tienen hora (16 publicaciones
   * con publish_time + 13 eventos de grabación). Los otros 100 salen sin ella,
   * y el chip se dibuja sin hueco en vez de inventarle una.
   */
  hora: string | null;
  brandId: string | null;
  brandName: string | null;
  brandLogoUrl: string | null;
  /** Solo los eventos propios lo traen; los derivados de una pieza van en false. */
  createdByAgent: boolean;
  /** Solo los items que salen de una pieza; un evento suelto no tiene formato. */
  platform: ContentPlatform | null;
  /** Ídem: el estado de aprobación es de la pieza, no del evento. */
  approval: ContentApproval | null;
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

/**
 * El ícono de cada tipo, para la grilla del mes.
 *
 * Existe porque en la grilla el color pasó a decir de QUÉ HERO es el item, no
 * de qué tipo es — y el tipo había que poder seguir leyéndolo. El motivo del
 * cambio está medido: de los 129 items de agosto, 116 son publicaciones, así
 * que pintar por tipo dejaba el mes entero del mismo verde y el color no
 * distinguía nada. El Hero sí varía, y usa la misma paleta que las pastillas
 * del filtro de arriba, así que un color significa lo mismo en las dos.
 *
 * Los tipos que no vienen de una pieza (reunión, entrega) casi no aparecen hoy,
 * pero llevan ícono igual: el modal los deja crear.
 */
export const CALENDAR_EVENT_TYPE_ICON: Record<CalendarEventType, string> = {
  publicacion: "calendar",
  grabacion: "camera",
  reunion: "users",
  entrega: "check",
  guion: "doc",
};

export type NivelCarga = "libre" | "ligera" | "media" | "llena";

/**
 * Cuán cargado está un día del calendario, por cantidad de items.
 *
 * Los cortes son FIJOS y no relativos al mes (decisión de Evan, 2026-08-15).
 * Con cortes relativos siempre existiría un "día más cargado" que se pinta
 * rojo, así que un mes flojo se vería igual de saturado que uno lleno y el
 * color dejaría de querer decir algo. Fijos, rojo significa lo mismo en agosto
 * que en febrero.
 *
 * Medido sobre agosto 2026 —125 items repartidos en 30 días— da 9 días
 * ligeros, 10 medios, 11 llenos y 1 libre.
 */
export function nivelDeCarga(items: number): NivelCarga {
  if (items === 0) return "libre";
  if (items <= 2) return "ligera";
  if (items <= 4) return "media";
  return "llena";
}

export const CARGA_LABEL: Record<NivelCarga, string> = {
  libre: "Día libre",
  ligera: "Carga ligera",
  media: "Carga media",
  llena: "Día lleno",
};

/**
 * La franja de horas que dibuja la grilla de la vista de Semana: de 8 de la
 * mañana a 8 de la noche.
 *
 * Fija y no ajustada a los datos (decisión de Evan, 2026-08-15: "8 a 8"). Una
 * franja que se estira con lo que haya cambia de forma cada semana, y entonces
 * la misma altura significa horas distintas y dos semanas no se pueden comparar.
 */
export const HORA_INICIO = 8;
export const HORA_FIN = 20;

/**
 * Si un item tiene lugar propio en la grilla horaria de la semana.
 *
 * Los que devuelven false van a la banda "Sin hora" de arriba, y son dos casos
 * que comparten el mismo problema —no hay dónde dibujarlos—:
 *   - los que NO tienen hora, que son la enorme mayoría: 36 de los 49 items de
 *     la semana del 10 al 16 de agosto, medido contra la base;
 *   - los que la tienen pero caen fuera de 8–20. Hoy son los 3 eventos de
 *     madrugada de agosto (03:00 y 06:00), que están así por el bug de zona
 *     horaria de `calendar-events.ts`. Mandarlos a la banda con la hora a la
 *     vista es lo que evita que el bug se vuelva invisible al no dibujarlos.
 */
export function entraEnLaGrilla(hora: string | null): boolean {
  if (!hora) return false;
  const h = Number(hora.slice(0, 2));
  return h >= HORA_INICIO && h < HORA_FIN;
}

export const CARGA_COLOR: Record<NivelCarga, string> = {
  // El día libre no pinta barra: no hay nada que medir y una barra gris se lee
  // como "poquito" en vez de como "nada".
  libre: "transparent",
  ligera: "var(--ok)",
  media: "var(--warn)",
  llena: "var(--risk)",
};
