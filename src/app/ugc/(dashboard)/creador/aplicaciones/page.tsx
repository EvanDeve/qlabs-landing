import { createClient } from "@/lib/supabase/server";
import DeliverySubmitForm from "@/components/ugc/creador/DeliverySubmitForm";
import { DELIVERIES_BUCKET, DELIVERY_SIGNED_URL_TTL_SECONDS } from "@/lib/ugc/deliveries";
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
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-ink">Mis aplicaciones</h1>

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
                {(deliveriesByApplicationId.get(app.id)?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {deliveriesByApplicationId.get(app.id)!.map((d) => (
                      <div key={d.id} className="text-sm text-ink-soft">
                        {d.kind === "file" ? (
                          <a
                            href={signedUrlByPath.get(d.storage_path!) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-violet-deep hover:underline"
                          >
                            Ver archivo entregado
                          </a>
                        ) : (
                          <a
                            href={d.external_url!}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-violet-deep hover:underline"
                          >
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
