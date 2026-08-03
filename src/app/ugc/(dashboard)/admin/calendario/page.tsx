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
import { COSTA_RICA_TZ, diaCR, type CalendarItem } from "@/lib/ugc/calendar";

export const dynamic = "force-dynamic";

type ViewMode = "month" | "week" | "day";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { view: viewParam, date: dateParam } = await searchParams;
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
      supabase.from("agency_clients").select("id, name, logo_url"),
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
        .select("id, title, brand_id, publish_date, record_date")
        .or(
          `and(publish_date.gte.${gridDays[0]},publish_date.lte.${gridDays[gridDays.length - 1]}),and(record_date.gte.${gridDays[0]},record_date.lte.${gridDays[gridDays.length - 1]})`
        ),
    ]);

  const staffIds = (staffMembers ?? []).map((s) => s.profile_id);
  const { data: staffAccountProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", staffIds)
    : { data: [] };
  const staffNameById = new Map((staffAccountProfiles ?? []).map((p) => [p.id, p.display_name]));
  const brandNameById = new Map((agencyClients ?? []).map((c) => [c.id, c.name]));
  const brandLogoById = new Map((agencyClients ?? []).map((c) => [c.id, c.logo_url]));

  const items: CalendarItem[] = [];

  for (const event of calendarEvents ?? []) {
    items.push({
      id: event.id,
      type: event.type,
      title: event.title,
      date: event.starts_at,
      brandId: event.brand_id,
      brandName: event.brand_id ? brandNameById.get(event.brand_id) ?? null : null,
      brandLogoUrl: event.brand_id ? brandLogoById.get(event.brand_id) ?? null : null,
      createdByAgent: event.created_by_agent,
      responsibleName: event.responsible_id ? staffNameById.get(event.responsible_id) ?? null : null,
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
        brandId: piece.brand_id,
        brandName: brandNameById.get(piece.brand_id) ?? null,
        brandLogoUrl: brandLogoById.get(piece.brand_id) ?? null,
        createdByAgent: false,
        responsibleName: null,
        contentPieceId: piece.id,
      });
    }
    if (piece.record_date && piece.record_date >= gridDays[0] && piece.record_date <= gridDays[gridDays.length - 1]) {
      items.push({
        id: `piece-record-${piece.id}`,
        type: "grabacion",
        title: piece.title,
        date: piece.record_date,
        brandId: piece.brand_id,
        brandName: brandNameById.get(piece.brand_id) ?? null,
        brandLogoUrl: brandLogoById.get(piece.brand_id) ?? null,
        createdByAgent: false,
        responsibleName: null,
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
    itemsByDay[key].sort((a, b) => a.date.localeCompare(b.date));
  }

  const brands = (agencyClients ?? []).map((c) => ({ id: c.id, name: c.name }));
  const staff = (staffMembers ?? []).map((s) => ({
    id: s.profile_id,
    name: staffNameById.get(s.profile_id) ?? "Sin nombre",
  }));

  return (
    <CalendarView
      view={view}
      refDateStr={refDateStr}
      gridDays={gridDays}
      itemsByDay={itemsByDay}
      brands={brands}
      staff={staff}
    />
  );
}
