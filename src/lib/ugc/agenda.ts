import { formatInTimeZone } from "date-fns-tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ContentPriority } from "@/lib/database.types";
import { COSTA_RICA_TZ, diaCR, sumarDias } from "@/lib/ugc/calendar";

/**
 * Qué le toca a un miembro del equipo y para cuándo.
 *
 * Sale de las dos tablas que ya tienen responsable y fecha —`content_pieces`
 * (owner_id + publish_date/record_date) y `calendar_events` (responsible_id +
 * starts_at)—. No hay tabla de tareas aparte a propósito: una que hubiera que
 * llenar a mano se llenaría dos semanas y después no, y el agente quedaría
 * recordando el vacío.
 *
 * Este archivo no sabe nada de WhatsApp ni de IA. Es data pura y es lo único
 * de todo el agente que tiene lógica que valga la pena testear en serio.
 */

/** Qué ítem es y, si es una pieza, cuál de sus dos fechas disparó el aviso. */
export type AgendaRef =
  | { kind: "piece"; pieceId: string; campo: "publish_date" | "record_date" }
  | { kind: "event"; eventId: string };

export type AgendaItem = {
  /** Único dentro de la agenda: una pieza puede aparecer dos veces (grabar y publicar). */
  key: string;
  ref: AgendaRef;
  titulo: string;
  /** Nombre del Hero. Los eventos pueden no tener uno (una reunión interna). */
  heroe: string | null;
  /**
   * Un día suelto ('2026-08-01') si viene de una pieza, un instante ISO si
   * viene de un evento. Son cosas distintas y por eso está `conHora`.
   */
  fecha: string;
  /**
   * Si es false, la fecha NO tiene hora y no hay que inventarle una.
   *
   * Una pieza se publica "el 1 de agosto", sin hora — el formulario ni siquiera
   * la pide. Un evento del calendario sí ocurre a una hora concreta. Mostrar
   * "18:00" en una pieza sería mostrar el artefacto de la conversión, no un
   * dato que alguien cargó.
   */
  conHora: boolean;
  accion: "Publicar" | "Grabar" | "Reunión" | "Entrega";
  prioridad: ContentPriority | null;
};

export type Agenda = {
  vencidas: AgendaItem[];
  hoy: AgendaItem[];
  proximas: AgendaItem[];
};

/** Cuántos días hacia adelante entran en "lo que se viene". */
export const DIAS_PROXIMAS = 3;

/**
 * Cuántos días hacia atrás se miran las vencidas.
 *
 * Hay un corte a propósito: el WhatsApp diario es un empujón, no una auditoría.
 * Algo atrasado hace dos meses no se destraba porque aparezca en un resumen —
 * y arrastrarlo todos los días es exactamente cómo se entrena a alguien a
 * ignorar el canal. Ese caso es del tablero, no del agente.
 */
export const DIAS_VENCIDAS = 30;

const PRIORIDAD_PESO: Record<ContentPriority, number> = { alta: 0, media: 1, baja: 2 };

export async function getStaffAgenda(
  supabase: SupabaseClient<Database>,
  profileId: string,
  now: Date = new Date()
): Promise<Agenda> {
  const hoy = diaCR(now);
  const desde = diaCR(sumarDias(now, -DIAS_VENCIDAS));
  const hasta = diaCR(sumarDias(now, DIAS_PROXIMAS));

  // El rango se acota en UTC con UN DÍA DE MARGEN a cada lado, y el filtro
  // fino por día CR queda para clasificar(). El margen no es por las dudas: CR
  // es UTC-6, así que el día CR `hasta` no termina a las 23:59Z de ese día sino
  // a las 05:59Z del siguiente. Sin margen, un evento a las 20:00 CR del último
  // día (02:00Z del siguiente) se caería del rango y nunca se avisaría.
  const desdeUtc = new Date(`${diaCR(sumarDias(now, -DIAS_VENCIDAS - 1))}T00:00:00Z`).toISOString();
  const hastaUtc = new Date(`${diaCR(sumarDias(now, DIAS_PROXIMAS + 1))}T23:59:59Z`).toISOString();

  const [{ data: piezas }, { data: eventos }] = await Promise.all([
    supabase
      .from("content_pieces")
      // El !inner con is_done=false es lo que deja afuera lo ya publicado.
      // Se pregunta por la BANDERA, nunca por el nombre de la columna: el
      // equipo puede renombrarlas y buscar por texto se rompería en silencio
      // (ver el comentario largo de 20260727200000_content_columns.sql).
      .select("id, title, brand_id, publish_date, record_date, priority, content_columns!inner(is_done)")
      .eq("owner_id", profileId)
      .eq("content_columns.is_done", false),
    supabase
      .from("calendar_events")
      .select("id, title, type, brand_id, starts_at")
      .eq("responsible_id", profileId)
      .eq("status", "programado")
      .gte("starts_at", desdeUtc)
      .lte("starts_at", hastaUtc),
  ]);

  const brandIds = new Set<string>();
  for (const p of piezas ?? []) if (p.brand_id) brandIds.add(p.brand_id);
  for (const e of eventos ?? []) if (e.brand_id) brandIds.add(e.brand_id);

  const { data: heroes } = brandIds.size
    ? await supabase.from("agency_clients").select("id, name").in("id", [...brandIds])
    : { data: [] };
  const heroePorId = new Map((heroes ?? []).map((h) => [h.id, h.name]));

  const items: AgendaItem[] = [];

  for (const p of piezas ?? []) {
    const heroe = p.brand_id ? heroePorId.get(p.brand_id) ?? null : null;
    // Las dos fechas de una pieza son dos compromisos distintos con dos
    // fechas distintas, así que van como dos ítems.
    if (p.record_date) {
      items.push({
        key: `piece-record-${p.id}`,
        ref: { kind: "piece", pieceId: p.id, campo: "record_date" },
        titulo: p.title,
        heroe,
        fecha: p.record_date,
        conHora: false,
        accion: "Grabar",
        prioridad: p.priority,
      });
    }
    if (p.publish_date) {
      items.push({
        key: `piece-publish-${p.id}`,
        ref: { kind: "piece", pieceId: p.id, campo: "publish_date" },
        titulo: p.title,
        heroe,
        fecha: p.publish_date,
        conHora: false,
        accion: "Publicar",
        prioridad: p.priority,
      });
    }
  }

  for (const e of eventos ?? []) {
    items.push({
      key: `event-${e.id}`,
      ref: { kind: "event", eventId: e.id },
      titulo: e.title,
      heroe: e.brand_id ? heroePorId.get(e.brand_id) ?? null : null,
      fecha: e.starts_at,
      conHora: true,
      accion: e.type === "grabacion" ? "Grabar" : e.type === "publicacion" ? "Publicar" : e.type === "entrega" ? "Entrega" : "Reunión",
      prioridad: null,
    });
  }

  return clasificar(items, { hoy, desde, hasta });
}

/**
 * Reparte los ítems en vencidas / hoy / próximas comparando DÍAS CALENDARIO DE
 * COSTA RICA, no instantes.
 *
 * Es la sutileza que hay que no romper: un evento a las 23:30 del lunes en CR
 * se guarda como las 05:30Z del martes. Comparando en UTC "hoy" ese evento se
 * iría a mañana y el recordatorio del lunes no lo mencionaría — justo el que
 * más falta hacía. Por eso se normaliza todo a 'yyyy-MM-dd' en CR y se compara
 * como texto, que en ese formato ordena igual que la fecha.
 */
export function clasificar(
  items: AgendaItem[],
  rango: { hoy: string; desde: string; hasta: string }
): Agenda {
  const agenda: Agenda = { vencidas: [], hoy: [], proximas: [] };

  for (const item of items) {
    const dia = diaCR(item.fecha);
    if (dia < rango.desde || dia > rango.hasta) continue;
    if (dia < rango.hoy) agenda.vencidas.push(item);
    else if (dia === rango.hoy) agenda.hoy.push(item);
    else agenda.proximas.push(item);
  }

  // Las vencidas, de la más vieja primero (esa es la que más duele). El resto,
  // cronológico, y a igual fecha manda la prioridad.
  agenda.vencidas.sort(porFechaYPrioridad);
  agenda.hoy.sort(porFechaYPrioridad);
  agenda.proximas.sort(porFechaYPrioridad);

  return agenda;
}

/**
 * Ordena primero por día de CR y recién después por hora.
 *
 * No se pueden restar los instantes directamente: en la misma lista conviven
 * días sueltos ('2026-08-01', que como instante es la medianoche UTC = las 18:00
 * del día anterior en CR) e instantes reales de eventos. Restarlos pondría una
 * pieza del día 1 antes que un evento del día 31.
 */
function porFechaYPrioridad(a: AgendaItem, b: AgendaItem): number {
  const porDia = diaCR(a.fecha).localeCompare(diaCR(b.fecha));
  if (porDia !== 0) return porDia;

  // Dentro del mismo día, lo que tiene hora se ordena por hora. Una pieza (sin
  // hora) va primero: es del día entero, no de un momento.
  if (a.conHora && b.conHora) {
    const dif = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    if (dif !== 0) return dif;
  } else if (a.conHora !== b.conHora) {
    return a.conHora ? 1 : -1;
  }

  return (a.prioridad ? PRIORIDAD_PESO[a.prioridad] : 1) - (b.prioridad ? PRIORIDAD_PESO[b.prioridad] : 1);
}

export function contarAgenda(agenda: Agenda): number {
  return agenda.vencidas.length + agenda.hoy.length + agenda.proximas.length;
}

/** Todos los ítems en una lista, para validar contra qué puede actuar el agente. */
export function itemsDeAgenda(agenda: Agenda): AgendaItem[] {
  return [...agenda.vencidas, ...agenda.hoy, ...agenda.proximas];
}

function describir(item: AgendaItem, mostrarHora = false): string {
  const partes = [`${item.accion} ${item.titulo}`];
  if (item.heroe) partes.push(`(${item.heroe})`);
  // `item.conHora` manda: una pieza no tiene hora y ponerle una sería inventarla.
  if (mostrarHora && item.conHora) partes.push(formatInTimeZone(new Date(item.fecha), COSTA_RICA_TZ, "HH:mm"));
  return partes.join(" ");
}

/**
 * El resumen sin LLM.
 *
 * No es un andamio hasta que llegue la IA: es el fallback permanente. Si Gemini
 * se cae, cambia de precio o devuelve cualquier cosa, el recordatorio tiene que
 * salir igual — un aviso feo llega, uno que no se manda no sirve para nada.
 *
 * Devuelve UNA SOLA LÍNEA porque va como variable de una plantilla de WhatsApp,
 * y esas no admiten saltos de línea.
 */
export function resumenDeterminista(agenda: Agenda, maxItems = 3): string {
  const bloques: string[] = [];

  if (agenda.vencidas.length) {
    bloques.push(`Atrasado (${agenda.vencidas.length}): ${listar(agenda.vencidas, maxItems)}`);
  }
  if (agenda.hoy.length) {
    bloques.push(`Hoy (${agenda.hoy.length}): ${listar(agenda.hoy, maxItems, true)}`);
  }
  if (agenda.proximas.length) {
    bloques.push(`Próximos ${DIAS_PROXIMAS} días: ${agenda.proximas.length}`);
  }

  return bloques.join(". ") || "Sin pendientes.";
}

function listar(items: AgendaItem[], max: number, conHora = false): string {
  const visibles = items.slice(0, max).map((i) => describir(i, conHora));
  const resto = items.length - visibles.length;
  return visibles.join("; ") + (resto > 0 ? ` y ${resto} más` : "");
}
