import { createClient } from "@/lib/supabase/server";
import UgcTabs from "@/components/ugc/marca/UgcTabs";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function MarcaUgcPanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, status, budget_amount, created_at")
    .eq("brand_id", user!.id)
    .order("created_at", { ascending: false });

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: applications } = campaignIds.length
    ? await supabase
        .from("applications")
        .select("id, campaign_id, creator_id, status, pitch_message, created_at")
        .in("campaign_id", campaignIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const applicantCounts = new Map<string, number>();
  const inProductionCounts = new Map<string, number>();
  for (const app of applications ?? []) {
    applicantCounts.set(app.campaign_id, (applicantCounts.get(app.campaign_id) ?? 0) + 1);
    if (app.status === "accepted" || app.status === "delivered") {
      inProductionCounts.set(app.campaign_id, (inProductionCounts.get(app.campaign_id) ?? 0) + 1);
    }
  }

  const pendingApplications = (applications ?? []).filter(
    (a) => a.status === "pending" || a.status === "reviewing"
  );

  const creatorIds = [...new Set(pendingApplications.map((a) => a.creator_id))];
  const [{ data: profiles }, { data: creatorProfiles }] = creatorIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, display_name").in("id", creatorIds),
        supabase.from("creator_profiles").select("*").in("profile_id", creatorIds),
      ])
    : [{ data: [] }, { data: [] }];

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const creatorProfileById = new Map((creatorProfiles ?? []).map((c) => [c.profile_id, c]));
  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));

  const applicants = pendingApplications.map((a) => {
    const creatorProfile = creatorProfileById.get(a.creator_id);
    const profile = profileById.get(a.creator_id);
    return {
      applicationId: a.id,
      campaignId: a.campaign_id,
      campaignTitle: campaignById.get(a.campaign_id)?.title ?? "Campaña",
      status: a.status as "pending" | "reviewing",
      creatorHandle: creatorProfile?.handle ?? null,
      creatorDisplayName: profile?.display_name ?? "Creador",
      verified: creatorProfile?.verified ?? false,
      followersCount: creatorProfile?.followers_count ?? null,
      engagementRate: creatorProfile?.engagement_rate ?? null,
      niches: creatorProfile?.niches ?? [],
      pitchMessage: a.pitch_message,
    };
  });

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px", marginBottom: "4px" }}>
        UGC·CRC
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "20px" }}>
        Publicá campañas, revisá aplicantes y convertí contenido real en prueba social.
      </p>

      <UgcTabs
        campaigns={(campaigns ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          budget_amount: c.budget_amount,
          applicantCount: applicantCounts.get(c.id) ?? 0,
          inProductionCount: inProductionCounts.get(c.id) ?? 0,
        }))}
        applicants={applicants}
      />
    </div>
  );
}
