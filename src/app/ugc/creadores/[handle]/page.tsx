import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_BUCKET } from "@/lib/ugc/portfolio";
import { computeTrustScore } from "@/lib/ugc/trust-score";
import TrustRing from "@/components/ugc/TrustRing";

export const dynamic = "force-dynamic";

export default async function CreatorPublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("handle", handle)
    .single();

  if (!creatorProfile) {
    notFound();
  }

  const [
    { data: profile },
    { data: skills },
    { data: services },
    { data: addons },
    { data: pastBrands },
    { data: portfolioItems },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", creatorProfile.profile_id).single(),
    supabase.from("creator_skills").select("*").eq("creator_id", creatorProfile.profile_id).order("position"),
    supabase.from("creator_services").select("*").eq("creator_id", creatorProfile.profile_id),
    supabase.from("creator_addons").select("*").eq("creator_id", creatorProfile.profile_id),
    supabase
      .from("creator_past_brands")
      .select("*")
      .eq("creator_id", creatorProfile.profile_id)
      .order("position"),
    supabase
      .from("portfolio_items")
      .select("*")
      .eq("creator_id", creatorProfile.profile_id)
      .order("position"),
  ]);

  const { data: deliveryStatsRows } = await supabase.rpc("creator_delivery_stats", {
    p_creator_id: creatorProfile.profile_id,
  });
  const deliveryStats = deliveryStatsRows?.[0];
  const trustScore = computeTrustScore({
    verified: creatorProfile.verified,
    approvedCount: deliveryStats?.approved_count ?? 0,
    onTimeRatio: deliveryStats?.on_time_ratio ?? null,
  });

  const brandsByCategory = new Map<string, string[]>();
  for (const b of pastBrands ?? []) {
    const list = brandsByCategory.get(b.category) ?? [];
    list.push(b.brand_name);
    brandsByCategory.set(b.category, list);
  }

  const initial = (profile?.display_name ?? creatorProfile.handle).slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/ugc" className="text-sm font-bold text-ink-soft hover:text-ink">
        ← Volver
      </Link>

      <div className="mt-6 rounded-card bg-ink p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet text-2xl font-extrabold">
            {initial}
          </div>
          <div className="flex items-center gap-3">
            {creatorProfile.verified && (
              <span className="rounded-pill bg-trust-bg px-3 py-1 text-xs font-bold text-trust">
                Verificado
              </span>
            )}
            <div className="text-white">
              <TrustRing score={trustScore} />
            </div>
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">@{creatorProfile.handle}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/70">
          {profile?.city && <span>📍 {profile.city}</span>}
          <span>👥 {creatorProfile.followers_count.toLocaleString("es-CR")} seguidores</span>
        </div>

        {(creatorProfile.niches.length > 0 || creatorProfile.languages.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {creatorProfile.niches.map((niche) => (
              <span key={niche} className="rounded-pill bg-white/10 px-3 py-1 text-xs font-bold">
                {niche}
              </span>
            ))}
            {creatorProfile.languages.map((lang) => (
              <span key={lang} className="rounded-pill bg-trust-bg px-3 py-1 text-xs font-bold text-trust">
                {lang}
              </span>
            ))}
          </div>
        )}

        {profile?.bio && <p className="mt-4 max-w-lg text-sm text-white/80">{profile.bio}</p>}
      </div>

      {(creatorProfile.avg_views || creatorProfile.engagement_rate || creatorProfile.avg_reach) && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold text-ink">
            Alcance & interacción <span className="text-sm font-normal text-ink-soft">promedio</span>
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-card border border-line p-4 text-center">
              <div className="text-2xl font-extrabold text-ink">
                {creatorProfile.avg_views?.toLocaleString("es-CR") ?? "—"}
              </div>
              <div className="text-xs text-ink-soft">Vistas promedio</div>
            </div>
            <div className="rounded-card border border-line p-4 text-center">
              <div className="text-2xl font-extrabold text-ink">
                {creatorProfile.engagement_rate ? `${creatorProfile.engagement_rate}%` : "—"}
              </div>
              <div className="text-xs text-ink-soft">Interacción</div>
            </div>
            <div className="rounded-card border border-line p-4 text-center">
              <div className="text-2xl font-extrabold text-ink">
                {creatorProfile.avg_reach?.toLocaleString("es-CR") ?? "—"}
              </div>
              <div className="text-xs text-ink-soft">Alcance promedio</div>
            </div>
          </div>
        </section>
      )}

      {skills && skills.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold text-ink">Habilidades</h2>
          <div className="flex flex-col gap-2">
            {skills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-ink">{skill.name}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={`h-2.5 w-2.5 rounded-full ${
                        i <= skill.level ? "bg-violet" : "bg-lavender-deep"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {brandsByCategory.size > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold text-ink">Marcas con las que ha trabajado</h2>
          <div className="flex flex-col gap-3">
            {[...brandsByCategory.entries()].map(([category, brands]) => (
              <div key={category} className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">{category}</span>
                {brands.map((brand) => (
                  <span
                    key={brand}
                    className="rounded-pill bg-lavender px-3 py-1 text-xs font-semibold text-violet-deep"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {portfolioItems && portfolioItems.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold text-ink">Book</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {portfolioItems.map((item) => {
              const url = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(item.storage_path)
                .data.publicUrl;
              return (
                <div
                  key={item.id}
                  className="aspect-square overflow-hidden rounded-card border border-line bg-lavender"
                >
                  {item.media_type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={item.caption ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    <video src={url} className="h-full w-full object-cover" muted playsInline />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {((services && services.length > 0) || (addons && addons.length > 0)) && (
        <section className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
          {services && services.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-extrabold text-ink">Servicios</h2>
              <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
                {services.map((s) => (
                  <li key={s.id}>· {s.service}</li>
                ))}
              </ul>
            </div>
          )}
          {addons && addons.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-extrabold text-ink">Add-ons</h2>
              <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
                {addons.map((a) => (
                  <li key={a.id}>· {a.addon}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
