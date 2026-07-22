import { createClient } from "@/lib/supabase/server";
import DeliverySubmitForm from "@/components/ugc/creador/DeliverySubmitForm";
import { DELIVERIES_BUCKET, DELIVERY_SIGNED_URL_TTL_SECONDS } from "@/lib/ugc/deliveries";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { creatorPayout } from "@/lib/ugc/payout";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function MisAplicacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("creator_id", user!.id)
    .order("created_at", { ascending: false });

  const campaignIds = [...new Set((applications ?? []).map((a) => a.campaign_id))];
  const { data: campaigns } = campaignIds.length
    ? await supabase
        .from("campaigns")
        .select("id, title, brand_id, budget_amount, deadline_days, deliverables, compensation_details")
        .in("id", campaignIds)
    : { data: [] };

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brandProfiles } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const brandNameByProfileId = new Map((brandProfiles ?? []).map((b) => [b.profile_id, b.brand_name]));

  const applicationIds = (applications ?? []).map((a) => a.id);
  const { data: deliveries } = applicationIds.length
    ? await supabase
        .from("application_deliveries")
        .select("*")
        .in("application_id", applicationIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const deliveriesByApplicationId = new Map<string, typeof deliveries>();
  for (const delivery of deliveries ?? []) {
    const list = deliveriesByApplicationId.get(delivery.application_id) ?? [];
    list.push(delivery);
    deliveriesByApplicationId.set(delivery.application_id, list);
  }

  const fileDeliveries = (deliveries ?? []).filter((d) => d.kind === "file" && d.storage_path);
  const signedUrlByPath = new Map<string, string>();
  await Promise.all(
    fileDeliveries.map(async (d) => {
      const { data } = await supabase.storage
        .from(DELIVERIES_BUCKET)
        .createSignedUrl(d.storage_path!, DELIVERY_SIGNED_URL_TTL_SECONDS);
      if (data?.signedUrl) signedUrlByPath.set(d.storage_path!, data.signedUrl);
    })
  );

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px", marginBottom: "20px" }}>
        Mis aplicaciones
      </h1>

      {applications && applications.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {applications.map((app) => {
            const campaign = campaignById.get(app.campaign_id);
            const brandName = campaign ? brandNameByProfileId.get(campaign.brand_id) : null;

            return (
              <div key={app.id} className={`${styles.card} ${styles.cardPad}`}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-2)" }}>{brandName}</div>
                    <div style={{ fontWeight: 800, color: "var(--ink)" }}>{campaign?.title ?? "Campaña"}</div>
                    {campaign && (
                      <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--ink-3)" }}>
                        ₡{creatorPayout(campaign.budget_amount).toLocaleString("es-CR")}
                        {campaign.deadline_days && ` · ${campaign.deadline_days} días para entregar`}
                      </div>
                    )}
                  </div>
                  <span
                    className={`${styles.riskPill} ${styles["risk" + APPLICATION_STATUS_STYLE[app.status]]}`}
                    style={{ flexShrink: 0 }}
                  >
                    {APPLICATION_STATUS_LABEL[app.status]}
                  </span>
                </div>

                {campaign && Array.isArray(campaign.deliverables) && campaign.deliverables.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                    {(campaign.deliverables as { type: string; qty: number }[]).map((d) => (
                      <span key={d.type} className={styles.tag}>
                        {d.qty}x {FORMAT_LABEL[d.type] ?? d.type}
                      </span>
                    ))}
                  </div>
                )}

                {campaign?.compensation_details && (
                  <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--b-600)" }}>
                    + {campaign.compensation_details}
                  </p>
                )}

                {app.pitch_message && (
                  <p
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      borderRadius: "var(--r-md)",
                      background: "var(--surface-3)",
                      fontSize: "13.5px",
                      color: "var(--ink-2)",
                    }}
                  >
                    {app.pitch_message}
                  </p>
                )}
                {(deliveriesByApplicationId.get(app.id)?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" }}>
                    {deliveriesByApplicationId.get(app.id)!.map((d) => (
                      <div key={d.id} style={{ fontSize: "13.5px", color: "var(--ink-2)" }}>
                        {d.kind === "file" ? (
                          <a
                            href={signedUrlByPath.get(d.storage_path!) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.linkMore}
                          >
                            Ver archivo entregado
                          </a>
                        ) : (
                          <a href={d.external_url!} target="_blank" rel="noreferrer" className={styles.linkMore}>
                            Ver link entregado
                          </a>
                        )}
                        {d.note && <span> — {d.note}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {(app.status === "accepted" || app.status === "delivered") && (
                  <DeliverySubmitForm applicationId={app.id} />
                )}

                {app.status === "approved" && app.rating && (
                  <div style={{ marginTop: "12px", fontSize: "13.5px", color: "var(--ink-2)" }}>
                    La marca calificó esta entrega con {"★".repeat(app.rating)}
                    {"☆".repeat(5 - app.rating)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`${styles.card} ${styles.empty}`}>Todavía no aplicaste a ninguna campaña.</div>
      )}
    </div>
  );
}
