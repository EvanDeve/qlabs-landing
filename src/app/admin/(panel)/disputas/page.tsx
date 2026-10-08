import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import ResolveDisputeForm from "@/components/ugc/admin/ResolveDisputeForm";
import { BarraAdmin, FiltroAdmin, PestanasAdmin } from "@/components/ugc/admin/PestanasAdmin";
import { creatorPayout } from "@/lib/ugc/payout";
import { entregablesEnLinea } from "@/lib/ugc/deliverables";
import { displayHandle } from "@/lib/ugc/handles";
import { coincide, diasDesde, leerEstado, rutaFichaCreador, textoDias } from "@/lib/ugc/marketplace-admin";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

const BASE = "/admin/disputas";
const PESTANAS = ["abiertas", "resueltas"] as const;

// Una disputa se resuelve aprobando la entrega o cancelando la colaboración
// (resolveDisputeAction). La que se resolvió conserva conflict_* y suma la
// nota del admin: con eso alcanza para el historial, sin columna nueva.
const DECISIONES = [
  { id: "approved", label: "Entrega aprobada", clase: styles.riskOk },
  { id: "cancelled", label: "Colaboración cancelada", clase: styles.riskMuted },
] as const;

const colones = (n: number) => `₡${n.toLocaleString("es-CR")}`;

function fechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  });
}

const COLUMNAS =
  "id, campaign_id, creator_id, status, conflict_reason, conflict_by, conflict_at, admin_note, status_changed_at";

type Params = { tab?: string; q?: string; estado?: string; caso?: string };

type Caso = {
  id: string;
  creator_id: string;
  status: string;
  conflict_by: string | null;
  conflict_at: string | null;
  conflict_reason: string | null;
  admin_note: string | null;
  status_changed_at: string;
  campaign?: { title: string; budget_amount: number; deliverables: unknown };
  marca: string;
  creador: string;
};

/**
 * Disputas (mockup 1f): la lista de casos a la izquierda y el elegido a la
 * derecha, con todo lo necesario para decidir y la decisión ahí mismo.
 * Mientras un caso está abierto, el pago está en pausa.
 *
 * El caso elegido viaja en `?caso=`; el Resumen y la ficha del creador
 * linkean directo a uno.
 */
export default async function DisputasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireArea("ugc");
  const params = await searchParams;
  let tab = leerEstado(params.tab, PESTANAS) ?? "abiertas";
  const q = (params.q ?? "").trim();

  const contar = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);
  const [abiertas, resueltas, { data: casoPedido }] = await Promise.all([
    contar(
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "disputed"),
    ),
    contar(
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .not("conflict_at", "is", null)
        .in("status", ["approved", "cancelled"]),
    ),
    params.caso && !params.tab
      ? supabase.from("applications").select("status").eq("id", params.caso).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  // Un link a un caso que ya se resolvió (uno viejo del Resumen, por ejemplo)
  // abre en Resueltas aunque no diga la pestaña.
  if (casoPedido && casoPedido.status !== "disputed") tab = "resueltas";

  const decision = tab === "resueltas" ? leerEstado(params.estado, ["approved", "cancelled"] as const) : null;

  let consulta =
    tab === "abiertas"
      ? // Se resuelven de la más vieja a la más nueva: la que lleva más tiempo
        // abierta es la que más daño hace.
        supabase
          .from("applications")
          .select(COLUMNAS)
          .eq("status", "disputed")
          .order("conflict_at", { ascending: true })
      : supabase
          .from("applications")
          .select(COLUMNAS)
          .not("conflict_at", "is", null)
          .in("status", ["approved", "cancelled"])
          .order("status_changed_at", { ascending: false });
  if (decision) consulta = consulta.eq("status", decision);
  const { data: disputas } = await consulta;

  const lista = disputas ?? [];
  const campaignIds = [...new Set(lista.map((d) => d.campaign_id))];
  const creatorIds = [...new Set(lista.map((d) => d.creator_id))];

  const [{ data: campaigns }, { data: creatorProfiles }] = await Promise.all([
    campaignIds.length
      ? supabase
          .from("campaigns")
          .select("id, title, budget_amount, brand_id, deliverables")
          .in("id", campaignIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            title: string;
            budget_amount: number;
            brand_id: string;
            deliverables: unknown;
          }[],
        }),
    creatorIds.length
      ? supabase.from("creator_profiles").select("profile_id, handle").in("profile_id", creatorIds)
      : Promise.resolve({ data: [] as { profile_id: string; handle: string }[] }),
  ]);
  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const handleById = new Map((creatorProfiles ?? []).map((c) => [c.profile_id, c.handle]));

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brands } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] as { profile_id: string; brand_name: string }[] };
  const brandNameById = new Map((brands ?? []).map((b) => [b.profile_id, b.brand_name]));

  const casos: Caso[] = lista
    .map((d) => {
      const campaign = campaignById.get(d.campaign_id);
      const handle = handleById.get(d.creator_id);
      return {
        ...d,
        campaign,
        marca: campaign ? (brandNameById.get(campaign.brand_id) ?? "La marca") : "La marca",
        creador: handle ? displayHandle(handle) : "el creador",
      };
    })
    .filter((c) => coincide(q, [c.campaign?.title, c.marca, c.creador]));

  const totalDeLaPestana = tab === "abiertas" ? abiertas : resueltas;
  const sel = casos.find((c) => c.id === params.caso) ?? casos[0];

  // El link de cada caso conserva la pestaña, la búsqueda y la decisión.
  const hrefCaso = (id: string) => {
    const u = new URLSearchParams({ tab, caso: id });
    if (q) u.set("q", q);
    if (decision) u.set("estado", decision);
    return `${BASE}?${u.toString()}`;
  };

  return (
    <div>
      <p className={styles.bajada}>Mientras un caso esté abierto, el pago queda en pausa.</p>
      <BarraAdmin>
        <PestanasAdmin
          base={BASE}
          label="Disputas"
          activa={tab}
          pestanas={[
            { id: "abiertas", label: "Abiertas", count: abiertas },
            { id: "resueltas", label: "Resueltas", count: resueltas },
          ]}
        />
        <FiltroAdmin
          base={BASE}
          tab={tab}
          q={q}
          placeholder="Campaña, marca o creador"
          estado={decision}
          opciones={tab === "resueltas" ? DECISIONES.map((d) => ({ id: d.id, label: d.label })) : undefined}
          todos="Todas las decisiones"
        />
      </BarraAdmin>

      {!sel ? (
        <div className={`${styles.card} ${styles.empty}`}>
          {totalDeLaPestana === 0
            ? tab === "abiertas"
              ? "No hay disputas abiertas."
              : "Todavía no se resolvió ninguna disputa."
            : "Nada coincide con ese filtro."}
        </div>
      ) : (
        <div className={styles.dispGrid}>
          <div className={styles.dispLista}>
            {casos.map((c) => {
              const resuelta = DECISIONES.find((x) => x.id === c.status);
              const desde = resuelta ? c.status_changed_at : c.conflict_at;
              const dias = desde ? diasDesde(desde) : null;
              return (
                <Link
                  key={c.id}
                  href={hrefCaso(c.id)}
                  scroll={false}
                  className={`${styles.card} ${styles.dispItem} ${c.id === sel.id ? styles.dispItemOn : ""}`}
                  aria-current={c.id === sel.id ? "true" : undefined}
                >
                  <div className={styles.dispItemTop}>
                    {resuelta ? (
                      <span className={`${styles.riskPill} ${resuelta.clase}`}>{resuelta.label}</span>
                    ) : (
                      <span className={`${styles.riskPill} ${styles.riskRisk}`}>Pago en pausa</span>
                    )}
                    {dias !== null && (
                      <span className={styles.esperaS} style={{ marginTop: 0 }}>
                        {dias === 0 ? "hoy" : `hace ${textoDias(dias)}`}
                      </span>
                    )}
                  </div>
                  <div className={styles.esperaT}>{c.campaign?.title ?? "Campaña"}</div>
                  <div className={styles.esperaS}>
                    {c.marca} · {c.creador}
                  </div>
                </Link>
              );
            })}
          </div>

          <Detalle caso={sel} />
        </div>
      )}
    </div>
  );
}

function Detalle({ caso }: { caso: Caso }) {
  const resuelta = DECISIONES.find((x) => x.id === caso.status);
  const entregables = caso.campaign ? entregablesEnLinea(caso.campaign.deliverables) : "";
  const cajas = [
    { k: "Paga la marca", v: caso.campaign ? colones(caso.campaign.budget_amount) : "—" },
    { k: "Cobra el creador", v: caso.campaign ? colones(creatorPayout(caso.campaign.budget_amount)) : "—" },
    { k: "Reportó", v: caso.conflict_by === caso.creator_id ? "El creador" : "La marca" },
    { k: "Fecha", v: caso.conflict_at ? fechaLarga(caso.conflict_at) : "—" },
  ];

  return (
    <div className={`${styles.card} ${styles.dispDetalle}`}>
      <div className={styles.dispDetalleHead}>
        <div style={{ minWidth: 0 }}>
          <h2>{caso.campaign?.title ?? "Campaña"}</h2>
          <div className={styles.fichaMeta}>
            {caso.marca} ·{" "}
            <Link href={rutaFichaCreador(caso.creator_id)} className={styles.fichaLink}>
              {caso.creador}
            </Link>
            {entregables && ` · ${entregables}`}
          </div>
        </div>
        {resuelta ? (
          <span className={`${styles.riskPill} ${resuelta.clase}`}>{resuelta.label}</span>
        ) : (
          <span className={`${styles.riskPill} ${styles.riskRisk}`}>Pago en pausa</span>
        )}
      </div>

      <div className={styles.dispCajas}>
        {cajas.map((c) => (
          <div key={c.k} className={styles.fichaCaja}>
            <div className={styles.fichaK}>{c.k}</div>
            <b>{c.v}</b>
          </div>
        ))}
      </div>

      <div className={styles.fichaK}>Motivo</div>
      <p className={styles.dispMotivo}>“{caso.conflict_reason}”</p>

      {resuelta ? (
        // Lo que se les mandó a las dos partes por correo.
        <div className={styles.dispResolucion}>
          <div className={styles.fichaK}>Cómo se resolvió · {fechaLarga(caso.status_changed_at)}</div>
          <p>{caso.admin_note ?? "Sin nota."}</p>
        </div>
      ) : (
        <ResolveDisputeForm key={caso.id} applicationId={caso.id} marca={caso.marca} creador={caso.creador} />
      )}
    </div>
  );
}
