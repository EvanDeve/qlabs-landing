import { createClient } from "@/lib/supabase/server";
import PerfilEditor from "@/components/ugc/creador/PerfilEditor";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CreatorProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: creatorProfile }, { data: profile }, { data: skills }, { data: pastBrands }] =
    await Promise.all([
      supabase.from("creator_profiles").select("*").eq("profile_id", user!.id).single(),
      supabase.from("profiles").select("bio, city, avatar_url").eq("id", user!.id).single(),
      supabase.from("creator_skills").select("*").eq("creator_id", user!.id).order("position"),
      supabase.from("creator_past_brands").select("*").eq("creator_id", user!.id).order("position"),
    ]);

  return (
    <div>
      <div className={styles.feedHead}>
        <h1 className={styles.feedTitle}>Mi perfil</h1>
        <p className={styles.feedSub}>Esto es lo que ven las marcas cuando aplicás.</p>
      </div>

      <PerfilEditor
        inicial={{
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
        skillsIniciales={(skills ?? []).map((s) => ({ name: s.name, level: s.level }))}
        marcasIniciales={(pastBrands ?? []).map((b) => ({
          category: b.category,
          brand_name: b.brand_name,
        }))}
      />
    </div>
  );
}
