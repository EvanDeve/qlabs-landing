import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publishCampaignAction } from "@/lib/actions/campaigns";
import { updateApplicationStatusAction, approveApplicationAction } from "@/lib/actions/applications";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { DELIVERIES_BUCKET, DELIVERY_SIGNED_URL_TTL_SECONDS } from "@/lib/ugc/deliveries";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_STYLE,
} from "@/lib/ugc/application-status";

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
    <div className="mx-auto max-w-3xl">
      <Link href="/ugc/marca" className="text-sm font-bold text-ink-soft hover:text-ink">
        ← Mis campañas
      </Link>

      <div className="mt-6 rounded-card border border-line p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">{campaign.title}</h1>
            <div className="mt-1 text-sm font-semibold text-ink-soft">
              ₡{campaign.budget_amount.toLocaleString("es-CR")}
              {campaign.deadline_days ? ` · ${campaign.deadline_days} días` : ""}
            </div>
          </div>
          {campaign.status === "draft" && (
            <form action={publishCampaignAction}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <button
                type="submit"
                className="rounded-pill bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep"
              >
                Publicar
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-ink-soft">{campaign.brief}</p>

        {campaign.target_audience && (
          <p className="mt-3 text-sm text-ink-soft">
            <span className="font-bold text-ink">Audiencia: </span>
            {campaign.target_audience}
          </p>
        )}

        {deliverables.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
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
      </div>

      <h2 className="mb-4 mt-10 text-xl font-extrabold text-ink">
        Aplicantes ({applications?.length ?? 0})
      </h2>

      {applications && applications.length > 0 ? (
        <div className="flex flex-col gap-4">
          {applications.map((app) => {
            const profile = profileById.get(app.creator_id);
            const creatorProfile = creatorProfileById.get(app.creator_id);

            return (
              <div key={app.id} className="rounded-card border border-line p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {creatorProfile?.handle ? (
                        <Link
                          href={`/ugc/creadores/${creatorProfile.handle}`}
                          className="font-extrabold text-ink hover:text-violet-deep"
                        >
                          {creatorProfile.handle}
                        </Link>
                      ) : (
                        <span className="font-extrabold text-ink">{profile?.display_name ?? "Creador"}</span>
                      )}
                      {creatorProfile?.verified && (
                        <span className="rounded-pill bg-trust-bg px-2 py-0.5 text-xs font-bold text-trust">
                          Verificado
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-ink-soft">
                      {profile?.city && `${profile.city} · `}
                      {creatorProfile?.followers_count
                        ? `${creatorProfile.followers_count.toLocaleString("es-CR")} seguidores`
                        : null}
                    </div>
                    {creatorProfile?.niches && creatorProfile.niches.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {creatorProfile.niches.map((niche) => (
                          <span
                            key={niche}
                            className="rounded-pill bg-lavender px-2.5 py-1 text-xs font-semibold text-violet-deep"
                          >
                            {niche}
                          </span>
                        ))}
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

                {(app.status === "pending" || app.status === "reviewing") && (
                  <div className="mt-4 flex gap-3">
                    <form action={updateApplicationStatusAction}>
                      <input type="hidden" name="application_id" value={app.id} />
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input type="hidden" name="status" value="accepted" />
                      <button
                        type="submit"
                        className="rounded-pill bg-trust px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
                      >
                        Aceptar
                      </button>
                    </form>
                    <form action={updateApplicationStatusAction}>
                      <input type="hidden" name="application_id" value={app.id} />
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button
                        type="submit"
                        className="rounded-pill border border-line px-5 py-2 text-sm font-bold text-ink-soft transition hover:border-coral hover:text-coral"
                      >
                        Rechazar
                      </button>
                    </form>
                  </div>
                )}

                {(app.status === "delivered" || app.status === "approved") &&
                  (deliveriesByApplicationId.get(app.id)?.length ?? 0) > 0 && (
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
                              Ver pieza entregada
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

                {app.status === "delivered" && (
                  <form action={approveApplicationAction} className="mt-4">
                    <input type="hidden" name="application_id" value={app.id} />
                    <input type="hidden" name="campaign_id" value={campaign.id} />
                    <button
                      type="submit"
                      className="rounded-pill bg-trust px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
                    >
                      Aprobar entrega
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-card border border-line p-10 text-center text-ink-soft">
          Todavía no hay aplicantes.
        </div>
      )}
    </div>
  );
}
