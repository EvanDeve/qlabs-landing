import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import CompartirPagina from "@/components/ugc/CompartirPagina";
import { entregablesEnLinea } from "@/lib/ugc/deliverables";
import {
  USAGE_SCOPE_LABEL,
  USAGE_DURATION_LABEL,
  isUsageScope,
  isUsageDuration,
} from "@/lib/ugc/usage-rights";

export const dynamic = "force-dynamic";

async function loadBrand(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("brand_public_profiles").select("*").eq("slug", slug).maybeSingle();
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

/** "hace 2 días" — la antigüedad de la promo, que dice si sigue fresca. */
function hace(iso: string | null): string | null {
  if (!iso) return null;
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

type PromoPublica = {
  id: string;
  title: string;
  deliverables: unknown;
  published_at: string | null;
  brief: string | null;
  deadline_days: number | null;
  target_audience: string | null;
  compensation_details: string | null;
  usage_rights_scope: string | null;
  usage_rights_duration: string | null;
};

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
  // `campaigns`. Desde 2026-08-26 devuelve el brief entero —plazo, audiencia y
  // derechos incluidos— y sigue SIN devolver el monto: el pago es lo único que
  // exige cuenta de creador. Ver la migración `promo_publica_completa`.
  const { data } = await supabase.rpc("brand_public_campaigns", { p_slug: slug });
  const promos: PromoPublica[] = data ?? [];

  const igHandle = brand.instagram_handle?.replace(/^@/, "");
  const sitio = brand.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-lavender/40 pb-20">
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <div className="flex items-center justify-between">
          <Link href="/ugc" className="flex items-center gap-2 text-sm font-extrabold text-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon-logo.png" alt="Q Labs" className="h-6 w-6 rounded-md object-cover" />
            UGC·CRC
          </Link>
          <CompartirPagina titulo={`${brand.brand_name} en UGC·CRC`} />
        </div>

        {/* ---- Identidad ---- */}
        <div className="mt-7 flex items-start gap-4">
          <BrandAvatar name={brand.brand_name} logoUrl={brand.logo_url} size={72} radius={20} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[27px] font-extrabold leading-[1.12] tracking-[-0.03em] text-ink">
              {brand.brand_name}
            </h1>
            {brand.verified && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-trust">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" opacity=".2" />
                  <path
                    d="m8.5 12 2.5 2.5 5-5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
                Marca verificada por Q Labs
              </p>
            )}
            {(brand.location || brand.industry) && (
              <p className="mt-1 text-sm text-ink-soft">
                {[brand.location, brand.industry].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {brand.description && (
          <p className="mt-4 text-[15px] leading-relaxed text-ink">{brand.description}</p>
        )}

        {(sitio || igHandle) && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {sitio && (
              <a
                href={brand.website ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-pill border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:border-violet hover:text-violet"
              >
                {sitio}
              </a>
            )}
            {igHandle && (
              <a
                href={`https://instagram.com/${igHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-pill border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:border-violet hover:text-violet"
              >
                {igHandle}
              </a>
            )}
          </div>
        )}

        {/* ---- Promos ---- */}
        <div className="mt-9 flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink">Promos abiertas</h2>
          <span className="text-sm font-semibold text-ink-soft">{promos.length}</span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {promos.length > 0
            ? "Registrate como creador para ver el pago y aplicar."
            : "Ahora mismo no hay ninguna abierta."}
        </p>

        <div className="mt-4 space-y-4">
          {promos.map((p) => {
            const entregables = entregablesEnLinea(p.deliverables);
            const derechos = [
              isUsageScope(p.usage_rights_scope ?? "")
                ? USAGE_SCOPE_LABEL[p.usage_rights_scope as never]
                : null,
              isUsageDuration(p.usage_rights_duration ?? "")
                ? USAGE_DURATION_LABEL[p.usage_rights_duration as never]
                : null,
            ]
              .filter(Boolean)
              .join(" · ");

            // Solo se dibujan las que tienen dato: una tabla con cuatro filas
            // en blanco se lee como una promo a medio escribir.
            const filas: [string, string][] = [
              ["Entregables", entregables],
              ["Plazo", p.deadline_days ? `${p.deadline_days} días` : ""],
              ["Busca", p.target_audience ?? ""],
              ["Derechos de uso", derechos],
            ].filter(([, v]) => Boolean(v)) as [string, string][];

            return (
              <article
                key={p.id}
                className="rounded-card border border-line bg-paper p-5 shadow-[0_2px_10px_rgba(10,11,16,0.05)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[19px] font-extrabold leading-tight tracking-[-0.025em] text-ink">
                    {p.title}
                  </h3>
                  <span className="shrink-0 rounded-pill bg-trust-bg px-3 py-1 text-xs font-extrabold text-trust">
                    Abierta
                  </span>
                </div>

                {/* Solo la antigüedad. El mockup decía "cierra en N días" y ese
                    dato NO existe: `deadline_days` es el PLAZO DE ENTREGA una
                    vez que la marca acepta —en todo el resto del código se
                    rotula "días de plazo"—, no cuándo se cierran las
                    aplicaciones. Una campaña publicada no tiene fecha de
                    cierre. El plazo real ya está en la tabla de abajo. */}
                <p className="mt-1.5 text-[13px] text-ink-soft">
                  {hace(p.published_at) && `Publicada ${hace(p.published_at)}`}
                </p>

                {p.brief && (
                  <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">
                    {p.brief}
                  </p>
                )}

                {filas.length > 0 && (
                  <dl className="mt-4 overflow-hidden rounded-xl bg-lavender/60">
                    {filas.map(([k, v], i) => (
                      <div
                        key={k}
                        className={`flex items-baseline justify-between gap-4 px-4 py-2.5 ${
                          i > 0 ? "border-t border-line/60" : ""
                        }`}
                      >
                        <dt className="text-[13.5px] text-ink-soft">{k}</dt>
                        <dd className="text-right text-[13.5px] font-bold text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {p.compensation_details && (
                  <p className="mt-3 flex gap-2.5 rounded-xl bg-trust-bg px-4 py-3 text-[13.5px] leading-snug text-ink">
                    <span className="mt-0.5 shrink-0 font-extrabold text-trust">+</span>
                    {p.compensation_details}
                  </p>
                )}

                <Link
                  href={`/ugc/login?intent=creador`}
                  className="mt-4 flex h-12 items-center justify-center rounded-pill bg-violet text-[15px] font-extrabold text-white transition hover:bg-violet-deep"
                >
                  Ver y aplicar
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
