import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";

export const dynamic = "force-dynamic";

async function loadBrand(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("brand_profiles").select("*").eq("slug", slug).maybeSingle();
  return { supabase, brand: data };
}

// Página pensada para compartirse (un negocio la manda a creadores, o la pone
// en su bio para reclutar), así que necesita su propia previsualización.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { brand } = await loadBrand(slug);

  if (!brand) {
    return { title: "Marca no encontrada · UGC·CRC" };
  }

  const title = `${brand.brand_name} · Busca creadores en UGC·CRC`;
  const description =
    brand.description?.trim() ||
    [brand.industry, brand.location].filter(Boolean).join(" · ") ||
    "Perfil de marca en UGC·CRC.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: brand.logo_url ? [{ url: brand.logo_url }] : undefined,
    },
    twitter: {
      card: brand.logo_url ? "summary_large_image" : "summary",
      title,
      description,
      images: brand.logo_url ? [brand.logo_url] : undefined,
    },
  };
}

export default async function BrandPublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supabase, brand } = await loadBrand(slug);

  if (!brand) {
    notFound();
  }

  // Función security-definer: un visitante anónimo no tiene policy sobre
  // `campaigns`, y esto expone solo título y formatos — nunca brief ni monto.
  const { data: promos } = await supabase.rpc("brand_public_campaigns", { p_slug: slug });
  const igHandle = brand.instagram_handle?.replace(/^@/, "");

  return (
    <div className="min-h-screen bg-lavender/40 pb-20">
      <div className="mx-auto max-w-4xl px-6 pt-8">
        <div className="flex items-center">
          <Link
            href="/ugc"
            className="flex items-center gap-2 text-sm font-extrabold text-ink transition hover:text-violet"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon-logo.png" alt="Q Labs" className="h-6 w-6 rounded-md object-cover" />
            UGC·CRC
          </Link>
        </div>

        {/* HERO */}
        <div className="mt-6 overflow-hidden rounded-card border border-line bg-white">
          <div className="h-28 bg-gradient-to-br from-violet via-periwinkle to-violet-deep" />
          <div className="px-7 pb-7">
            <div className="-mt-12">
              <div className="inline-block rounded-2xl ring-4 ring-white">
                <BrandAvatar name={brand.brand_name} logoUrl={brand.logo_url} size={96} radius={16} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-ink">{brand.brand_name}</h1>
              {brand.verified && (
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-trust-bg px-3 py-1 text-xs font-bold text-trust">
                  <i className="fa-solid fa-circle-check" aria-hidden /> Marca verificada
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
              {brand.industry && <span>{brand.industry}</span>}
              {brand.location && (
                <span>
                  <i className="fa-solid fa-location-dot" aria-hidden /> {brand.location}
                </span>
              )}
            </div>

            {brand.description && (
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
                {brand.description}
              </p>
            )}

            {(brand.website || igHandle) && (
              <div className="mt-5 flex flex-wrap gap-2.5">
                {brand.website && (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink transition hover:border-violet hover:text-violet"
                  >
                    <i className="fa-solid fa-globe text-base" aria-hidden /> Sitio web
                  </a>
                )}
                {igHandle && (
                  <a
                    href={`https://instagram.com/${igHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-sm font-bold text-ink transition hover:border-violet hover:text-violet"
                  >
                    <i className="fa-brands fa-instagram text-base" aria-hidden /> @{igHandle}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PROMOS ABIERTAS */}
        <section className="mt-10">
          <h2 className="mb-1 text-lg font-extrabold text-ink">Promos abiertas</h2>
          <p className="mb-4 text-sm text-ink-soft">
            {promos && promos.length > 0
              ? "Registrate como creador para ver el brief completo y aplicar."
              : "Ahora mismo no tiene promos abiertas."}
          </p>

          {promos && promos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {promos.map((promo) => (
                <div key={promo.id} className="rounded-card border border-line bg-white p-6">
                  <h3 className="text-base font-extrabold leading-snug text-ink">{promo.title}</h3>
                  {promo.deliverable_types && promo.deliverable_types.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {promo.deliverable_types.map((format) => (
                        <span
                          key={format}
                          className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-soft"
                        >
                          {FORMAT_LABEL[format] ?? format}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/ugc/creador/promos/${promo.id}`}
                    className="mt-5 block rounded-pill bg-violet px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-violet-deep"
                  >
                    Ver y aplicar
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CTA para creadores */}
        <section className="mt-12 rounded-card bg-ink px-7 py-8 text-center text-white">
          <h2 className="text-xl font-extrabold tracking-tight">¿Creás contenido en Costa Rica?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
            Registrate en UGC·CRC y aplicá a promos de {brand.brand_name} y de otras marcas
            costarricenses.
          </p>
          <Link
            href="/ugc/login?intent=creador"
            className="mt-5 inline-block rounded-pill bg-violet px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-deep"
          >
            Aplicá como creador
          </Link>
        </section>
      </div>
    </div>
  );
}
