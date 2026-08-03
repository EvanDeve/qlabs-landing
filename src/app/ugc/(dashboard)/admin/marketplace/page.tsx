import { requireDirector } from "@/lib/auth/require-director";
import {
  setCreatorVerifiedAction,
  setBrandVerifiedAction,
  markCampaignCompletedAction,
} from "@/lib/actions/admin";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import { APPLICATION_STATUS_LABEL } from "@/lib/ugc/application-status";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/ugc/campaign-status";
import styles from "../qos.module.css";
import { displayHandle, handleSlug } from "@/lib/ugc/handles";

export const dynamic = "force-dynamic";

export default async function AdminMarketplacePage() {
  // Ruta de Sistema: solo directores. La RLS igual no le devolvería
  // las filas a nadie más, pero rebotar es mejor que una página vacía.
  const { supabase } = await requireDirector();

  const [{ data: creatorProfiles }, { data: campaigns }, { data: applications }, { data: allBrands }] =
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
      // Todas las marcas, no solo las que ya publicaron: una marca nueva tiene
      // que poder verificarse ANTES de poder publicar (el gate es duro).
      supabase
        .from("brand_profiles")
        .select("*")
        .order("verified", { ascending: true })
        .order("brand_name"),
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
          // El handle es lo que arma la URL del media-kit. Puede venir vacío o
          // solo con "@" en filas viejas, y ahí el link caería en un 404.
          const slug = handleSlug(creator.handle);
          return (
            <div key={creator.profile_id} className={styles.attnItem} style={{ cursor: "default" }}>
              <div className={styles.attnBody}>
                <div className={styles.attnTitle}>
                  {displayHandle(creator.handle)} {creator.verified && <span className={`${styles.riskPill} ${styles.riskOk}`}>Verificado</span>}
                </div>
                <div className={styles.attnMeta}>
                  {account?.city && `${account.city} · `}
                  {creator.followers_count.toLocaleString("es-CR")} seguidores
                </div>
              </div>
              <div className={styles.attnRight}>
                {slug && (
                  // Abre el perfil público, que es donde vive el book. Sirve
                  // también con el creador SIN verificar —`creator_public_profiles`
                  // no filtra por `verified`—, que es justo cuando hace falta:
                  // hay que ver el material antes de decidir si se verifica.
                  <a
                    href={`/ugc/creadores/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                  >
                    Ver book
                  </a>
                )}
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
            </div>
          );
        })}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
        <div className={styles.sectionHead}>
          <h2>Marcas ({allBrands?.length ?? 0})</h2>
        </div>
        {(allBrands ?? []).map((brand) => (
          <div key={brand.profile_id} className={styles.attnItem} style={{ cursor: "default" }}>
            <BrandAvatar name={brand.brand_name} logoUrl={brand.logo_url} size={32} radius={9} />
            <div className={styles.attnBody}>
              <div className={styles.attnTitle}>
                {brand.brand_name}{" "}
                {brand.verified && (
                  <span className={`${styles.riskPill} ${styles.riskOk}`}>Verificada</span>
                )}
              </div>
              <div className={styles.attnMeta}>
                {[brand.industry, brand.location].filter(Boolean).join(" · ") || "Sin datos"}
              </div>
            </div>
            <div className={styles.attnRight}>
              {brand.slug && (
                <a
                  href={`/ugc/marcas/${brand.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                >
                  Ver perfil
                </a>
              )}
              <form action={setBrandVerifiedAction}>
                <input type="hidden" name="profile_id" value={brand.profile_id} />
                <input type="hidden" name="verified" value={(!brand.verified).toString()} />
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnSm} ${brand.verified ? styles.btnGhost : styles.btnPrimary}`}
                >
                  {brand.verified ? "Quitar verificación" : "Verificar"}
                </button>
              </form>
            </div>
          </div>
        ))}
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
