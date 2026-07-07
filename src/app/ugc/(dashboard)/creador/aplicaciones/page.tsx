import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "@/components/ugc/DashboardHeader";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_STYLE,
} from "@/lib/ugc/application-status";

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
    ? await supabase.from("campaigns").select("id, title, brand_id, budget_amount").in("id", campaignIds)
    : { data: [] };

  const brandIds = [...new Set((campaigns ?? []).map((c) => c.brand_id))];
  const { data: brandProfiles } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };

  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const brandNameByProfileId = new Map((brandProfiles ?? []).map((b) => [b.profile_id, b.brand_name]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <DashboardHeader />

      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Mis aplicaciones</h1>
        <Link
          href="/ugc/creador"
          className="rounded-pill border border-line px-5 py-2.5 text-sm font-bold text-ink transition hover:border-ink"
        >
          ← Feed de campañas
        </Link>
      </div>

      {applications && applications.length > 0 ? (
        <div className="flex flex-col gap-4">
          {applications.map((app) => {
            const campaign = campaignById.get(app.campaign_id);
            const brandName = campaign ? brandNameByProfileId.get(campaign.brand_id) : null;

            return (
              <div key={app.id} className="rounded-card border border-line p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-ink-soft">{brandName}</div>
                    <div className="font-extrabold text-ink">{campaign?.title ?? "Campaña"}</div>
                    {campaign && (
                      <div className="mt-1 text-sm text-ink-soft">
                        ₡{campaign.budget_amount.toLocaleString("es-CR")}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-pill px-3 py-1 text-xs font-bold ${APPLICATION_STATUS_STYLE[app.status]}`}
                  >
                    {APPLICATION_STATUS_LABEL[app.status]}
                  </span>
                </div>
                {app.pitch_message && (
                  <p className="mt-3 rounded-lg bg-lavender p-3 text-sm text-ink-soft">
                    {app.pitch_message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-card border border-line p-10 text-center text-ink-soft">
          Todavía no aplicaste a ninguna campaña.
        </div>
      )}
    </div>
  );
}
