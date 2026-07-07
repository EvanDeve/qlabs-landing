import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreatorProfileEditForm from "@/components/ugc/creador/CreatorProfileEditForm";

export const dynamic = "force-dynamic";

export default async function CreatorProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: creatorProfile },
    { data: skills },
    { data: services },
    { data: addons },
    { data: pastBrands },
  ] = await Promise.all([
    supabase.from("creator_profiles").select("*").eq("profile_id", user!.id).single(),
    supabase.from("creator_skills").select("*").eq("creator_id", user!.id).order("position"),
    supabase.from("creator_services").select("*").eq("creator_id", user!.id),
    supabase.from("creator_addons").select("*").eq("creator_id", user!.id),
    supabase.from("creator_past_brands").select("*").eq("creator_id", user!.id).order("position"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Mi perfil</h1>
          <p className="mt-1 text-ink-soft">
            Esto es lo que las marcas ven en tu perfil completo cuando aplicás a una campaña.
          </p>
        </div>
        {creatorProfile?.handle && (
          <Link
            href={`/ugc/creadores/${creatorProfile.handle}`}
            className="shrink-0 rounded-pill border border-line px-5 py-2.5 text-sm font-bold text-ink transition hover:border-ink"
          >
            Ver perfil
          </Link>
        )}
      </div>

      <CreatorProfileEditForm
        initialSkills={(skills ?? []).map((s) => ({ name: s.name, level: s.level }))}
        initialServices={(services ?? []).map((s) => s.service)}
        initialAddons={(addons ?? []).map((a) => a.addon)}
        initialPastBrands={(pastBrands ?? []).map((b) => ({ category: b.category, brand_name: b.brand_name }))}
        initialMetrics={{
          avg_views: creatorProfile?.avg_views ?? null,
          engagement_rate: creatorProfile?.engagement_rate ?? null,
          avg_reach: creatorProfile?.avg_reach ?? null,
        }}
      />
    </div>
  );
}
