import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreatorProfileEditForm from "@/components/ugc/creador/CreatorProfileEditForm";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CreatorProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: creatorProfile },
    { data: profile },
    { data: skills },
    { data: pastBrands },
  ] = await Promise.all([
    supabase.from("creator_profiles").select("*").eq("profile_id", user!.id).single(),
    supabase.from("profiles").select("bio, city, avatar_url").eq("id", user!.id).single(),
    supabase.from("creator_skills").select("*").eq("creator_id", user!.id).order("position"),
    supabase.from("creator_past_brands").select("*").eq("creator_id", user!.id).order("position"),
  ]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 className={styles.tbTitle} style={{ fontSize: "26px" }}>
            Mi perfil
          </h1>
          <p style={{ marginTop: "4px", color: "var(--ink-2)" }}>
            Esto es lo que las marcas ven en tu perfil completo cuando aplicás a una campaña.
          </p>
        </div>
        {creatorProfile?.handle && (
          <Link
            href={`/ugc/creadores/${creatorProfile.handle.replace(/^@/, "")}`}
            className={`${styles.btn} ${styles.btnGhost}`}
            style={{ flexShrink: 0 }}
          >
            Ver perfil
          </Link>
        )}
      </div>

      <CreatorProfileEditForm
        initialProfile={{
          handle: creatorProfile?.handle ?? "",
          verified: creatorProfile?.verified ?? false,
          bio: profile?.bio ?? "",
          city: profile?.city ?? "",
          followers_count: creatorProfile?.followers_count ?? 0,
          niches: creatorProfile?.niches ?? [],
          languages: creatorProfile?.languages ?? ["es"],
          instagram_handle: creatorProfile?.instagram_handle ?? "",
          tiktok_handle: creatorProfile?.tiktok_handle ?? "",
          avatar_url: profile?.avatar_url ?? null,
        }}
        initialSkills={(skills ?? []).map((s) => ({ name: s.name, level: s.level }))}
        initialPastBrands={(pastBrands ?? []).map((b) => ({ category: b.category, brand_name: b.brand_name }))}
      />
    </div>
  );
}
