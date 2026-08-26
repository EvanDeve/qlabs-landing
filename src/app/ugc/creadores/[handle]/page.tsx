import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_BUCKET } from "@/lib/ugc/portfolio";
import { computeTrustScore } from "@/lib/ugc/trust-score";
import { languageLabel } from "@/lib/ugc/languages";
import { displayHandle, handleSlug } from "@/lib/ugc/handles";
import TrustRing from "@/components/ugc/TrustRing";
import CreatorPublicBook from "@/components/ugc/creador/CreatorPublicBook";
import CompartirPagina from "@/components/ugc/CompartirPagina";

export const dynamic = "force-dynamic";

// Esta página se comparte como media-kit (link en bio de Instagram, WhatsApp).
// Sin esto heredaba el metadata del layout raíz y la previsualización del link
// mostraba el landing genérico de Q Labs en vez del perfil del creador.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const bare = handleSlug(handle);
  const supabase = await createClient();

  // Vista pública: legible por anon, sin exponer tarifas ni la tabla de cuentas.
  const { data: rows } = await supabase
    .from("creator_public_profiles")
    .select("*")
    .in("handle", [`@${bare}`, bare])
    .limit(1);
  const creator = rows?.[0];

  if (!creator) {
    return { title: "Creador no encontrado · UGC·CRC" };
  }

  const profile = creator;

  const shown = displayHandle(creator.handle);
  const title = `${shown} · Creador UGC en Costa Rica`;
  const description =
    profile?.bio?.trim() ||
    [
      creator.niches.length > 0 ? `Contenido de ${creator.niches.slice(0, 3).join(", ")}` : null,
      profile?.city,
      creator.followers_count > 0
        ? `${creator.followers_count.toLocaleString("es-CR")} seguidores`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Perfil de creador verificado en UGC·CRC.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: profile?.avatar_url ? [{ url: profile.avatar_url }] : undefined,
    },
    twitter: {
      card: profile?.avatar_url ? "summary_large_image" : "summary",
      title,
      description,
      images: profile?.avatar_url ? [profile.avatar_url] : undefined,
    },
  };
}

function socialUrl(kind: "instagram" | "tiktok", handle: string) {
  const clean = handle.replace(/^@/, "").trim();
  return kind === "instagram"
    ? `https://instagram.com/${clean}`
    : `https://tiktok.com/@${clean}`;
}

export default async function CreatorPublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const bareHandle = handle.replace(/^@/, "");
  const supabase = await createClient();

  // Tolera handles guardados con o sin "@" (data histórica inconsistente).
  const { data: creatorRows } = await supabase
    .from("creator_public_profiles")
    .select("*")
    .in("handle", [`@${bareHandle}`, bareHandle])
    .limit(1);
  const creatorProfile = creatorRows?.[0];

  if (!creatorProfile) {
    notFound();
  }

  // La vista ya trae display_name/bio/city/avatar_url, así que no hace falta
  // consultar `profiles` aparte (que además es privada para anon).
  const [{ data: skills }, { data: pastBrands }, { data: portfolioItems }] = await Promise.all([
    supabase.from("creator_skills").select("*").eq("creator_id", creatorProfile.profile_id).order("position"),
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

  const { data: statsRows } = await supabase.rpc("creator_public_stats", {
    p_creator_id: creatorProfile.profile_id,
  });
  const stats = statsRows?.[0];
  const deliveredCount = Number(stats?.delivered_count ?? 0);
  const approvedCount = Number(stats?.approved_count ?? 0);
  const ratingCount = Number(stats?.rating_count ?? 0);
  const avgRating = stats?.avg_rating != null ? Number(stats.avg_rating) : null;
  const onTimeRatio = stats?.on_time_ratio != null ? Number(stats.on_time_ratio) : null;

  const trustScore = computeTrustScore({
    verified: creatorProfile.verified,
    approvedCount,
    onTimeRatio,
  });

  const brandsByCategory = new Map<string, string[]>();
  for (const b of pastBrands ?? []) {
    const list = brandsByCategory.get(b.category) ?? [];
    list.push(b.brand_name);
    brandsByCategory.set(b.category, list);
  }

  const profile = creatorProfile;
  const displayName = profile.display_name ?? creatorProfile.handle;
  const initial = displayName.slice(0, 1).toUpperCase();

  const topStats: { value: string; label: string }[] = [
    {
      value: creatorProfile.followers_count.toLocaleString("es-CR"),
      label: "Seguidores",
    },
    {
      value: deliveredCount > 0 ? deliveredCount.toLocaleString("es-CR") : "—",
      label: "Trabajos entregados",
    },
    {
      value: avgRating != null ? `${avgRating.toFixed(1)}★` : "Nuevo",
      label: ratingCount > 0 ? `Rating (${ratingCount})` : "Rating de marcas",
    },
  ];

  return (
    <div className="min-h-screen bg-lavender/40 pb-20">
      <div className="mx-auto max-w-2xl px-5 pt-6">
        {/* Barra superior — sin "Volver" a propósito: esta página se comparte
            como media-kit (link en bio de Instagram, WhatsApp), y quien llega
            de afuera no tiene a dónde volver. La marca sí linkea al
            marketplace, que es la puerta de entrada para un negocio que cae
            acá desde el perfil de un creador. */}
        <div className="flex items-center justify-between">
          <Link
            href="/ugc"
            className="flex items-center gap-2 text-sm font-extrabold text-ink transition hover:text-violet"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon-logo.png" alt="Q Labs" className="h-6 w-6 rounded-md object-cover" />
            UGC·CRC
          </Link>
          <CompartirPagina titulo={`${displayHandle(creatorProfile.handle)} en UGC·CRC`} />
        </div>

        {/* Identidad. Antes era una tarjeta con banda de degradado y el avatar
            montado encima; se aplanó el 2026-08-26 para que las dos páginas
            públicas —esta y la de la marca— se lean como la misma cosa. */}
        <div className="mt-7">
          <div className="flex items-start gap-4">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-periwinkle to-violet-deep text-2xl font-extrabold text-white">
                  {initial}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[27px] font-extrabold leading-[1.12] tracking-[-0.03em] text-ink">
                {displayHandle(creatorProfile.handle)}
              </h1>
              {creatorProfile.verified && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-trust">
                  <i className="fa-solid fa-circle-check" aria-hidden /> Creador verificado
                </p>
              )}
              <p className="mt-1 text-sm text-ink-soft">
                {[
                  profile?.city,
                  `${creatorProfile.followers_count.toLocaleString("es-CR")} seguidores`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {approvedCount > 0 && (
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                <TrustRing score={trustScore} />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  Confianza
                </span>
              </div>
            )}
          </div>

            {profile?.bio && (
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">{profile.bio}</p>
            )}

            {(creatorProfile.niches.length > 0 || creatorProfile.languages.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {creatorProfile.niches.map((niche) => (
                  <span
                    key={niche}
                    className="rounded-pill bg-lavender px-3 py-1 text-xs font-semibold text-violet-deep"
                  >
                    {niche}
                  </span>
                ))}
                {creatorProfile.languages.map((lang) => (
                  <span
                    key={lang}
                    className="rounded-pill bg-trust-bg px-3 py-1 text-xs font-semibold text-trust"
                  >
                    {languageLabel(lang)}
                  </span>
                ))}
              </div>
            )}

            {/* Redes sociales */}
            {(creatorProfile.instagram_handle || creatorProfile.tiktok_handle) && (
              <div className="mt-5 flex flex-wrap gap-2.5">
                {creatorProfile.instagram_handle && (
                  <a
                    href={socialUrl("instagram", creatorProfile.instagram_handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink transition hover:border-violet hover:text-violet"
                  >
                    <i className="fa-brands fa-instagram text-base" aria-hidden />
                    {creatorProfile.instagram_handle}
                  </a>
                )}
                {creatorProfile.tiktok_handle && (
                  <a
                    href={socialUrl("tiktok", creatorProfile.tiktok_handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink transition hover:border-violet hover:text-violet"
                  >
                    <i className="fa-brands fa-tiktok text-base" aria-hidden />
                    {creatorProfile.tiktok_handle}
                  </a>
                )}
              </div>
            )}
        </div>

        {/* STATS de prueba social */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {topStats.map((s) => (
            <div key={s.label} className="rounded-card border border-line bg-white p-5 text-center">
              <div className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs font-medium text-ink-soft">{s.label}</div>
            </div>
          ))}
        </div>

        {/* BOOK */}
        {portfolioItems && portfolioItems.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-1 text-lg font-extrabold text-ink">Book</h2>
            <p className="mb-4 text-sm text-ink-soft">Sus mejores piezas — tocá para reproducir.</p>
            <CreatorPublicBook
              items={portfolioItems.map((item) => ({
                id: item.id,
                url: supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(item.storage_path).data.publicUrl,
                media_type: item.media_type,
                caption: item.caption,
              }))}
            />
          </section>
        )}

        {/* HABILIDADES */}
        {skills && skills.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-extrabold text-ink">Habilidades</h2>
            <div className="grid gap-2.5 rounded-card border border-line bg-white p-6 sm:grid-cols-2 sm:gap-x-8">
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

        {/* MARCAS */}
        {brandsByCategory.size > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-extrabold text-ink">Marcas con las que ha trabajado</h2>
            <div className="flex flex-col gap-3 rounded-card border border-line bg-white p-6">
              {[...brandsByCategory.entries()].map(([category, brands]) => (
                <div key={category} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    {category}
                  </span>
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

        {/* CTA para negocios */}
        <section className="mt-12 rounded-card bg-ink px-7 py-8 text-center text-white">
          <h2 className="text-xl font-extrabold tracking-tight">
            ¿Querés contenido así para tu negocio?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
            Publicá una campaña en UGC·CRC y creadores verificados como {displayHandle(creatorProfile.handle)}{" "}
            aplican a la tuya.
          </p>
          <Link
            href="/ugc"
            className="mt-5 inline-block rounded-pill bg-violet px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-deep"
          >
            Conocé UGC·CRC
          </Link>
        </section>
      </div>
    </div>
  );
}
