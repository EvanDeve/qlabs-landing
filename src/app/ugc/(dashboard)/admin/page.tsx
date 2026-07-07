import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "@/components/ugc/DashboardHeader";
import { setCreatorVerifiedAction, markCampaignCompletedAction } from "@/lib/actions/admin";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_STYLE,
} from "@/lib/ugc/application-status";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_STYLE } from "@/lib/ugc/campaign-status";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
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
  const applicantCounts = new Map<string, number>();
  for (const app of applications ?? []) {
    // recent applications list is capped at 20, so this count is only a
    // lower bound for older campaigns — good enough for an admin glance
    applicantCounts.set(app.campaign_id, (applicantCounts.get(app.campaign_id) ?? 0) + 1);
  }

  const creatorHandleById = new Map((creatorProfiles ?? []).map((c) => [c.profile_id, c.handle]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <DashboardHeader />

      <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-ink">Panel admin</h1>
      <p className="mb-10 text-ink-soft">
        Verificación de creadores, todas las campañas y aplicaciones recientes.
      </p>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-extrabold text-ink">
          Creadores ({creatorProfiles?.length ?? 0})
        </h2>
        <div className="flex flex-col gap-3">
          {(creatorProfiles ?? []).map((creator) => {
            const account = accountProfileById.get(creator.profile_id);
            return (
              <div
                key={creator.profile_id}
                className="flex items-center justify-between gap-4 rounded-card border border-line p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-ink">{creator.handle}</span>
                    {creator.verified && (
                      <span className="rounded-pill bg-trust-bg px-2 py-0.5 text-xs font-bold text-trust">
                        Verificado
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">
                    {account?.city && `${account.city} · `}
                    {creator.followers_count.toLocaleString("es-CR")} seguidores
                  </div>
                </div>
                <form action={setCreatorVerifiedAction}>
                  <input type="hidden" name="profile_id" value={creator.profile_id} />
                  <input type="hidden" name="verified" value={(!creator.verified).toString()} />
                  <button
                    type="submit"
                    className={`rounded-pill px-5 py-2 text-sm font-bold transition ${
                      creator.verified
                        ? "border border-line text-ink-soft hover:border-coral hover:text-coral"
                        : "bg-violet text-white hover:bg-violet-deep"
                    }`}
                  >
                    {creator.verified ? "Quitar verificación" : "Verificar"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-extrabold text-ink">
          Campañas ({campaigns?.length ?? 0})
        </h2>
        <div className="flex flex-col gap-3">
          {(campaigns ?? []).map((campaign) => (
            <div
              key={campaign.id}
              className="flex items-center justify-between gap-4 rounded-card border border-line p-4"
            >
              <div>
                <div className="font-extrabold text-ink">{campaign.title}</div>
                <div className="mt-1 text-sm text-ink-soft">
                  {brandNameByProfileId.get(campaign.brand_id)} · ₡
                  {campaign.budget_amount.toLocaleString("es-CR")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-pill px-3 py-1 text-xs font-bold ${CAMPAIGN_STATUS_STYLE[campaign.status]}`}
                >
                  {CAMPAIGN_STATUS_LABEL[campaign.status]}
                </span>
                {(campaign.status === "published" || campaign.status === "in_progress") && (
                  <form action={markCampaignCompletedAction}>
                    <input type="hidden" name="campaign_id" value={campaign.id} />
                    <button
                      type="submit"
                      className="rounded-pill border border-line px-4 py-1.5 text-xs font-bold text-ink-soft transition hover:border-ink hover:text-ink"
                    >
                      Marcar completada
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-extrabold text-ink">Aplicaciones recientes</h2>
        <div className="flex flex-col gap-3">
          {applications && applications.length > 0 ? (
            applications.map((app) => {
              const campaign = campaignById.get(app.campaign_id);
              return (
                <div
                  key={app.id}
                  className="flex items-center justify-between gap-4 rounded-card border border-line p-4"
                >
                  <div>
                    <div className="font-extrabold text-ink">
                      {creatorHandleById.get(app.creator_id) ?? "Creador"}
                    </div>
                    <div className="mt-1 text-sm text-ink-soft">
                      {campaign?.title ?? "Campaña"}
                      {campaign && ` · ${brandNameByProfileId.get(campaign.brand_id)}`}
                    </div>
                  </div>
                  <span
                    className={`rounded-pill px-3 py-1 text-xs font-bold ${APPLICATION_STATUS_STYLE[app.status]}`}
                  >
                    {APPLICATION_STATUS_LABEL[app.status]}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="rounded-card border border-line p-10 text-center text-ink-soft">
              Todavía no hay aplicaciones.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
