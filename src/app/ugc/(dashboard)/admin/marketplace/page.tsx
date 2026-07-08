import { createClient } from "@/lib/supabase/server";
import { setCreatorVerifiedAction, markCampaignCompletedAction } from "@/lib/actions/admin";
import { APPLICATION_STATUS_LABEL } from "@/lib/ugc/application-status";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/ugc/campaign-status";
import styles from "../qos.module.css";

export const dynamic = "force-dynamic";

export default async function AdminMarketplacePage() {
  const supabase = await createClient();

  const [{ data: creatorProfiles }, { data: campaigns }, { data: applications }] =
    await Promise.all([
      supabase
        .from("creator_profiles")
        .select("*")
        .order("verified", { ascending: true })
        .order("followers_count", { ascending: false }),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const creatorProfileIds = (creatorProfiles ?? []).map((c) => c.profile_id);
  const { data: creatorAccountProfiles } = creatorProfileIds.length
    ? await supabase.from("profiles").select("id, display_name, city").in("id", creatorProfileIds)
    : { data: [] };
  const accountProfileById = new Map((creatorAccountProfiles ?? []).map((p) => [p.id, p]));

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brandProfiles } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };
  const brandNameByProfileId = new Map((brandProfiles ?? []).map((b) => [b.profile_id, b.brand_name]));

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const creatorHandleById = new Map((creatorProfiles ?? []).map((c) => [c.profile_id, c.handle]));

  return (
    <div>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
        <div className={styles.sectionHead}>
          <h2>Creadores ({creatorProfiles?.length ?? 0})</h2>
        </div>
        {(creatorProfiles ?? []).map((creator) => {
          const account = accountProfileById.get(creator.profile_id);
          return (
            <div key={creator.profile_id} className={styles.attnItem} style={{ cursor: "default" }}>
              <div className={styles.attnBody}>
                <div className={styles.attnTitle}>
                  {creator.handle} {creator.verified && <span className={`${styles.riskPill} ${styles.riskOk}`}>Verificado</span>}
                </div>
                <div className={styles.attnMeta}>
                  {account?.city && `${account.city} · `}
                  {creator.followers_count.toLocaleString("es-CR")} seguidores
                </div>
              </div>
              <form action={setCreatorVerifiedAction}>
                <input type="hidden" name="profile_id" value={creator.profile_id} />
                <input type="hidden" name="verified" value={(!creator.verified).toString()} />
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnSm} ${creator.verified ? styles.btnGhost : styles.btnPrimary}`}
                >
                  {creator.verified ? "Quitar verificación" : "Verificar"}
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
        <div className={styles.sectionHead}>
          <h2>Campañas ({campaigns?.length ?? 0})</h2>
        </div>
        {(campaigns ?? []).map((campaign) => (
          <div key={campaign.id} className={styles.attnItem} style={{ cursor: "default" }}>
            <div className={styles.attnBody}>
              <div className={styles.attnTitle}>{campaign.title}</div>
              <div className={styles.attnMeta}>
                {brandNameByProfileId.get(campaign.brand_id)} · ₡{campaign.budget_amount.toLocaleString("es-CR")}
              </div>
            </div>
            <div className={styles.attnRight}>
              <span className={styles.tag}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</span>
              {(campaign.status === "published" || campaign.status === "in_progress") && (
                <form action={markCampaignCompletedAction}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <button type="submit" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
                    Marcar completada
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Aplicaciones recientes</h2>
        </div>
        {applications && applications.length > 0 ? (
          applications.map((app) => {
            const campaign = campaignById.get(app.campaign_id);
            return (
              <div key={app.id} className={styles.attnItem} style={{ cursor: "default" }}>
                <div className={styles.attnBody}>
                  <div className={styles.attnTitle}>{creatorHandleById.get(app.creator_id) ?? "Creador"}</div>
                  <div className={styles.attnMeta}>
                    {campaign?.title ?? "Campaña"}
                    {campaign && ` · ${brandNameByProfileId.get(campaign.brand_id)}`}
                  </div>
                </div>
                <span className={styles.tag}>{APPLICATION_STATUS_LABEL[app.status]}</span>
              </div>
            );
          })
        ) : (
          <div className={styles.empty}>Todavía no hay aplicaciones.</div>
        )}
      </div>
    </div>
  );
}
