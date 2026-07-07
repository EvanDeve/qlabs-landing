import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "@/components/ugc/DashboardHeader";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_STYLE } from "@/lib/ugc/campaign-status";

export const dynamic = "force-dynamic";

export default async function MarcaDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, status, budget_amount, created_at")
    .eq("brand_id", user!.id)
    .order("created_at", { ascending: false });

  const campaignIds = campaigns?.map((c) => c.id) ?? [];
  const { data: applications } = campaignIds.length
    ? await supabase.from("applications").select("campaign_id").in("campaign_id", campaignIds)
    : { data: [] };

  const applicantCounts = new Map<string, number>();
  for (const app of applications ?? []) {
    applicantCounts.set(app.campaign_id, (applicantCounts.get(app.campaign_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <DashboardHeader />

      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Mis campañas</h1>
        <Link
          href="/ugc/marca/campanas/nueva"
          className="rounded-pill bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep"
        >
          + Nueva campaña
        </Link>
      </div>

      {campaigns && campaigns.length > 0 ? (
        <div className="flex flex-col gap-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/ugc/marca/campanas/${campaign.id}`}
              className="flex items-center justify-between gap-4 rounded-card border border-line p-5 transition hover:border-ink"
            >
              <div>
                <div className="font-extrabold text-ink">{campaign.title}</div>
                <div className="mt-1 text-sm text-ink-soft">
                  ₡{campaign.budget_amount.toLocaleString("es-CR")} ·{" "}
                  {applicantCounts.get(campaign.id) ?? 0} aplicantes
                </div>
              </div>
              <span
                className={`rounded-pill px-3 py-1 text-xs font-bold ${CAMPAIGN_STATUS_STYLE[campaign.status]}`}
              >
                {CAMPAIGN_STATUS_LABEL[campaign.status]}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-line p-10 text-center text-ink-soft">
          Todavía no publicaste ninguna campaña.
        </div>
      )}
    </div>
  );
}
