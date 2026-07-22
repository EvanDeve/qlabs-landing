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
