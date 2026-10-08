import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import { estadoDeNivel, labelAccion, fechaCorta, COLOR_NIVEL, type Nivel } from "@/lib/ugc/loyalty";
import { desglosePuntos, type EventoPuntos } from "@/lib/ugc/loyalty-desglose";
import { coincide, iniciales, leerEstado, rutaFichaCreador } from "@/lib/ugc/marketplace-admin";
import { displayHandle } from "@/lib/ugc/handles";
import { BarraAdmin, FiltroAdmin, PestanasAdmin } from "@/components/ugc/admin/PestanasAdmin";
import { CF } from "@/lib/cf/copy";
import type { RedemptionStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

const BASE = "/admin/loyalty";
const PESTANAS = ["creadores", "canjes"] as const;

/** Tope de canjes por pantalla. Antes eran los últimos 60. */
const MAX_CANJES = 200;

const ESTADOS_CANJE: { id: RedemptionStatus; label: string; clase: string }[] = [
  { id: "reclamado", label: "Reclamado", clase: styles.riskWarn },
  { id: "canjeado", label: "Canjeado", clase: styles.riskOk },
  { id: "expirado", label: "Expirado", clase: styles.riskMuted },
];

type Params = { tab?: string; q?: string; estado?: string; creador?: string };

/**
 * Loyalty Loop desde adentro (mockup 1d).
 *
 * El punto de esta pantalla no es administrar nada —no hay un botón para
 * regalar puntos y no debería haberlo— sino poder responder dos preguntas
 * cuando alguien escribe: "¿por qué tengo estos puntos?" y "¿este canje entró?".
 * Por eso todo es lectura del ledger y del registro de canjes, y el porqué de
 * los puntos del creador elegido va al lado de la tabla.
 */
export default async function AdminLoyaltyPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireArea("ugc");
  const params = await searchParams;
  const tab = leerEstado(params.tab, PESTANAS) ?? "creadores";
  const q = (params.q ?? "").trim();

  // Los números de arriba cuentan en la base: antes salían de los últimos 60
  // canjes y con más que eso se quedaban cortos sin avisar.
  const contar = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);
  const contarCanjes = (estado?: RedemptionStatus) => {
    const base = supabase.from("redemptions").select("id", { count: "exact", head: true });
    return contar(estado ? base.eq("status", estado) : base);
  };

  const [{ data: eventos }, { data: umbrales }, totalCanjes, canjeados, reclamados] = await Promise.all([
    supabase
      .from("points_events")
      .select("creator_id, action, points, created_at, reference_type, reference_id")
      .order("created_at", { ascending: false }),
    supabase.from("level_thresholds").select("*").order("min_points"),
    contarCanjes(),
    contarCanjes("canjeado"),
    contarCanjes("reclamado"),
  ]);

  const escalera: Nivel[] = umbrales ?? [{ level: 1, name: "Bronce", min_points: 0 }];
  const lista = eventos ?? [];

  // El ledger de cada creador, de una sola pasada. Los eventos ya vienen
  // ordenados por fecha, así que el primero de cada creador es el último que
  // ocurrió.
  const porCreador = new Map<string, EventoPuntos[]>();
  for (const e of lista) porCreador.set(e.creator_id, [...(porCreador.get(e.creator_id) ?? []), e]);

  const stats = [
    { label: "Creadores con puntos", value: porCreador.size.toLocaleString("es-CR") },
    { label: "Puntos otorgados", value: lista.reduce((s, e) => s + e.points, 0).toLocaleString("es-CR") },
    { label: "Canjes confirmados", value: canjeados.toLocaleString("es-CR") },
    { label: "Reclamos vigentes", value: reclamados.toLocaleString("es-CR") },
  ];

  const opciones =
    tab === "creadores"
      ? escalera.map((n) => ({ id: String(n.level), label: n.name }))
      : ESTADOS_CANJE.map((e) => ({ id: e.id, label: e.label }));
  const estado = leerEstado(
    params.estado,
    opciones.map((o) => o.id),
  );

  return (
    <div>
      <p className={styles.bajada}>
        Solo consulta: los puntos salen del historial y el nivel se calcula, nunca se edita.
      </p>

      <div className={`${styles.statCard} ${styles.statCardGrupo}`} style={{ paddingTop: 8, marginBottom: 16 }}>
        <div className={styles.statRow}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statNum}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <BarraAdmin>
        <PestanasAdmin
          base={BASE}
          label="Secciones de Loyalty Loop"
          activa={tab}
          pestanas={[
            { id: "creadores", label: "Creadores", count: porCreador.size },
            {
              id: "canjes",
              label: "Canjes",
              count: totalCanjes,
              aviso: { n: reclamados, texto: "sin canjear" },
            },
          ]}
        />
        <FiltroAdmin
          base={BASE}
          tab={tab}
          q={q}
          placeholder={tab === "creadores" ? "Handle del creador" : "Marca, cupón, creador o código"}
          estado={estado}
          opciones={opciones}
          todos={tab === "creadores" ? "Todos los niveles" : "Todos los estados"}
        />
      </BarraAdmin>

      {tab === "creadores" ? (
        <TablaCreadores
          supabase={supabase}
          porCreador={porCreador}
          escalera={escalera}
          q={q}
          nivel={estado ? Number(estado) : null}
          elegido={params.creador}
        />
      ) : (
        <TablaCanjes
          supabase={supabase}
          q={q}
          estado={estado as RedemptionStatus | null}
          totalGeneral={totalCanjes}
        />
      )}
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof requireArea>>["supabase"];

async function TablaCreadores({
  supabase,
  porCreador,
  escalera,
  q,
  nivel,
  elegido,
}: {
  supabase: Supabase;
  porCreador: Map<string, EventoPuntos[]>;
  escalera: Nivel[];
  q: string;
  nivel: number | null;
  elegido?: string;
}) {
  const creatorIds = [...porCreador.keys()];
  const [{ data: creadores }, { data: aprobadas }, { data: canjeados }] = await Promise.all([
    creatorIds.length
      ? supabase.from("creator_public_profiles").select("profile_id, handle").in("profile_id", creatorIds)
      : Promise.resolve({ data: [] as { profile_id: string; handle: string }[] }),
    supabase.from("applications").select("creator_id").eq("status", "approved"),
    // Los canjes de miembros de Close Friends no suman a ningún creador.
    supabase.from("redemptions").select("creator_id").eq("status", "canjeado").not("creator_id", "is", null),
  ]);

  const handleDe = new Map((creadores ?? []).map((c) => [c.profile_id, c.handle]));
  const sumar = (filas: { creator_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const f of filas ?? []) if (f.creator_id) m.set(f.creator_id, (m.get(f.creator_id) ?? 0) + 1);
    return m;
  };
  const entregasDe = sumar(aprobadas);
  const canjesDe = sumar(canjeados);

  const todas = [...porCreador.entries()]
    .map(([id, evs]) => {
      const total = evs.reduce((n, e) => n + e.points, 0);
      const nivelDe = estadoDeNivel(total, escalera);
      return {
        id,
        handle: handleDe.get(id) ?? "—",
        total,
        nivel: nivelDe,
        entregas: entregasDe.get(id) ?? 0,
        canjes: canjesDe.get(id) ?? 0,
        ultimo: `${labelAccion(evs[0].action)} · ${fechaCorta(evs[0].created_at)}`,
      };
    })
    .sort((a, b) => b.total - a.total);

  const filas = todas.filter(
    (f) => (nivel === null || f.nivel.actual?.level === nivel) && coincide(q, [f.handle]),
  );

  if (filas.length === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        {todas.length === 0 ? "Todavía nadie sumó puntos." : "Nada coincide con ese filtro."}
      </div>
    );
  }

  // El panel muestra al elegido por la URL; si no hay (o quedó afuera del
  // filtro), al primero de la lista, que es el de más puntos.
  const sel = filas.find((f) => f.id === elegido) ?? filas[0];

  // Las campañas de las aplicaciones que dieron puntos al elegido: con eso el
  // desglose dice "Brunch de fin de semana · 26 ago" en vez de solo la fecha.
  const evSel = porCreador.get(sel.id) ?? [];
  const appIds = [
    ...new Set(
      evSel.flatMap((e) => (e.reference_type === "application" && e.reference_id ? [e.reference_id] : [])),
    ),
  ];
  const { data: apps } = appIds.length
    ? await supabase.from("applications").select("id, campaign_id").in("id", appIds)
    : { data: [] as { id: string; campaign_id: string }[] };
  const campIds = [...new Set((apps ?? []).map((a) => a.campaign_id))];
  const { data: camps } = campIds.length
    ? await supabase.from("campaigns").select("id, title").in("id", campIds)
    : { data: [] as { id: string; title: string }[] };
  const tituloDe = new Map((camps ?? []).map((c) => [c.id, c.title]));
  const campanaDeAplicacion = new Map(
    (apps ?? []).flatMap((a) => (tituloDe.get(a.campaign_id) ? [[a.id, tituloDe.get(a.campaign_id)!]] : [])),
  );
  const desglose = desglosePuntos(evSel, campanaDeAplicacion);

  // El link de cada fila conserva la búsqueda y el nivel.
  const hrefFila = (id: string) => {
    const u = new URLSearchParams({ tab: "creadores", creador: id });
    if (q) u.set("q", q);
    if (nivel !== null) u.set("estado", String(nivel));
    return `${BASE}?${u.toString()}`;
  };

  const nivelSel = sel.nivel;
  const colorSel = COLOR_NIVEL[nivelSel.actual?.level ?? 1] ?? "#7d8794";

  return (
    <div className={styles.loyGrid}>
      <div className={styles.card}>
        <table className={styles.tablaLista}>
          <thead>
            <tr>
              <th>Creador</th>
              <th>Nivel</th>
              <th className={styles.numCelda}>Puntos</th>
              <th className={`${styles.numCelda} ${styles.colEscritorio}`}>Entregas</th>
              <th className={`${styles.numCelda} ${styles.colEscritorio}`}>Canjes</th>
              <th className={styles.colEscritorio}>Último evento</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const color = COLOR_NIVEL[f.nivel.actual?.level ?? 1] ?? "#7d8794";
              return (
                <tr key={f.id} className={f.id === sel.id ? styles.filaResaltada : undefined}>
                  <td>
                    <Link href={hrefFila(f.id)} scroll={false} className={styles.celdaNombre}>
                      <b className={styles.fichaLinkTxt}>{displayHandle(f.handle)}</b>
                    </Link>
                  </td>
                  <td>
                    <span className={styles.riskPill} style={{ background: `${color}1f`, color }}>
                      {f.nivel.actual?.name ?? "Bronce"}
                    </span>
                  </td>
                  <td className={styles.numCelda}>
                    <b>{f.total.toLocaleString("es-CR")}</b>
                  </td>
                  <td className={`${styles.numCelda} ${styles.colEscritorio}`}>{f.entregas}</td>
                  <td className={`${styles.numCelda} ${styles.colEscritorio}`}>{f.canjes}</td>
                  <td className={styles.colEscritorio} style={{ color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                    {f.ultimo}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <aside className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.loyPanelHead}>
          <span className={styles.esperaAv}>{iniciales(sel.handle)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.esperaT}>{displayHandle(sel.handle)}</div>
            <div className={styles.esperaS} style={{ whiteSpace: "normal" }}>
              {nivelSel.actual?.name ?? "Bronce"} ·{" "}
              {nivelSel.siguiente
                ? `faltan ${nivelSel.faltan.toLocaleString("es-CR")} pts para ${nivelSel.siguiente.name}`
                : "el nivel más alto"}
            </div>
          </div>
          <Link href={rutaFichaCreador(sel.id)} className={styles.linkAccent}>
            Ver ficha
          </Link>
        </div>
        <div className={styles.loyBarra}>
          <span style={{ width: `${Math.round(nivelSel.progreso)}%`, background: colorSel }} />
        </div>
        <div className={styles.fichaK} style={{ margin: "16px 0 4px" }}>
          De dónde salen sus {sel.total.toLocaleString("es-CR")} puntos
        </div>
        {desglose.map((g) => (
          <div key={g.label} className={styles.loyMotivo}>
            <div style={{ minWidth: 0 }}>
              <div className={styles.esperaT} style={g.prueba ? { color: "var(--ink-3)" } : undefined}>
                {g.label}
              </div>
              <div className={styles.esperaS}>{g.detalle}</div>
            </div>
            <b>
              {g.puntos > 0 ? "+" : ""}
              {g.puntos.toLocaleString("es-CR")}
            </b>
          </div>
        ))}
      </aside>
    </div>
  );
}

async function TablaCanjes({
  supabase,
  q,
  estado,
  totalGeneral,
}: {
  supabase: Supabase;
  q: string;
  estado: RedemptionStatus | null;
  totalGeneral: number;
}) {
  // El estado se filtra en la base: con el tope puesto, filtrar después
  // dejaría afuera los canjes viejos de ese estado.
  let consulta = supabase
    .from("redemptions")
    .select("id, coupon_id, creator_id, code, status, claimed_at, redeemed_at", { count: "exact" })
    .order("claimed_at", { ascending: false })
    .limit(MAX_CANJES);
  if (estado) consulta = consulta.eq("status", estado);
  const { data: reclamos, count } = await consulta;
  const canjes = reclamos ?? [];
  const totalDelEstado = count ?? canjes.length;

  const creatorIds = [...new Set(canjes.flatMap((r) => (r.creator_id ? [r.creator_id] : [])))];
  const couponIds = [...new Set(canjes.map((r) => r.coupon_id))];
  const [{ data: creadores }, { data: cupones }] = await Promise.all([
    creatorIds.length
      ? supabase.from("creator_public_profiles").select("profile_id, handle").in("profile_id", creatorIds)
      : Promise.resolve({ data: [] as { profile_id: string; handle: string }[] }),
    couponIds.length
      ? supabase.from("coupons").select("id, title, brand_id").in("id", couponIds)
      : Promise.resolve({ data: [] as { id: string; title: string; brand_id: string }[] }),
  ]);
  const brandIds = [...new Set((cupones ?? []).map((c) => c.brand_id))];
  const { data: marcas } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };

  const handleDe = new Map((creadores ?? []).map((c) => [c.profile_id, c.handle]));
  const cuponDe = new Map((cupones ?? []).map((c) => [c.id, c]));
  const marcaDe = new Map((marcas ?? []).map((m) => [m.profile_id, m.brand_name]));
  const estiloDe = new Map(ESTADOS_CANJE.map((e) => [e.id, e]));

  const filas = canjes
    .map((r) => {
      const cupon = cuponDe.get(r.coupon_id);
      return {
        ...r,
        cupon: cupon?.title ?? "—",
        marca: marcaDe.get(cupon?.brand_id ?? "") ?? "—",
        quien: r.creator_id ? (handleDe.get(r.creator_id) ?? "—") : CF.miembroCorto,
      };
    })
    .filter((f) => coincide(q, [f.marca, f.cupon, f.quien, f.code]));

  if (filas.length === 0) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        {totalGeneral === 0 ? "Todavía nadie reclamó un cupón." : "Nada coincide con ese filtro."}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <table className={styles.tablaLista}>
        <thead>
          <tr>
            <th>Cupón</th>
            <th className={styles.colEscritorio}>Marca</th>
            <th className={styles.colEscritorio}>Quién</th>
            <th className={styles.colEscritorio}>Código</th>
            <th className={styles.colEscritorio}>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((r) => {
            const est = estiloDe.get(r.status);
            const quien = r.creator_id ? (
              <Link href={rutaFichaCreador(r.creator_id)} className={styles.fichaLink}>
                <b>{displayHandle(r.quien)}</b>
              </Link>
            ) : (
              <b>{r.quien}</b>
            );
            return (
              <tr key={r.id}>
                <td>
                  <div className={styles.celdaNombre}>
                    <span style={{ minWidth: 0 }}>
                      <b>{r.cupon}</b>
                      <small className={styles.soloMovil}>
                        {r.marca} · {r.creator_id ? displayHandle(r.quien) : r.quien} ·{" "}
                        {fechaCorta(r.redeemed_at ?? r.claimed_at)}
                      </small>
                    </span>
                  </div>
                </td>
                <td className={styles.colEscritorio}>{r.marca}</td>
                <td className={styles.colEscritorio}>{quien}</td>
                <td
                  className={styles.colEscritorio}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                >
                  {r.code}
                </td>
                <td className={styles.colEscritorio} style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                  {fechaCorta(r.redeemed_at ?? r.claimed_at)}
                </td>
                <td>
                  <span className={`${styles.riskPill} ${est?.clase ?? ""}`}>{est?.label ?? r.status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(filas.length !== totalGeneral || totalDelEstado > canjes.length) && (
        <div className={styles.tablaPie}>
          {filas.length !== totalGeneral && `${filas.length} de ${totalGeneral} coinciden con el filtro. `}
          {totalDelEstado > canjes.length &&
            `Se muestran los ${MAX_CANJES} más recientes de ${totalDelEstado}. Filtrá por estado para ver los anteriores.`}
        </div>
      )}
    </div>
  );
}
