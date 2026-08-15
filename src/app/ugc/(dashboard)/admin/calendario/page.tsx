import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import CalendarView from "@/components/ugc/admin/CalendarView";
import { COSTA_RICA_TZ, diaCR, horaCR, type CalendarItem } from "@/lib/ugc/calendar";
import { coloresDeHeroes } from "@/lib/ugc/content-meta";

export const dynamic = "force-dynamic";

type ViewMode = "month" | "week" | "day";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; heroes?: string }>;
}) {
  const { view: viewParam, date: dateParam, heroes: heroesParam } = await searchParams;
  const view: ViewMode = viewParam === "week" || viewParam === "day" ? viewParam : "month";
  const refDateStr = dateParam || formatInTimeZone(new Date(), COSTA_RICA_TZ, "yyyy-MM-dd");
  const refDate = new Date(`${refDateStr}T00:00:00`);

  let gridStart: Date;
  let gridEnd: Date;
  if (view === "month") {
    gridStart = startOfWeek(startOfMonth(refDate), { weekStartsOn: 1 });
    gridEnd = endOfWeek(endOfMonth(refDate), { weekStartsOn: 1 });
  } else if (view === "week") {
    gridStart = startOfWeek(refDate, { weekStartsOn: 1 });
    gridEnd = endOfWeek(refDate, { weekStartsOn: 1 });
  } else {
    gridStart = refDate;
    gridEnd = refDate;
  }

  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd }).map((d) => format(d, "yyyy-MM-dd"));

  const rangeStartUtc = fromZonedTime(`${format(gridStart, "yyyy-MM-dd")} 00:00:00`, COSTA_RICA_TZ).toISOString();
  const rangeEndUtc = fromZonedTime(`${format(gridEnd, "yyyy-MM-dd")} 23:59:59`, COSTA_RICA_TZ).toISOString();

  const supabase = await createClient();

  const [{ data: agencyClients }, { data: staffMembers }, { data: calendarEvents }, { data: contentPieces }] =
    await Promise.all([
      // `archived` viaja porque decide dos cosas distintas: qué Heroes tienen
      // pastilla de filtro (solo los activos) y con cuántos se calcula la
      // paleta (TODOS). Ver coloresDeHeroes más abajo.
      supabase.from("agency_clients").select("id, name, logo_url, archived"),
      // staff_directory y no staff_members: la tabla quedó cerrada a
    // directores porque guarda teléfonos y opt-in de WhatsApp. La vista
    // expone solo lo que el tablero necesita para pintar responsables.
    supabase.from("staff_directory").select("profile_id, staff_role, color").eq("active", true),
      supabase
        .from("calendar_events")
        .select("*")
        .gte("starts_at", rangeStartUtc)
        .lte("starts_at", rangeEndUtc),
      // Las fechas de las piezas son columnas `date`: se filtran con días
      // sueltos, no con instantes UTC. Mandarles un timestamp haría que
      // Postgres lo truncara a día en la zona de la sesión, que es justo la
      // clase de conversión implícita que causó el corrimiento de un día.
      supabase
        .from("content_pieces")
        .select(
          "id, title, brand_id, owner_id, publish_date, record_date, publish_time, platform, approval"
        )
        .or(
          `and(publish_date.gte.${gridDays[0]},publish_date.lte.${gridDays[gridDays.length - 1]}),and(record_date.gte.${gridDays[0]},record_date.lte.${gridDays[gridDays.length - 1]})`
        ),
    ]);

  const staffIds = (staffMembers ?? []).map((s) => s.profile_id);
  const { data: staffAccountProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", staffIds)
    : { data: [] };
  const staffNameById = new Map((staffAccountProfiles ?? []).map((p) => [p.id, p.display_name]));
  const staffAvatarById = new Map((staffAccountProfiles ?? []).map((p) => [p.id, p.avatar_url]));
  const staffColorById = new Map((staffMembers ?? []).map((s) => [s.profile_id, s.color]));
  const brandNameById = new Map((agencyClients ?? []).map((c) => [c.id, c.name]));
  const brandLogoById = new Map((agencyClients ?? []).map((c) => [c.id, c.logo_url]));

  const items: CalendarItem[] = [];

  for (const event of calendarEvents ?? []) {
    items.push({
      id: event.id,
      type: event.type,
      title: event.title,
      date: event.starts_at,
      // starts_at es un timestamptz, o sea un instante real: acá la hora
      // siempre existe y es la que alguien eligió al crear el evento.
      hora: horaCR(event.starts_at),
      platform: null,
      approval: null,
      brandId: event.brand_id,
      brandName: event.brand_id ? brandNameById.get(event.brand_id) ?? null : null,
      brandLogoUrl: event.brand_id ? brandLogoById.get(event.brand_id) ?? null : null,
      createdByAgent: event.created_by_agent,
      responsibleName: event.responsible_id ? staffNameById.get(event.responsible_id) ?? null : null,
      responsibleAvatarUrl: event.responsible_id ? staffAvatarById.get(event.responsible_id) ?? null : null,
      responsibleColor: event.responsible_id ? staffColorById.get(event.responsible_id) ?? null : null,
      contentPieceId: event.content_piece_id,
    });
  }

  for (const piece of contentPieces ?? []) {
    if (piece.publish_date && piece.publish_date >= gridDays[0] && piece.publish_date <= gridDays[gridDays.length - 1]) {
      items.push({
        id: `piece-publish-${piece.id}`,
        type: "publicacion",
        title: piece.title,
        date: piece.publish_date,
        // publish_date es un `date` y no tiene hora, pero al lado vive
        // publish_time —la hora que el equipo eligió para publicar— y es la
        // única forma de que una publicación muestre una hora de verdad. Se
        // recorta a HH:mm porque Postgres devuelve "13:00:00".
        // Ojo: hoy solo 16 de las 116 publicaciones de agosto la tienen.
        hora: piece.publish_time ? piece.publish_time.slice(0, 5) : null,
        platform: piece.platform,
        approval: piece.approval,
        brandId: piece.brand_id,
        brandName: brandNameById.get(piece.brand_id) ?? null,
        brandLogoUrl: brandLogoById.get(piece.brand_id) ?? null,
        createdByAgent: false,
        // Antes iba null fijo: la pieza traía dueño pero el calendario no lo
        // pedía, así que una publicación no decía de quién era. Ahora sale del
        // mismo owner_id que pinta la tarjeta del Pipeline.
        responsibleName: piece.owner_id ? staffNameById.get(piece.owner_id) ?? null : null,
        responsibleAvatarUrl: piece.owner_id ? staffAvatarById.get(piece.owner_id) ?? null : null,
        responsibleColor: piece.owner_id ? staffColorById.get(piece.owner_id) ?? null : null,
        contentPieceId: piece.id,
      });
    }
    if (piece.record_date && piece.record_date >= gridDays[0] && piece.record_date <= gridDays[gridDays.length - 1]) {
      items.push({
        id: `piece-record-${piece.id}`,
        type: "grabacion",
        title: piece.title,
        date: piece.record_date,
        // Sin hora y no por olvido: record_date es un `date` y no tiene columna
        // de hora que la acompañe, como sí la tiene publish_date. Las
        // grabaciones que muestran hora son las de calendar_events.
        hora: null,
        platform: piece.platform,
        approval: piece.approval,
        brandId: piece.brand_id,
        brandName: brandNameById.get(piece.brand_id) ?? null,
        brandLogoUrl: brandLogoById.get(piece.brand_id) ?? null,
        createdByAgent: false,
        responsibleName: piece.owner_id ? staffNameById.get(piece.owner_id) ?? null : null,
        responsibleAvatarUrl: piece.owner_id ? staffAvatarById.get(piece.owner_id) ?? null : null,
        responsibleColor: piece.owner_id ? staffColorById.get(piece.owner_id) ?? null : null,
        contentPieceId: piece.id,
      });
    }
  }

  const itemsByDay: Record<string, CalendarItem[]> = {};
  for (const item of items) {
    // diaCR devuelve tal cual los días sueltos de las piezas y traduce a CR los
    // instantes de los eventos. Pasar un día por formatInTimeZone lo leería
    // como medianoche UTC y lo pondría en la casilla del día anterior.
    const key = diaCR(item.date);
    (itemsByDay[key] ??= []).push(item);
  }
  for (const key of Object.keys(itemsByDay)) {
    // Ordena por HORA y no por `date`. Las dos fuentes guardan el día distinto
    // —las piezas un 'yyyy-MM-dd' pelado, los eventos un ISO con hora— así que
    // comparar `date` como texto mandaba TODOS los eventos después de TODAS las
    // publicaciones, sin importar la hora: una grabación de las 9 salía debajo
    // de una publicación de las 17. Los items sin hora van al final, que es
    // donde tiene sentido leerlos: no compiten por un lugar en el día.
    itemsByDay[key].sort(
      (a, b) => (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99") || a.title.localeCompare(b.title)
    );
  }

  const brands = (agencyClients ?? []).map((c) => ({ id: c.id, name: c.name }));
  const staff = (staffMembers ?? []).map((s) => ({
    id: s.profile_id,
    name: staffNameById.get(s.profile_id) ?? "Sin nombre",
  }));

  // La paleta se calcula con TODOS los Heroes, archivados incluidos, porque
  // coloresDeHeroes reparte por posición en la lista ordenada: si acá entraran
  // solo los 11 activos, cada uno tomaría el color del que le sigue y el mismo
  // Hero cambiaría de color según qué pantalla lo pida. Las pastillas del
  // filtro, en cambio, muestran solo los activos — un Hero archivado no tiene
  // nada que planificar este mes.
  const heroColors = Object.fromEntries(coloresDeHeroes((agencyClients ?? []).map((c) => c.id)));
  const heroes = (agencyClients ?? [])
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  // El filtro viaja en la URL y no en estado del cliente porque moverse de mes
  // es una navegación de verdad (`?date=`): con estado se perdía la selección
  // en cada flecha. Mismo motivo que el `?volver=` del Pipeline.
  const heroFilter = (heroesParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <CalendarView
      view={view}
      refDateStr={refDateStr}
      gridDays={gridDays}
      itemsByDay={itemsByDay}
      brands={brands}
      staff={staff}
      heroes={heroes}
      heroColors={heroColors}
      heroFilter={heroFilter}
    />
  );
}
