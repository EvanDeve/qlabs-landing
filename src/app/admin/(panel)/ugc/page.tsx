import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { estadoCuenta } from "@/lib/ugc/estado-cuenta";
import { displayHandle } from "@/lib/ugc/handles";
import { cargarCfPorNegocio } from "@/lib/cf/por-negocio";
import { CF } from "@/lib/cf/copy";
import { diasDesde, iniciales, rutaFichaCreador, textoDias } from "@/lib/ugc/marketplace-admin";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/** En el Resumen alcanza con los de arriba; la lista entera vive en Close Friends. */
const MAX_NEGOCIOS = 8;
/** Cuántas cosas de "Te esperan" se listan antes de cortar. */
const MAX_ESPERAN = 10;
/** Una solicitud de eliminación que pasa de esto se marca en rojo. */
const DIAS_ELIMINACION = 7;

type Espera = {
  key: string;
  desde: string;
  avatar: string;
  riesgo?: boolean;
  titulo: string;
  sub: string;
  chip: { texto: string; tono: "warn" | "risk" };
  accion: { label: string; href: string; primaria?: boolean };
};

/**
 * La primera pantalla del área UGC (mockup 1a): cuánto hay de cada cosa y qué
 * está esperando a alguien del equipo, lo más viejo primero. El detalle sigue
 * en Marketplace, Loyalty, Close Friends y Disputas.
 */
export default async function ResumenUgcPage() {
  const { supabase } = await requireArea("ugc");

  // Conteos con `head: true`: lo que importa es el número, y traer las filas
  // de todo el marketplace para contarlas en JS es egress tirado.
  const contar = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [
    { data: creadores },
    { data: marcas },
    campanasActivas,
    aplicacionesEnCurso,
    { data: disputas },
    miembrosActivos,
    canjeados,
    reclamados,
    { data: solicitudes },
    { negocios, vinculos },
  ] = await Promise.all([
    // Creadores y marcas sí vienen enteros (solo lo necesario): son pocos, y de
    // acá salen tanto los totales como la lista de pendientes.
    supabase.from("creator_profiles").select("profile_id, handle, followers_count, verified, rejected_at"),
    supabase
      .from("brand_profiles")
      .select("profile_id, brand_name, industry, location, verified, rejected_at"),
    contar(
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .in("status", ["published", "in_progress"]),
    ),
    contar(
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "reviewing", "accepted", "delivered"]),
    ),
    supabase
      .from("applications")
      .select("id, campaign_id, creator_id, conflict_by, conflict_at, status_changed_at")
      .eq("status", "disputed"),
    contar(
      supabase.from("members").select("profile_id", { count: "exact", head: true }).eq("status", "activo"),
    ),
    contar(
      supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("status", "canjeado"),
    ),
    contar(
      supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("status", "reclamado"),
    ),
    supabase.from("member_deletion_requests").select("id, member_id, created_at").eq("status", "pendiente"),
    cargarCfPorNegocio(supabase),
  ]);

  const listaCreadores = creadores ?? [];
  const listaMarcas = marcas ?? [];
  const listaDisputas = disputas ?? [];
  const listaSolicitudes = solicitudes ?? [];

  const creadoresPendientes = listaCreadores.filter((c) => estadoCuenta(c) === "pendiente");
  const marcasPendientes = listaMarcas.filter((m) => estadoCuenta(m) === "pendiente");
  const porVerificar = creadoresPendientes.length + marcasPendientes.length;

  // ---- Lo que hace falta para armar las filas de "Te esperan" ----
  // Las fichas de creador y de marca no tienen fecha propia: la del alta es la
  // de `profiles`, que trae también el nombre y la ciudad del creador.
  const idsPendientes = [...creadoresPendientes, ...marcasPendientes].map((p) => p.profile_id);
  const campaignIds = [...new Set(listaDisputas.map((d) => d.campaign_id))];
  const creadoresEnDisputa = [...new Set(listaDisputas.map((d) => d.creator_id))];
  const miembroIds = listaSolicitudes.flatMap((s) => (s.member_id ? [s.member_id] : []));

  const [{ data: perfiles }, { data: campanas }, { data: handles }, { data: miembros }] = await Promise.all([
    idsPendientes.length
      ? supabase.from("profiles").select("id, display_name, city, created_at").in("id", idsPendientes)
      : Promise.resolve({
          data: [] as { id: string; display_name: string | null; city: string | null; created_at: string }[],
        }),
    campaignIds.length
      ? supabase.from("campaigns").select("id, title, brand_id").in("id", campaignIds)
      : Promise.resolve({ data: [] as { id: string; title: string; brand_id: string }[] }),
    creadoresEnDisputa.length
      ? supabase.from("creator_profiles").select("profile_id, handle").in("profile_id", creadoresEnDisputa)
      : Promise.resolve({ data: [] as { profile_id: string; handle: string }[] }),
    miembroIds.length
      ? supabase.from("members").select("profile_id, agent_name").in("profile_id", miembroIds)
      : Promise.resolve({ data: [] as { profile_id: string; agent_name: string }[] }),
  ]);
  const brandIdsDisputa = [...new Set((campanas ?? []).map((c) => c.brand_id))];
  const { data: marcasDisputa } = brandIdsDisputa.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIdsDisputa)
    : { data: [] };

  const perfilDe = new Map((perfiles ?? []).map((p) => [p.id, p]));
  const campanaDe = new Map((campanas ?? []).map((c) => [c.id, c]));
  const handleDe = new Map((handles ?? []).map((h) => [h.profile_id, h.handle]));
  const marcaDe = new Map((marcasDisputa ?? []).map((m) => [m.profile_id, m.brand_name]));
  const agenteDe = new Map((miembros ?? []).map((m) => [m.profile_id, m.agent_name]));
  const negocioDe = new Map(negocios.map((n) => [n.id, n.nombre]));
  const negociosDelMiembro = (id: string | null) =>
    id
      ? vinculos
          .filter((v) => v.member_id === id)
          .map((v) => negocioDe.get(v.brand_id))
          .filter(Boolean)
          .join(", ")
      : "";

  const chipEspera = (desde: string) => {
    const dias = diasDesde(desde);
    return { texto: dias === 0 ? "hoy" : `${textoDias(dias)} esperando`, tono: "warn" as const };
  };

  const esperan: Espera[] = [
    ...creadoresPendientes.map((c): Espera => {
      const p = perfilDe.get(c.profile_id);
      const desde = p?.created_at ?? new Date().toISOString();
      return {
        key: `c-${c.profile_id}`,
        desde,
        avatar: iniciales(p?.display_name || c.handle),
        titulo: `Verificar a ${displayHandle(c.handle)}`,
        sub: ["Creador", p?.city, `${c.followers_count.toLocaleString("es-CR")} seguidores`]
          .filter(Boolean)
          .join(" · "),
        chip: chipEspera(desde),
        accion: { label: "Revisar", href: rutaFichaCreador(c.profile_id) },
      };
    }),
    ...marcasPendientes.map((m): Espera => {
      const desde = perfilDe.get(m.profile_id)?.created_at ?? new Date().toISOString();
      return {
        key: `m-${m.profile_id}`,
        desde,
        avatar: iniciales(m.brand_name),
        titulo: `Verificar a ${m.brand_name}`,
        sub: ["Marca", m.industry, m.location].filter(Boolean).join(" · "),
        chip: chipEspera(desde),
        accion: { label: "Revisar", href: "/admin/marketplace?tab=marcas&estado=pendiente" },
      };
    }),
    ...listaDisputas.map((d): Espera => {
      const c = campanaDe.get(d.campaign_id);
      const marca = c ? (marcaDe.get(c.brand_id) ?? "La marca") : "La marca";
      const handle = handleDe.get(d.creator_id);
      const creador = handle ? displayHandle(handle) : "el creador";
      return {
        key: `d-${d.id}`,
        desde: d.conflict_at ?? d.status_changed_at,
        avatar: "!",
        riesgo: true,
        titulo: `Resolver disputa · ${c?.title ?? "Campaña"}`,
        sub:
          d.conflict_by === d.creator_id
            ? `${creador} reportó un problema con ${marca}`
            : `${marca} reportó la entrega de ${creador}`,
        chip: { texto: "Pago en pausa", tono: "risk" },
        accion: { label: "Resolver", href: `/admin/disputas?caso=${d.id}`, primaria: true },
      };
    }),
    ...listaSolicitudes.map((s): Espera => {
      const agente = s.member_id ? agenteDe.get(s.member_id) : undefined;
      const dias = diasDesde(s.created_at);
      return {
        key: `e-${s.id}`,
        desde: s.created_at,
        avatar: iniciales(agente ?? "CF"),
        titulo: `Eliminar cuenta de ${agente ?? "un miembro"}`,
        sub: [CF.programa, negociosDelMiembro(s.member_id)].filter(Boolean).join(" · "),
        chip: { texto: textoDias(dias), tono: dias >= DIAS_ELIMINACION ? "risk" : "warn" },
        accion: { label: "Atender", href: "/admin/close-friends" },
      };
    }),
  ].sort((a, b) => a.desde.localeCompare(b.desde));

  const eliminacionesVencidas = listaSolicitudes.filter(
    (s) => diasDesde(s.created_at) >= DIAS_ELIMINACION,
  ).length;

  const grupos: {
    titulo: string;
    stats: { label: string; value: number; sub: string; punto?: "warn" | "risk" }[];
  }[] = [
    {
      titulo: "Marketplace",
      stats: [
        {
          label: "Creadores",
          value: listaCreadores.length,
          sub: `${listaCreadores.filter((c) => estadoCuenta(c) === "verificada").length} verificados`,
        },
        {
          label: "Marcas",
          value: listaMarcas.length,
          sub: `${listaMarcas.filter((m) => estadoCuenta(m) === "verificada").length} verificadas`,
        },
        {
          label: "Por verificar",
          value: porVerificar,
          sub: "esperando revisión",
          punto: porVerificar > 0 ? "warn" : undefined,
        },
        { label: "Campañas activas", value: campanasActivas, sub: "publicadas o en curso" },
      ],
    },
    {
      titulo: "Actividad",
      stats: [
        { label: "Aplicaciones", value: aplicacionesEnCurso, sub: "en curso" },
        {
          label: "Disputas",
          value: listaDisputas.length,
          sub: listaDisputas.length === 1 ? "abierta" : "abiertas",
          punto: listaDisputas.length > 0 ? "risk" : undefined,
        },
        { label: CF.programa, value: miembrosActivos, sub: "miembros activos" },
        { label: "Canjes", value: canjeados, sub: `${reclamados} sin canjear` },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className={styles.resGrid}>
        {grupos.map((g) => (
          <div key={g.titulo} className={`${styles.statCard} ${styles.statCardGrupo}`}>
            <div className={styles.statGrupo}>{g.titulo}</div>
            <div className={styles.statRow}>
              {g.stats.map((s) => (
                <div key={s.label} className={styles.stat}>
                  <div className={styles.statLabel}>
                    {s.punto && (
                      <span
                        className={styles.statPunto}
                        style={{ background: s.punto === "risk" ? "var(--risk)" : "var(--warn)" }}
                      />
                    )}
                    {s.label}
                  </div>
                  <div className={styles.statNum}>{s.value}</div>
                  <div className={styles.statSub}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={`${styles.resGrid} ${styles.resGridAncha}`} style={{ alignItems: "start" }}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.sectionHead}>
            <h2>Te esperan</h2>
            {esperan.length > 0 && (
              <span className={styles.sectionHeadNota}>
                {esperan.length} {esperan.length === 1 ? "pendiente" : "pendientes"} · lo más viejo primero
              </span>
            )}
          </div>
          {esperan.length === 0 ? (
            <p className={styles.attnMeta}>
              <QosIcon name="check" size={12} /> No hay nada esperando al equipo.
            </p>
          ) : (
            <>
              {esperan.slice(0, MAX_ESPERAN).map((e) => (
                <div key={e.key} className={styles.esperaFila}>
                  <span className={`${styles.esperaAv} ${e.riesgo ? styles.esperaAvRisk : ""}`}>
                    {e.avatar}
                  </span>
                  <div className={styles.esperaTxt}>
                    <div className={styles.esperaT}>{e.titulo}</div>
                    <div className={styles.esperaS}>{e.sub}</div>
                  </div>
                  <div className={styles.esperaFin}>
                    <span
                      className={`${styles.riskPill} ${e.chip.tono === "risk" ? styles.riskRisk : styles.riskWarn}`}
                    >
                      {e.chip.texto}
                    </span>
                    <Link
                      href={e.accion.href}
                      className={`${styles.btn} ${styles.btnSm} ${e.accion.primaria ? styles.btnPrimary : styles.btnGhost}`}
                    >
                      {e.accion.label}
                    </Link>
                  </div>
                </div>
              ))}
              {esperan.length > MAX_ESPERAN && (
                <p className={styles.attnMeta} style={{ paddingTop: 8 }}>
                  Y {esperan.length - MAX_ESPERAN} más.
                </p>
              )}
            </>
          )}
        </div>

        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.sectionHead}>
            <h2>{CF.programa} por negocio</h2>
            <Link href="/admin/close-friends" className={styles.linkAccent}>
              Ver todo
            </Link>
          </div>
          {negocios.length === 0 ? (
            <p className={styles.attnMeta}>Ningún negocio tiene QR ni miembros todavía.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className={`${styles.acctTable} ${styles.tablaCompacta}`}>
                <thead>
                  <tr>
                    <th>Negocio</th>
                    <th style={{ textAlign: "right" }}>Miembros</th>
                    <th style={{ textAlign: "right" }}>Escaneos</th>
                    <th style={{ textAlign: "right" }}>Registros</th>
                    <th style={{ textAlign: "right" }}>Canjes</th>
                  </tr>
                </thead>
                <tbody>
                  {negocios.slice(0, MAX_NEGOCIOS).map((n) => (
                    <tr key={n.id}>
                      <td>
                        <Link
                          href={`/admin/close-friends?negocio=${n.id}#miembros`}
                          className={styles.fichaLink}
                        >
                          <b>{n.nombre}</b>
                        </Link>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <b>{n.miembros}</b>
                      </td>
                      <td style={{ textAlign: "right" }}>{n.escaneos}</td>
                      <td style={{ textAlign: "right" }}>{n.registros}</td>
                      <td style={{ textAlign: "right" }}>{n.canjeados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {negocios.length > MAX_NEGOCIOS && (
                <p className={styles.attnMeta} style={{ paddingTop: 10 }}>
                  Los {MAX_NEGOCIOS} con más miembros de {negocios.length}.
                </p>
              )}
            </div>
          )}
          {/* Solo las que pasaron el plazo: las demás ya están en "Te esperan". */}
          {eliminacionesVencidas > 0 && (
            <div className={styles.avisoRisk}>
              <span className={styles.statPunto} style={{ background: "var(--risk)" }} />
              {eliminacionesVencidas === 1
                ? `1 solicitud de eliminación pasa de ${DIAS_ELIMINACION} días`
                : `${eliminacionesVencidas} solicitudes de eliminación pasan de ${DIAS_ELIMINACION} días`}
              <Link href="/admin/close-friends">Atender ›</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
