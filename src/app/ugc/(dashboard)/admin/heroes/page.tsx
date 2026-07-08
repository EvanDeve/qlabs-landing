import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setHeroManagedAction, deleteHeroAction } from "@/lib/actions/heroes";
import { CONTENT_STAGE_LABEL } from "@/lib/ugc/content-stage";
import { HERO_RISK_LABEL } from "@/lib/ugc/content-meta";
import NewHeroButton from "@/components/ugc/admin/NewHeroButton";
import ConfirmDeleteButton from "@/components/ugc/admin/ConfirmDeleteButton";
import styles from "../qos.module.css";

export const dynamic = "force-dynamic";

const RISK_CLASS: Record<string, string> = {
  onboarding: "riskOnb",
  ok: "riskOk",
  warn: "riskWarn",
  risk: "riskRisk",
};

const PALETTE = ["#6d54f3", "#c0392b", "#2aa5c0", "#3f8f4f", "#b3487f", "#8a5a2b", "#1f9ac9", "#b8442f", "#5a5f6d"];
function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default async function HeroesPage() {
  const supabase = await createClient();

  const { data: brandProfiles } = await supabase
    .from("brand_profiles")
    .select("profile_id, brand_name, industry")
    .order("brand_name", { ascending: true });

  const brandIds = (brandProfiles ?? []).map((b) => b.profile_id);

  const [{ data: heroProfiles }, { data: contentPieces }] = await Promise.all([
    brandIds.length
      ? supabase.from("hero_profiles").select("*").in("profile_id", brandIds)
      : Promise.resolve({ data: [] }),
    brandIds.length
      ? supabase.from("content_pieces").select("brand_id, stage, publish_date").in("brand_id", brandIds)
      : Promise.resolve({ data: [] }),
  ]);

  const heroByProfileId = new Map((heroProfiles ?? []).map((h) => [h.profile_id, h]));

  const latestStageByBrandId = new Map<string, string>();
  const nextPublishByBrandId = new Map<string, string>();
  for (const piece of contentPieces ?? []) {
    if (piece.stage !== "publicado") latestStageByBrandId.set(piece.brand_id, piece.stage);
    if (piece.publish_date && new Date(piece.publish_date) >= new Date()) {
      const current = nextPublishByBrandId.get(piece.brand_id);
      if (!current || piece.publish_date < current) nextPublishByBrandId.set(piece.brand_id, piece.publish_date);
    }
  }

  return (
    <div>
      <NewHeroButton />
      <div className={styles.heroCards}>
        {(brandProfiles ?? []).map((brand) => {
          const hero = heroByProfileId.get(brand.profile_id);
          const isManaged = hero?.is_managed ?? false;
          const stage = latestStageByBrandId.get(brand.profile_id);
          const nextPublish = nextPublishByBrandId.get(brand.profile_id);
          const color = colorFor(brand.profile_id);

          return (
            <div key={brand.profile_id} className={styles.hcard}>
              <Link href={`/ugc/admin/heroes/${brand.profile_id}`}>
                <div className={styles.hcardTop}>
                  <span className={styles.hcardMono} style={{ background: color }}>
                    {brand.brand_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className={styles.hcardName}>{brand.brand_name}</div>
                    <div className={styles.hcardInd}>{brand.industry ?? "Sin industria"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {isManaged && hero && (
                    <span className={`${styles.riskPill} ${styles[RISK_CLASS[hero.risk]]}`}>
                      {HERO_RISK_LABEL[hero.risk]}
                    </span>
                  )}
                  {stage && <span className={styles.tag}>{CONTENT_STAGE_LABEL[stage as keyof typeof CONTENT_STAGE_LABEL]}</span>}
                </div>
                <div className={styles.hcardFoot}>
                  <span style={{ fontSize: "11.5px", color: "var(--ink-3)" }}>
                    {isManaged ? "Hero gestionado" : "No gestionado"}
                  </span>
                  {nextPublish && (
                    <span style={{ marginLeft: "auto", fontSize: "11.5px", color: "var(--ink-2)" }}>
                      Próx.{" "}
                      <b style={{ color: "var(--ink)", fontWeight: 600 }}>
                        {new Date(nextPublish).toLocaleDateString("es-CR", { day: "numeric", month: "short" })}
                      </b>
                    </span>
                  )}
                </div>
              </Link>
              <form action={setHeroManagedAction} style={{ marginTop: "12px" }}>
                <input type="hidden" name="profile_id" value={brand.profile_id} />
                <input type="hidden" name="is_managed" value={(!isManaged).toString()} />
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnSm} ${isManaged ? styles.btnGhost : styles.btnPrimary}`}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {isManaged ? "Quitar de Heroes" : "Marcar Hero"}
                </button>
              </form>
              <ConfirmDeleteButton
                action={deleteHeroAction.bind(null, brand.profile_id)}
                confirmMessage={`¿Borrar definitivamente a ${brand.brand_name}? Esto elimina la cuenta, sus campañas, piezas y eventos. No se puede deshacer.`}
                className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
                style={{ width: "100%", justifyContent: "center", marginTop: "8px" }}
              >
                Borrar Hero
              </ConfirmDeleteButton>
            </div>
          );
        })}
      </div>
    </div>
  );
}
