import { requireRole } from "@/lib/auth/require-role";
import QosShell, { type QosNavItem } from "@/components/ugc/QosShell";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, supabase } = await requireRole("admin");

  const [{ data: notifications }, { data: profile }, { data: staffMember }, { data: activePieces }, { data: heroes }] =
    await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single(),
      supabase.from("staff_members").select("staff_role, active").eq("profile_id", user.id).maybeSingle(),
      // Piezas activas = las que NO están en una columna marcada como
      // "publicadas". Se pregunta por la bandera y no por el nombre: el equipo
      // puede renombrar sus columnas.
      supabase
        .from("content_pieces")
        .select("id, brand_id, content_columns!inner(is_done)")
        .eq("content_columns.is_done", false),
      supabase.from("agency_clients").select("id, archived"),
    ]);

  // Los dos contadores del menú ignoran a los Heroes archivados: el badge de
  // Pipeline tiene que coincidir con lo que se ve al abrirlo, y el de Heroes
  // con la lista de activos. Un badge que cuenta de más es un badge que el
  // equipo deja de mirar.
  const archivedHeroIds = new Set((heroes ?? []).filter((h) => h.archived).map((h) => h.id));
  const heroesActivos = (heroes ?? []).filter((h) => !h.archived);
  const piezasActivas = (activePieces ?? []).filter((p) => !archivedHeroIds.has(p.brand_id));

  // El grupo Sistema es solo de directores: ahí viven los teléfonos del
  // equipo, las conversaciones de WhatsApp y el cerebro del agente. Esto solo
  // arma el menú — quien pegue la URL igual rebota (requireDirector) y la RLS
  // no le devuelve las filas (is_director, migración 20260803000000).
  const director = staffMember?.staff_role === "director" && staffMember.active;

  // Las disputas van con contador en el nav: si nadie las ve, quedan abiertas
  // indefinidamente y ese es justo el problema que vinieron a resolver.
  // Solo se cuenta si el item se va a mostrar: para el resto del equipo la
  // consulta sería trabajo tirado a la basura.
  const { count: disputasAbiertas } = director
    ? await supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "disputed")
    : { count: 0 };

  const navItems: QosNavItem[] = [
    { href: "/ugc/admin", label: "Dashboard", icon: "grid", group: "Operación" },
    {
      href: "/ugc/admin/pipeline",
      label: "Pipeline",
      icon: "columns",
      group: "Operación",
      count: piezasActivas.length,
    },
    { href: "/ugc/admin/calendario", label: "Calendario", icon: "calendar", group: "Operación" },
    { href: "/ugc/admin/heroes", label: "Heroes", icon: "users", group: "Operación", count: heroesActivos.length },

    // Misma herramienta que la del creador, sobre el material propio del
    // equipo. No da acceso a las transcripciones de los creadores: la policy
    // filtra por `creator_id = auth.uid()` para todos por igual.
    { href: "/ugc/admin/transcripcion", label: "Transcripción", icon: "doc", group: "Herramientas" },

    // El otro extremo del mismo flujo: Transcripción convierte video en guion,
    // Voz convierte ese guion en audio. Van juntas porque se usan seguidas.
    { href: "/ugc/admin/voz", label: "Voz", icon: "play", group: "Herramientas" },

    // No va en el menú: se entra tocando la propia cara en el pie de la
    // sidebar. Está en la lista para que el título de la barra diga "Mi perfil"
    // y no herede "Dashboard" por prefijo.
    { href: "/ugc/admin/perfil", label: "Mi perfil", icon: "users", group: "Herramientas", hidden: true },

    // Los grupos del sidebar se cortan por orden del array: todo lo de
    // "Sistema" va junto y al final, o aparecería un segundo encabezado
    // "Sistema" más abajo.
    ...(director
      ? ([
          { href: "/ugc/admin/equipo", label: "Equipo", icon: "briefcase", group: "Sistema" },
          // McLovin lleva la chispa y no el globo de chat: el globo ahora es
          // del Chat, y dos items pegados con el mismo icono no se distinguen.
          { href: "/ugc/admin/mclovin", label: "McLovin", icon: "sparkle", group: "Sistema" },
          { href: "/ugc/admin/chat", label: "Chat", icon: "chat", group: "Sistema" },
          { href: "/ugc/admin/marketplace", label: "Marketplace", icon: "megaphone", group: "Sistema" },
          {
            href: "/ugc/admin/disputas",
            label: "Disputas",
            icon: "megaphone",
            group: "Sistema",
            count: disputasAbiertas ?? 0,
          },
        ] satisfies QosNavItem[])
      : []),
  ];

  return (
    <QosShell
      navItems={navItems}
      notifications={notifications ?? []}
      userName={profile?.display_name ?? "Sin nombre"}
      userAvatarUrl={profile?.avatar_url ?? null}
      profileHref="/ugc/admin/perfil"
      userRole={staffMember ? STAFF_ROLE_LABEL[staffMember.staff_role] : "Admin"}
    >
      {children}
    </QosShell>
  );
}
