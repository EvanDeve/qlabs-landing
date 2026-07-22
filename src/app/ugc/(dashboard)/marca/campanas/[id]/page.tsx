import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publishCampaignAction } from "@/lib/actions/campaigns";
import { updateApplicationStatusAction } from "@/lib/actions/applications";
import ApproveWithRatingForm from "@/components/ugc/marca/ApproveWithRatingForm";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { DELIVERIES_BUCKET, DELIVERY_SIGNED_URL_TTL_SECONDS } from "@/lib/ugc/deliveries";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (!campaign || campaign.brand_id !== user!.id) {
    notFound();
  }

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  const creatorIds = applications?.map((a) => a.creator_id) ?? [];

  const [{ data: profiles }, { data: creatorProfiles }] = creatorIds.length
    ? await Promise.all([
        supabase.from("profiles").select("*").in("id", creatorIds),
        supabase.from("creator_profiles").select("*").in("profile_id", creatorIds),
      ])
    : [{ data: [] }, { data: [] }];

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const creatorProfileById = new Map((creatorProfiles ?? []).map((c) => [c.profile_id, c]));

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

  const deliverables = Array.isArray(campaign.deliverables)
    ? (campaign.deliverables as { type: string; qty: number }[])
    : [];

  return (
    <div>
      <Link href="/ugc/marca/ugc" className={styles.backBtn}>
        <QosIcon name="chevL" size={16} />
        Volver a UGC·CRC
      </Link>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h1 className={styles.tbTitle} style={{ fontSize: "24px" }}>
              {campaign.title}
            </h1>
            <div style={{ marginTop: "4px", fontSize: "13.5px", fontWeight: 600, color: "var(--ink-2)" }}>
              ₡{campaign.budget_amount.toLocaleString("es-CR")}
              {campaign.deadline_days ? ` · ${campaign.deadline_days} días` : ""}
            </div>
          </div>
          {campaign.status === "draft" && (
            <form action={publishCampaignAction}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                Publicar
              </button>
            </form>
          )}
        </div>

        <p style={{ marginTop: "16px", color: "var(--ink-2)" }}>{campaign.brief}</p>

        {campaign.target_audience && (
          <p style={{ marginTop: "12px", fontSize: "13.5px", color: "var(--ink-2)" }}>
            <span style={{ fontWeight: 700, color: "var(--ink)" }}>Audiencia: </span>
            {campaign.target_audience}
          </p>
        )}

        {campaign.compensation_details && (
          <p style={{ marginTop: "8px", fontSize: "13.5px", color: "var(--ink-2)" }}>
            <span style={{ fontWeight: 700, color: "var(--ink)" }}>Compensación adicional: </span>
            {campaign.compensation_details}
          </p>
        )}

        {deliverables.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
            {deliverables.map((d) => (
              <span key={d.type} className={styles.tag}>
                {d.qty}x {FORMAT_LABEL[d.type] ?? d.type}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.sectionHead} style={{ marginTop: "28px" }}>
        <h2 className={styles.sectionHeadBig}>Aplicantes ({applications?.length ?? 0})</h2>
      </div>

      {applications && applications.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {applications.map((app) => {
            const profile = profileById.get(app.creator_id);
            const creatorProfile = creatorProfileById.get(app.creator_id);

            return (
              <div key={app.id} className={`${styles.card} ${styles.cardPad}`}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {creatorProfile?.handle ? (
                        <Link
                          href={`/ugc/creadores/${creatorProfile.handle.replace(/^@/, "")}`}
                          style={{ fontWeight: 800, color: "var(--ink)" }}
                        >
                          {creatorProfile.handle}
                        </Link>
                      ) : (
                        <span style={{ fontWeight: 800, color: "var(--ink)" }}>
                          {profile?.display_name ?? "Creador"}
                        </span>
                      )}
                      {creatorProfile?.verified && (
                        <span className={`${styles.riskPill} ${styles.riskOk}`}>Verificado</span>
                      )}
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--ink-3)" }}>
                      {profile?.city && `${profile.city} · `}
                      {creatorProfile?.followers_count
                        ? `${creatorProfile.followers_count.toLocaleString("es-CR")} seguidores`
                        : null}
                    </div>
                    {creatorProfile?.niches && creatorProfile.niches.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                        {creatorProfile.niches.map((niche) => (
                          <span key={niche} className={styles.chip}>
                            {niche}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span
                    className={`${styles.riskPill} ${styles["risk" + APPLICATION_STATUS_STYLE[app.status]]}`}
                  >
                    {APPLICATION_STATUS_LABEL[app.status]}
                  </span>
                </div>

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

                {(app.status === "pending" || app.status === "reviewing") && (
                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <form action={updateApplicationStatusAction}>
                      <input type="hidden" name="application_id" value={app.id} />
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input type="hidden" name="status" value="accepted" />
                      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                        Aceptar
                      </button>
                    </form>
                    <form action={updateApplicationStatusAction}>
                      <input type="hidden" name="application_id" value={app.id} />
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button type="submit" className={`${styles.btn} ${styles.btnGhost}`}>
                        Rechazar
                      </button>
                    </form>
                  </div>
                )}

                {(app.status === "delivered" || app.status === "approved") &&
                  (deliveriesByApplicationId.get(app.id)?.length ?? 0) > 0 && (
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
                              Ver pieza entregada
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

                {app.status === "delivered" && (
                  <ApproveWithRatingForm applicationId={app.id} campaignId={campaign.id} />
                )}

                {app.status === "approved" && app.rating && (
                  <div style={{ marginTop: "12px", fontSize: "13.5px", color: "var(--ink-2)" }}>
                    Calificaste esta entrega con {"★".repeat(app.rating)}
                    {"☆".repeat(5 - app.rating)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`${styles.card} ${styles.empty}`}>Todavía no hay aplicantes.</div>
      )}
    </div>
  );
}
