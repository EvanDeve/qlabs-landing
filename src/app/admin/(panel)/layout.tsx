import { requireRole } from "@/lib/auth/require-role";
import { areasDelRol } from "@/lib/auth/areas";
import QosShell, { type QosNavItem } from "@/components/ugc/QosShell";
import Toaster from "@/components/ugc/Toaster";
import SelectorDeMes from "@/components/ugc/admin/SelectorDeMes";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import { diaLargo } from "@/lib/ugc/calendar";
import styles from "@/styles/qos.module.css";

// Q·OS dejó de colgar de /ugc, así que este es ahora el único layout que corre
// sobre el panel del equipo: el Toaster y el force-dynamic los ponía el layout
// compartido de /ugc/(dashboard), que quedó del otro lado de la mudanza.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, supabase } = await requireRole("admin");

  const [{ data: notifications }, { data: profile }, { data: staffMember }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
    supabase.from("staff_members").select("staff_role, active").eq("profile_id", user.id).maybeSingle(),
  ]);

  // Qué mitad del panel ve cada quien: la agencia, lo de UGC, o las dos (el
  // director). Esto solo arma el menú — quien pegue la URL igual rebota
  // (requireArea / requireDirector) y la RLS no le devuelve las filas.
  const areas = areasDelRol(staffMember);
  const { director } = areas;

  // Los contadores solo se piden si su item se va a mostrar: para quien no lo
  // ve, la consulta sería trabajo tirado a la basura (y a alguien de UGC la
  // RLS ya no le devolvería las piezas).
  // El Pipeline no es un área: lo ve quien esté en al menos un board (la RLS
  // devuelve solo esos; al director, todos). Puede faltarle a alguien de la
  // agencia y tenerlo alguien de UGC.
  const { count: boardsVisibles } = await supabase
    .from("pipeline_boards")
    .select("id", { count: "exact", head: true });
  const tienePipeline = (boardsVisibles ?? 0) > 0;

  const contarUgc = (q: PromiseLike<{ count: number | null }>) =>
    areas.ugc ? q.then((r) => r.count ?? 0) : Promise.resolve(0);

  const [
    { data: activePieces },
    { data: heroes },
    { count: disputasAbiertas },
    creadoresPorVerificar,
    marcasPorVerificar,
    eliminacionesPendientes,
  ] = await Promise.all([
    tienePipeline
      ? // Piezas activas = las que NO están en una columna marcada como
        // "publicadas". Se pregunta por la bandera y no por el nombre: el
        // equipo puede renombrar sus columnas.
        supabase
          .from("content_pieces")
          .select("id, brand_id, content_columns!inner(is_done)")
          .eq("content_columns.is_done", false)
      : { data: [] },
    areas.agencia ? supabase.from("agency_clients").select("id, archived") : { data: [] },
    // Las disputas van con contador en el nav: si nadie las ve, quedan
    // abiertas indefinidamente y ese es justo el problema que vinieron a
    // resolver.
    areas.ugc
      ? supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "disputed")
      : { count: 0 },
    // Marketplace y Close Friends cuentan lo que espera a alguien del equipo:
    // cuentas por verificar (sin verificar nadie opera) y pedidos de borrar
    // una cuenta (con plazo legal). No cuentan totales: eso no pide nada.
    contarUgc(
      supabase
        .from("creator_profiles")
        .select("profile_id", { count: "exact", head: true })
        .eq("verified", false)
        .is("rejected_at", null)
    ),
    contarUgc(
      supabase
        .from("brand_profiles")
        .select("profile_id", { count: "exact", head: true })
        .eq("verified", false)
        .is("rejected_at", null)
    ),
    contarUgc(
      supabase
        .from("member_deletion_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente")
    ),
  ]);

  // Los dos contadores del menú ignoran a los Heroes archivados: el badge de
  // Pipeline tiene que coincidir con lo que se ve al abrirlo, y el de Heroes
  // con la lista de activos. Un badge que cuenta de más es un badge que el
  // equipo deja de mirar.
  const archivedHeroIds = new Set((heroes ?? []).filter((h) => h.archived).map((h) => h.id));
  const heroesActivos = (heroes ?? []).filter((h) => !h.archived);
  // Una tarjeta sin Hero nunca es de un Hero archivado: es interna y se queda.
  const piezasActivas = (activePieces ?? []).filter((p) => !p.brand_id || !archivedHeroIds.has(p.brand_id));

  const itemPipeline = (group: string): QosNavItem[] =>
    tienePipeline
      ? [{ href: "/admin/pipeline", label: "Pipeline", icon: "columns", group, count: piezasActivas.length }]
      : [];

  const navAgencia: QosNavItem[] = [
    // La fecha de hoy en Costa Rica, como eyebrow: el Dashboard es la pantalla
    // del presente y "viernes 18 de septiembre" dice más que "Operación".
    { href: "/admin", label: "Dashboard", icon: "grid", group: "Operación", eyebrow: diaLargo(new Date()) },
    ...itemPipeline("Operación"),
    { href: "/admin/calendario", label: "Calendario", icon: "calendar", group: "Operación" },

    // Va pegada al Calendario y antes de Heroes: los items de un mismo grupo
    // tienen que ir seguidos en el array, porque QosShell abre un grupo nuevo
    // cada vez que cambia el valor de `group`.
    { href: "/admin/cronogramas", label: "Cronogramas", icon: "book", group: "Operación" },
    { href: "/admin/heroes", label: "Heroes", icon: "users", group: "Operación", count: heroesActivos.length },

    // Misma herramienta que la del creador, sobre el material propio del
    // equipo. No da acceso a las transcripciones de los creadores: la policy
    // filtra por `creator_id = auth.uid()` para todos por igual.
    { href: "/admin/transcripcion", label: "Transcripción", icon: "doc", group: "Herramientas" },

    // El otro extremo del mismo flujo: Transcripción convierte video en guion,
    // Voz convierte ese guion en audio. Van juntas porque se usan seguidas.
    { href: "/admin/voz", label: "Voz", icon: "play", group: "Herramientas" },
  ];

  // Lo del marketplace era parte de Sistema (solo directores) hasta que
  // existió el rol UGC: ahora es su propio grupo.
  const navUgc: QosNavItem[] = [
    // `eyebrow` con la fecha solo si es la primera pantalla del menú: para el
    // director, el Dashboard de la agencia ya la lleva.
    {
      href: "/admin/ugc",
      label: "Resumen",
      icon: "grid",
      group: "UGC",
      ...(areas.agencia ? {} : { eyebrow: diaLargo(new Date()) }),
    },
    // Alguien de UGC que está en un board: el Pipeline va con lo suyo. (Al
    // director ya le aparece en Operación.)
    ...(areas.agencia ? [] : itemPipeline("UGC")),
    {
      href: "/admin/marketplace",
      label: "Marketplace",
      icon: "megaphone",
      group: "UGC",
      count: creadoresPorVerificar + marcasPorVerificar,
    },
    { href: "/admin/loyalty", label: "Loyalty Loop", icon: "book", group: "UGC" },
    {
      href: "/admin/close-friends",
      label: "Close Friends",
      icon: "qr",
      group: "UGC",
      count: eliminacionesPendientes,
    },
    {
      href: "/admin/disputas",
      label: "Disputas",
      icon: "megaphone",
      group: "UGC",
      count: disputasAbiertas ?? 0,
    },
  ];

  const navItems: QosNavItem[] = [
    ...(areas.agencia ? navAgencia : []),
    ...(areas.ugc ? navUgc : []),

    // No va en el menú: se entra tocando la propia cara en el pie de la
    // sidebar. Está en la lista para que el título de la barra diga "Mi perfil"
    // y no herede "Dashboard" por prefijo.
    { href: "/admin/perfil", label: "Mi perfil", icon: "users", group: "Cuenta", hidden: true },

    // Los grupos del sidebar se cortan por orden del array: todo lo de
    // "Sistema" va junto y al final, o aparecería un segundo encabezado
    // "Sistema" más abajo.
    ...(director
      ? ([
          { href: "/admin/equipo", label: "Equipo", icon: "briefcase", group: "Sistema" },
          // Hija del Pipeline: se entra desde "+ Boards" en sus pestañas.
          {
            href: "/admin/pipeline/boards",
            label: "Boards",
            icon: "columns",
            group: "Sistema",
            hidden: true,
            parentHref: "/admin/pipeline",
          },
          // McLovin lleva la chispa y no el globo de chat: el globo ahora es
          // del Chat, y dos items pegados con el mismo icono no se distinguen.
          { href: "/admin/mclovin", label: "McLovin", icon: "sparkle", group: "Sistema" },
          { href: "/admin/chat", label: "Chat", icon: "chat", group: "Sistema" },
        ] satisfies QosNavItem[])
      : []),
  ];

  return (
    <Toaster>
      {/* `temaQos` es el look monocromo del panel del equipo (sidebar carbón,
          botón primario negro, tarjetas sin sombra). Va acá y no en QosShell
          porque el shell y el CSS module los comparten los paneles del
          marketplace, que siguen con el violeta y los pills de la marca.
          Mismo patrón que `fuenteMarketplace` en el layout de /ugc. */}
      <div className={styles.temaQos}>
        <QosShell
          navItems={navItems}
          notifications={notifications ?? []}
          userName={profile?.display_name ?? "Sin nombre"}
          userAvatarUrl={profile?.avatar_url ?? null}
          profileHref="/admin/perfil"
          userRole={staffMember ? STAFF_ROLE_LABEL[staffMember.staff_role] : "Admin"}
          topbarActions={areas.agencia ? <SelectorDeMes /> : undefined}
        >
          {children}
        </QosShell>
      </div>
    </Toaster>
  );
}
