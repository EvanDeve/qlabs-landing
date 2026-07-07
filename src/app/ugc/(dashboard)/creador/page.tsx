import { createClient } from "@/lib/supabase/server";
import ApplyForm from "@/components/ugc/creador/ApplyForm";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_STYLE,
} from "@/lib/ugc/application-status";

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

  const applicationByCampaignId = new Map(
    (myApplications ?? []).map((a) => [a.campaign_id, a])
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-ink">Campañas publicadas</h1>

      {campaigns && campaigns.length > 0 ? (
        <div className="flex flex-col gap-5">
          {campaigns.map((campaign) => {
            const brand = brandByProfileId.get(campaign.brand_id);
            const application = applicationByCampaignId.get(campaign.id);
            const deliverables = Array.isArray(campaign.deliverables)
              ? (campaign.deliverables as { type: string; qty: number }[])
              : [];

            return (
              <div key={campaign.id} className="rounded-card border border-line p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink-soft">{brand?.brand_name}</span>
                  {brand?.industry && (
                    <span className="rounded-pill bg-lavender px-3 py-1 text-xs font-bold text-violet-deep">
                      {brand.industry}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-lg font-extrabold text-ink">{campaign.title}</h2>
                <p className="mt-2 text-ink-soft">{campaign.brief}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <span className="font-bold text-ink">₡{campaign.budget_amount.toLocaleString("es-CR")}</span>
                  {campaign.deadline_days && <span>· {campaign.deadline_days} días</span>}
                  {campaign.target_audience && <span>· {campaign.target_audience}</span>}
                </div>

                {deliverables.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {deliverables.map((d) => (
                      <span
                        key={d.type}
                        className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-soft"
                      >
                        {d.qty}x {FORMAT_LABEL[d.type] ?? d.type}
                      </span>
                    ))}
                  </div>
                )}

                {application ? (
                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={`rounded-pill px-3 py-1 text-xs font-bold ${APPLICATION_STATUS_STYLE[application.status]}`}
                    >
                      Ya aplicaste — {APPLICATION_STATUS_LABEL[application.status]}
                    </span>
                  </div>
                ) : (
                  <ApplyForm campaignId={campaign.id} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-card border border-line p-10 text-center text-ink-soft">
          No hay campañas publicadas por ahora. Volvé pronto.
        </div>
      )}
    </div>
  );
}
