import { createClient } from "@/lib/supabase/server";
import CreadorFeedGrid from "@/components/ugc/creador/CreadorFeedGrid";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CreadorFeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: campaigns }, { data: myApplications }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase.from("applications").select("*").eq("creator_id", user!.id),
  ]);

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brandProfiles } = brandIds.length
    ? await supabase.from("brand_profiles").select("*").in("profile_id", brandIds)
    : { data: [] };
  const brandByProfileId = new Map((brandProfiles ?? []).map((b) => [b.profile_id, b]));

  const applicationByCampaignId = new Map((myApplications ?? []).map((a) => [a.campaign_id, a]));

  const feedCampaigns = (campaigns ?? []).map((campaign) => {
    const brand = brandByProfileId.get(campaign.brand_id);
    const application = applicationByCampaignId.get(campaign.id);
    return {
      id: campaign.id,
      title: campaign.title,
      brief: campaign.brief,
      budget_amount: campaign.budget_amount,
      compensation_details: campaign.compensation_details,
      deadline_days: campaign.deadline_days,
      target_audience: campaign.target_audience,
      deliverables: Array.isArray(campaign.deliverables)
        ? (campaign.deliverables as { type: string; qty: number }[])
        : [],
      brandName: brand?.brand_name ?? null,
      brandIndustry: brand?.industry ?? null,
      brandLogoUrl: brand?.logo_url ?? null,
      brandLocation: brand?.location ?? null,
      brandSlug: brand?.slug ?? null,
      brandVerified: brand?.verified ?? false,
      applicationStatus: application?.status ?? null,
    };
  });

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px" }}>
        Feed de promos
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "20px" }}>
        Campañas de marcas verificadas buscando creadores como vos. Aplicá con tu book en un clic.
      </p>

      {feedCampaigns.length > 0 ? (
        <CreadorFeedGrid campaigns={feedCampaigns} />
      ) : (
        <div className={`${styles.card} ${styles.empty}`}>No hay campañas publicadas por ahora. Volvé pronto.</div>
      )}
    </div>
  );
}
