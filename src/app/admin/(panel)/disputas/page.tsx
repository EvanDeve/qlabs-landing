import { requireDirector } from "@/lib/auth/require-director";
import ResolveDisputeForm from "@/components/ugc/admin/ResolveDisputeForm";
import { creatorPayout } from "@/lib/ugc/payout";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function DisputasPage() {
  const { supabase } = await requireDirector();

  const { data: disputas } = await supabase
    .from("applications")
    .select("id, campaign_id, creator_id, conflict_reason, conflict_by, conflict_at")
    .eq("status", "disputed")
    .order("conflict_at", { ascending: true });

  // Se resuelven de la más vieja a la más nueva: la que lleva más tiempo
  // abierta es la que más daño hace.
  const campaignIds = [...new Set((disputas ?? []).map((d) => d.campaign_id))];
  const profileIds = [
    ...new Set((disputas ?? []).flatMap((d) => [d.creator_id, d.conflict_by].filter(Boolean) as string[])),
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

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "24px", marginBottom: "6px" }}>
        Disputas
      </h1>
      <p style={{ color: "var(--ink-3)", fontSize: "13.5px", marginBottom: "22px" }}>
        Casos abiertos por una marca o un creador sobre una entrega. Mientras estén acá, el pago
        está en pausa.
      </p>

      {(disputas ?? []).length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>No hay disputas abiertas.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {disputas!.map((d) => {
            const campaign = campaignById.get(d.campaign_id);
            const quien =
              d.conflict_by === d.creator_id
                ? `el creador ${handleById.get(d.creator_id) ?? ""}`.trim()
                : `la marca ${campaign ? (brandNameById.get(campaign.brand_id) ?? "") : ""}`.trim();

            return (
              <div key={d.id} className={`${styles.card} ${styles.cardPad}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: "16px" }}>{campaign?.title ?? "Campaña"}</b>
                    <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "3px" }}>
                      {campaign ? (brandNameById.get(campaign.brand_id) ?? "Marca") : "Marca"} ·{" "}
                      {handleById.get(d.creator_id) ?? nameById.get(d.creator_id) ?? "Creador"}
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
                      {new Date(d.conflict_at).toLocaleDateString("es-CR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  )}
                </div>

                <ResolveDisputeForm applicationId={d.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
