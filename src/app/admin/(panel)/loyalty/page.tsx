import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import { estadoDeNivel, labelAccion, fechaCorta, COLOR_NIVEL, type Nivel } from "@/lib/ugc/loyalty";
import { coincide, leerEstado, rutaFichaCreador } from "@/lib/ugc/marketplace-admin";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { FiltroAdmin, PestanasAdmin, TarjetaLista } from "@/components/ugc/admin/PestanasAdmin";
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

/**
 * Loyalty Loop desde adentro.
 *
 * El punto de esta pantalla no es administrar nada —no hay un botón para
 * regalar puntos y no debería haberlo— sino poder responder dos preguntas
 * cuando alguien escribe: "¿por qué tengo estos puntos?" y "¿este canje entró?".
 * Por eso todo lo que se ve es lectura del ledger y del registro de canjes.
 */
export default async function AdminLoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; estado?: string }>;
}) {
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
      .select("creator_id, action, points, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("level_thresholds").select("*").order("min_points"),
    contarCanjes(),
    contarCanjes("canjeado"),
    contarCanjes("reclamado"),
  ]);

  const escalera: Nivel[] = umbrales ?? [{ level: 1, name: "Bronce", min_points: 0 }];
  const lista = eventos ?? [];

  // El total y el último evento de cada creador se arman de una sola pasada
  // sobre el ledger. Los eventos ya vienen ordenados por fecha, así que el
  // primero que aparece de cada creador ES el último que ocurrió.
  const porCreador = new Map<
    string,
    { total: number; ultimaAccion: string; ultimaFecha: string; eventos: number }
  >();
  for (const e of lista) {
    const actual = porCreador.get(e.creator_id);
    if (actual) {
      actual.total += e.points;
      actual.eventos += 1;
    } else {
      porCreador.set(e.creator_id, {
        total: e.points,
        ultimaAccion: e.action,
        ultimaFecha: e.created_at,
        eventos: 1,
      });
    }
  }

  const kpis = [
    { label: "Creadores con puntos", value: porCreador.size, icon: "users", color: "#6d54f3" },
    {
      label: "Puntos otorgados",
      value: lista.reduce((s, e) => s + e.points, 0).toLocaleString("es-CR"),
      icon: "sparkle",
      color: "#c07414",
    },
    { label: "Canjes confirmados", value: canjeados, icon: "check", color: "#14a06a" },
    { label: "Reclamos vigentes", value: reclamados, icon: "clock", color: "#7d8794" },
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
      <p style={{ color: "var(--ink-2)", marginBottom: "24px", maxWidth: "70ch" }}>
        Todos los creadores con puntos, su nivel y su actividad. El ledger es la fuente de verdad: el nivel se
        calcula, nunca se edita.
      </p>

      <div className={styles.kpiRow} style={{ marginBottom: 26 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={styles.kpi}>
            <div className={styles.kTop}>
              <div className={styles.kIc} style={{ background: `${kpi.color}22`, color: kpi.color }}>
                <QosIcon name={kpi.icon} size={16} />
              </div>
              <div className={styles.kLabel}>{kpi.label}</div>
            </div>
            <div className={styles.kNum} style={{ color: kpi.color }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

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

      {tab === "creadores" ? (
        <TablaCreadores
          supabase={supabase}
          porCreador={porCreador}
          escalera={escalera}
          q={q}
          nivel={estado ? Number(estado) : null}
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
}: {
  supabase: Supabase;
  porCreador: Map<string, { total: number; ultimaAccion: string; ultimaFecha: string }>;
  escalera: Nivel[];
  q: string;
  nivel: number | null;
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
    .map(([id, datos]) => {
      const { actual } = estadoDeNivel(datos.total, escalera);
      return {
        id,
        handle: handleDe.get(id) ?? "—",
        total: datos.total,
        nivel: actual?.name ?? "Bronce",
        nivelNum: actual?.level ?? 1,
        entregas: entregasDe.get(id) ?? 0,
        canjes: canjesDe.get(id) ?? 0,
        ultimo: `${labelAccion(datos.ultimaAccion)} · ${fechaCorta(datos.ultimaFecha)}`,
      };
    })
    .sort((a, b) => b.total - a.total);

  const filas = todas.filter((f) => (nivel === null || f.nivelNum === nivel) && coincide(q, [f.handle]));

  return (
    <TarjetaLista
      titulo="Creadores"
      mostrados={filas.length}
      total={todas.length}
      vacio="Todavía nadie sumó puntos."
    >
      <div style={{ overflowX: "auto" }}>
        <table className={styles.acctTable}>
          <thead>
            <tr>
              <th>Creador</th>
              <th>Nivel</th>
              <th style={{ textAlign: "right" }}>Puntos</th>
              <th style={{ textAlign: "right" }}>Entregas</th>
              <th style={{ textAlign: "right" }}>Canjes</th>
              <th>Último evento</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link href={rutaFichaCreador(f.id)} className={styles.fichaLink}>
                    <b>{f.handle}</b>
                  </Link>
                </td>
                <td>
                  <span
                    className={styles.riskPill}
                    style={{
                      background: `${COLOR_NIVEL[f.nivelNum] ?? "#7d8794"}22`,
                      color: COLOR_NIVEL[f.nivelNum] ?? "#7d8794",
                    }}
                  >
                    {f.nivel.toUpperCase()}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <b>{f.total.toLocaleString("es-CR")}</b>
                </td>
                <td style={{ textAlign: "right" }}>{f.entregas}</td>
                <td style={{ textAlign: "right" }}>{f.canjes}</td>
                <td style={{ color: "var(--ink-2)" }}>{f.ultimo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TarjetaLista>
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

  return (
    <TarjetaLista
      titulo="Canjes"
      mostrados={filas.length}
      total={totalGeneral}
      vacio="Todavía nadie reclamó un cupón."
    >
      <div style={{ overflowX: "auto" }}>
        <table className={styles.acctTable}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Marca</th>
              <th>Cupón</th>
              <th>Quién</th>
              <th>Código</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => {
              const est = estiloDe.get(r.status);
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                    {fechaCorta(r.redeemed_at ?? r.claimed_at)}
                  </td>
                  <td>{r.marca}</td>
                  <td>{r.cupon}</td>
                  <td>
                    {r.creator_id ? (
                      <Link href={rutaFichaCreador(r.creator_id)} className={styles.fichaLink}>
                        <b>{r.quien}</b>
                      </Link>
                    ) : (
                      <b>{r.quien}</b>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{r.code}</td>
                  <td>
                    <span className={`${styles.riskPill} ${est?.clase ?? ""}`}>{est?.label ?? r.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalDelEstado > canjes.length && (
        <div className={styles.attnMeta} style={{ paddingTop: 12 }}>
          Se muestran los {MAX_CANJES} más recientes de {totalDelEstado}. Filtrá por estado para ver los
          anteriores.
        </div>
      )}
    </TarjetaLista>
  );
}
