import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import ResolveDisputeForm from "@/components/ugc/admin/ResolveDisputeForm";
import { BarraAdmin, FiltroAdmin, PestanasAdmin } from "@/components/ugc/admin/PestanasAdmin";
import { creatorPayout } from "@/lib/ugc/payout";
import { coincide, leerEstado, rutaFichaCreador } from "@/lib/ugc/marketplace-admin";
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

function fechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  });
}

export default async function DisputasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; estado?: string }>;
}) {
  const { supabase } = await requireArea("ugc");
  const params = await searchParams;
  const tab = leerEstado(params.tab, PESTANAS) ?? "abiertas";
  const q = (params.q ?? "").trim();
  const decision = tab === "resueltas" ? leerEstado(params.estado, ["approved", "cancelled"] as const) : null;

  const contar = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);

  const [abiertas, resueltas, { data: disputas }] = await Promise.all([
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
    tab === "abiertas"
      ? // Se resuelven de la más vieja a la más nueva: la que lleva más tiempo
        // abierta es la que más daño hace.
        supabase
          .from("applications")
          .select(
            "id, campaign_id, creator_id, status, conflict_reason, conflict_by, conflict_at, admin_note, status_changed_at",
          )
          .eq("status", "disputed")
          .order("conflict_at", { ascending: true })
      : (() => {
          let consulta = supabase
            .from("applications")
            .select(
              "id, campaign_id, creator_id, status, conflict_reason, conflict_by, conflict_at, admin_note, status_changed_at",
            )
            .not("conflict_at", "is", null)
            .in("status", ["approved", "cancelled"])
            .order("status_changed_at", { ascending: false });
          if (decision) consulta = consulta.eq("status", decision);
          return consulta;
        })(),
  ]);

  const lista = disputas ?? [];
  const campaignIds = [...new Set(lista.map((d) => d.campaign_id))];
  const profileIds = [
    ...new Set(lista.flatMap((d) => [d.creator_id, d.conflict_by].filter(Boolean) as string[])),
  ];

  const [{ data: campaigns }, { data: profiles }, { data: creatorProfiles }] = await Promise.all([
    campaignIds.length
      ? supabase.from("campaigns").select("id, title, budget_amount, brand_id").in("id", campaignIds)
      : Promise.resolve({ data: [] as never[] }),
    profileIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", profileIds)
      : Promise.resolve({ data: [] as never[] }),
    profileIds.length
      ? supabase.from("creator_profiles").select("profile_id, handle").in("profile_id", profileIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const handleById = new Map((creatorProfiles ?? []).map((c) => [c.profile_id, c.handle]));

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brands } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] as never[] };
  const brandNameById = new Map((brands ?? []).map((b) => [b.profile_id, b.brand_name]));

  const filtradas = lista.filter((d) => {
    const campaign = campaignById.get(d.campaign_id);
    return coincide(q, [
      campaign?.title,
      campaign && brandNameById.get(campaign.brand_id),
      handleById.get(d.creator_id),
      nameById.get(d.creator_id),
    ]);
  });

  const totalDeLaPestana = tab === "abiertas" ? abiertas : resueltas;

  return (
    <div>
      <p style={{ color: "var(--ink-3)", fontSize: "13.5px", marginBottom: "22px" }}>
        Casos abiertos por una marca o un creador sobre una entrega. Mientras estén abiertos, el pago está en
        pausa.
      </p>

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

      {filtradas.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          {totalDeLaPestana === 0
            ? tab === "abiertas"
              ? "No hay disputas abiertas."
              : "Todavía no se resolvió ninguna disputa."
            : "Nada coincide con ese filtro."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filtradas.map((d) => {
            const campaign = campaignById.get(d.campaign_id);
            const quien =
              d.conflict_by === d.creator_id
                ? `el creador ${handleById.get(d.creator_id) ?? ""}`.trim()
                : `la marca ${campaign ? (brandNameById.get(campaign.brand_id) ?? "") : ""}`.trim();
            const resuelta = DECISIONES.find((x) => x.id === d.status);

            return (
              <div key={d.id} className={`${styles.card} ${styles.cardPad}`}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: "16px" }}>{campaign?.title ?? "Campaña"}</b>{" "}
                    {resuelta && (
                      <span className={`${styles.riskPill} ${resuelta.clase}`}>{resuelta.label}</span>
                    )}
                    <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "3px" }}>
                      {campaign ? (brandNameById.get(campaign.brand_id) ?? "Marca") : "Marca"} ·{" "}
                      <Link href={rutaFichaCreador(d.creator_id)} className={styles.fichaLink}>
                        {handleById.get(d.creator_id) ?? nameById.get(d.creator_id) ?? "Creador"}
                      </Link>
                    </div>
                  </div>
                  {campaign && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>
                        Marca paga ₡{campaign.budget_amount.toLocaleString("es-CR")}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--ink-3)" }}>
                        Creador cobra ₡{creatorPayout(campaign.budget_amount).toLocaleString("es-CR")}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px 14px",
                    background: "var(--risk-bg)",
                    border: "1px solid var(--risk-line)",
                    borderRadius: "var(--r-md)",
                    fontSize: "13.5px",
                  }}
                >
                  <b>Lo reportó {quien}:</b> {d.conflict_reason}
                  {d.conflict_at && (
                    <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "6px" }}>
                      {fechaLarga(d.conflict_at)}
                    </div>
                  )}
                </div>

                {resuelta ? (
                  // Lo que se les mandó a las dos partes por correo.
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "12px 14px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--line-2)",
                      borderRadius: "var(--r-md)",
                      fontSize: "13.5px",
                    }}
                  >
                    <b>Cómo se resolvió:</b> {d.admin_note ?? "Sin nota."}
                    <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "6px" }}>
                      {fechaLarga(d.status_changed_at)}
                    </div>
                  </div>
                ) : (
                  <ResolveDisputeForm applicationId={d.id} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
