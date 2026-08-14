import { createClient } from "@/lib/supabase/server";
import KanbanBoard from "@/components/ugc/admin/KanbanBoard";
import { STAFF_ROLE_LABEL, parseFiltroFecha, parseDia, rangoFiltroFecha } from "@/lib/ugc/content-meta";
import { parseSeccion } from "@/lib/ugc/content-columns";
import { parseMesCorto, rangoDelMes } from "@/lib/ugc/cronograma";
import type { ContentPriority } from "@/lib/database.types";
import styles from "../qos.module.css";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string;
    owner?: string;
    priority?: string;
    fecha?: string;
    dia?: string;
    mes?: string;
    seccion?: string;
    archivados?: string;
    /**
     * El texto del buscador. NO lo escribe la barra de filtros —el buscador
     * filtra en el navegador— sino quien vuelve de una pieza: es parte de "el
     * tablero como lo dejé". Ver `vistaDelPipeline`.
     */
    q?: string;
  }>;
}) {
  const { brand, owner, priority, fecha, dia, mes, seccion, archivados, q } = await searchParams;
  const diaExacto = parseDia(dia);
  const mesExacto = diaExacto ? null : parseMesCorto(mes);
  // Los tres cortes por fecha son excluyentes, y el orden de precedencia es de
  // más preciso a menos: día > mes > preset. Si por alguna razón viajan varios
  // en la URL se aplica UNO solo, y la toolbar muestra ese mismo — nunca se
  // cruzan, porque "atrasadas Y septiembre" casi siempre es el conjunto vacío
  // y se lee como que el tablero se rompió.
  const filtroFecha = diaExacto || mesExacto ? null : parseFiltroFecha(fecha);
  const seccionActiva = parseSeccion(seccion);
  const verArchivados = archivados === "1";
  const supabase = await createClient();

  const [{ data: agencyClients }, { data: staffMembers }, { data: columns }, piecesQuery] =
    await Promise.all([
    // drive_url viaja para poner el botón del Drive del Hero en cada tarjeta:
    // es el MISMO que se carga en el expediente del Hero, no uno por pieza
    // (`content_pieces.drive_url`, que sigue viviendo en el drawer).
    supabase.from("agency_clients").select("id, name, logo_url, drive_url, archived").order("name"),
    // staff_directory y no staff_members: la tabla quedó cerrada a
    // directores porque guarda teléfonos y opt-in de WhatsApp. La vista
    // expone solo lo que el tablero necesita para pintar responsables.
    supabase.from("staff_directory").select("profile_id, staff_role, color").eq("active", true),
    supabase.from("content_columns").select("*").order("position", { ascending: true }),
    (() => {
      // El orden manda la fecha de publicación, no la creación: lo que el
      // equipo necesita ver arriba de cada columna es lo que sale primero.
      //
      // nullsFirst:false deja las piezas sin fecha al fondo. Una pieza sin
      // publicación planeada no puede encabezar la columna —no es lo más
      // urgente— pero tampoco puede desaparecer: sigue ahí abajo, y ahora
      // además hay un filtro "Sin fecha de publicación" para cazarlas.
      //
      // El segundo criterio ordena entre las que comparten día (y entre todas
      // las que no tienen ninguno); sin él, Postgres devuelve ese subconjunto
      // en el orden que le quede cómodo y las tarjetas bailan entre recargas.
      let query = supabase
        .from("content_pieces")
        .select("*")
        .order("publish_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (brand) query = query.eq("brand_id", brand);
      if (owner) query = query.eq("owner_id", owner);
      if (priority) query = query.eq("priority", priority as ContentPriority);

      // `publish_date` es una columna `date`, así que la igualdad contra un día
      // suelto es exacta y no hace falta ningún rango.
      if (diaExacto) query = query.eq("publish_date", diaExacto);
      else if (mesExacto) {
        const { gte, lte } = rangoDelMes(mesExacto);
        query = query.gte("publish_date", gte).lte("publish_date", lte);
      } else if (filtroFecha) {
        const rango = rangoFiltroFecha(filtroFecha);
        if (rango.esNulo) query = query.is("publish_date", null);
        if (rango.lt) query = query.lt("publish_date", rango.lt);
        if (rango.gte) query = query.gte("publish_date", rango.gte);
        if (rango.lte) query = query.lte("publish_date", rango.lte);
      }

      return query;
    })(),
  ]);

  const { data: piezasCrudas } = piecesQuery;

  // Las piezas de un Hero archivado se esconden, no se borran: el trabajo que
  // se le hizo sigue existiendo y hay que poder consultarlo. Por eso el filtro
  // es una casilla y no una desaparición definitiva.
  //
  // Va en memoria y no como `.in("brand_id", ...)` en la query: la lista de
  // Heroes ya vino completa en la misma tanda de consultas, y meter un `in`
  // con todos los ids activos crecería con cada cliente nuevo.
  const archivedHeroIds = new Set(
    (agencyClients ?? []).filter((c) => c.archived).map((c) => c.id)
  );
  const visibles = verArchivados
    ? piezasCrudas ?? []
    : (piezasCrudas ?? []).filter((p) => !archivedHeroIds.has(p.brand_id));

  // "Atrasadas" significa "se pasó la fecha y TODAVÍA no salió", no "la fecha
  // ya pasó". Sin esta parte, el filtro devolvía las publicadas del mes pasado
  // —que no están atrasadas: están hechas— y daba un número distinto al del KPI
  // "Piezas atrasadas" del Dashboard, que sí descuenta las publicadas.
  //
  // Va en memoria y no en la query porque los ids de las columnas llegan en la
  // misma tanda de consultas: pedirlos antes para poder filtrar en SQL
  // convertiría dos consultas paralelas en dos en serie.
  //
  // Los otros presets no lo necesitan: "publica este mes" es una pregunta sobre
  // el mes entero y sí incluye lo que ya salió.
  const doneColumnIds = new Set((columns ?? []).filter((c) => c.is_done).map((c) => c.id));
  const contentPieces =
    filtroFecha === "atrasadas" ? visibles.filter((p) => !doneColumnIds.has(p.column_id)) : visibles;

  const staffIds = (staffMembers ?? []).map((s) => s.profile_id);
  const { data: staffAccountProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", staffIds)
    : { data: [] };
  const staffProfileById = new Map((staffAccountProfiles ?? []).map((p) => [p.id, p]));

  // Los archivados salen del selector de Hero y del "Nueva pieza": no se le
  // carga trabajo nuevo a un cliente que se fue. Con la casilla prendida
  // vuelven, o no se podría filtrar por el Hero cuyas piezas se está mirando.
  const brands = (agencyClients ?? [])
    .filter((c) => verArchivados || !c.archived)
    .map((c) => ({
      id: c.id,
      name: c.archived ? `${c.name} (archivado)` : c.name,
      logoUrl: c.logo_url,
      driveUrl: c.drive_url,
    }));
  const staff = (staffMembers ?? []).map((s) => ({
    id: s.profile_id,
    name: staffProfileById.get(s.profile_id)?.display_name ?? "Sin nombre",
    role: STAFF_ROLE_LABEL[s.staff_role],
    color: s.color,
    avatarUrl: staffProfileById.get(s.profile_id)?.avatar_url ?? null,
  }));

  // El contador ya NO se calcula acá: desde que hay un buscador que filtra en el
  // navegador, un número del servidor quedaría viejo con cada tecla. Lo cuenta
  // KanbanBoard, que es quien sabe qué tarjetas hay realmente en pantalla.
  return (
    // pipeWide le saca al contenido el max-width de 1400px y casi todo el
    // padding (ver .main:has(.pipeWide) en qos.module.css). El Kanban es la
    // única pantalla donde el ancho ES la funcionalidad: cada columna que entra
    // sin scrollear es una etapa menos que hay que ir a buscar.
    <div className={styles.pipeWide}>
      {/* Los filtros los renderiza KanbanBoard y no esta página: así el botón
          "Nueva pieza" —que necesita su estado— puede compartir fila con las
          pestañas, y la barra entra en dos líneas en vez de tres. */}
      <KanbanBoard
        pieces={contentPieces}
        columns={columns ?? []}
        seccion={seccionActiva}
        brands={brands}
        staff={staff}
        filtros={{
          brand,
          owner,
          priority,
          fecha: filtroFecha,
          dia: diaExacto,
          mes: mesExacto,
          verArchivados,
          hayArchivados: archivedHeroIds.size > 0,
        }}
        busquedaInicial={q ?? ""}
      />
    </div>
  );
}
