import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateHeroProfileAction } from "@/lib/actions/heroes";
import { CONTENT_STAGE_LABEL } from "@/lib/ugc/content-stage";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "../../qos.module.css";

export const dynamic = "force-dynamic";

const PALETTE = ["#6d54f3", "#c0392b", "#2aa5c0", "#3f8f4f", "#b3487f", "#8a5a2b", "#1f9ac9", "#b8442f", "#5a5f6d"];
function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default async function HeroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("profile_id, brand_name, industry, website")
    .eq("profile_id", id)
    .single();

  if (!brand) notFound();

  const [{ data: hero }, { data: contentPieces }] = await Promise.all([
    supabase.from("hero_profiles").select("*").eq("profile_id", id).maybeSingle(),
    supabase
      .from("content_pieces")
      .select("id, code, title, stage, publish_date")
      .eq("brand_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const activeCount = (contentPieces ?? []).filter((p) => p.stage !== "publicado").length;
  const publishedCount = (contentPieces ?? []).filter((p) => p.stage === "publicado").length;

  return (
    <div>
      <Link href="/ugc/admin/heroes" className={styles.backBtn}>
        <QosIcon name="chevL" size={14} /> Heroes
      </Link>

      <div className={styles.dossierHd}>
        <div className={styles.dsrRow}>
          <span className={styles.dsrMono} style={{ background: colorFor(brand.profile_id) }}>
            {brand.brand_name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className={styles.dsrId}>EXPEDIENTE HERO</div>
            <div className={styles.dsrName}>{brand.brand_name}</div>
            <div className={styles.dsrInd}>
              {brand.industry ?? "Sin industria"} {brand.website && `· ${brand.website}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: "26px", marginLeft: "auto", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, color: "#fff" }}>
                {activeCount}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(244,243,251,.55)" }}>Piezas activas</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, color: "#fff" }}>
                {publishedCount}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(244,243,251,.55)" }}>Publicadas</div>
            </div>
          </div>
        </div>
        {hero && (
          <div className={styles.dsrMeta}>
            <div>
              <div className={styles.dmL}>Riesgo</div>
              <div className={styles.dmV}>{hero.risk}</div>
            </div>
            <div>
              <div className={styles.dmL}>Cliente desde</div>
              <div className={styles.dmV}>{hero.client_since ?? "—"}</div>
            </div>
            <div>
              <div className={styles.dmL}>Contactos</div>
              <div className={styles.dmV}>{hero.contacts ?? "—"}</div>
            </div>
          </div>
        )}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "20px" }}>
        <div className={styles.sectionHead}>
          <h2>Datos de operación</h2>
        </div>
        <form action={updateHeroProfileAction}>
          <input type="hidden" name="profile_id" value={brand.profile_id} />

          <div className={styles.field}>
            <label>Objetivo</label>
            <textarea name="objetivo" defaultValue={hero?.objetivo ?? ""} rows={2} className={styles.inp} />
          </div>

          <div className={styles.field}>
            <label>Servicios contratados (separados por coma)</label>
            <input name="servicios" defaultValue={(hero?.servicios ?? []).join(", ")} className={styles.inp} />
          </div>

          <div className={styles.field}>
            <label>Contactos</label>
            <input name="contacts" defaultValue={hero?.contacts ?? ""} className={styles.inp} />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label>Estado de riesgo</label>
              <select name="risk" defaultValue={hero?.risk ?? "onboarding"} className={styles.inp}>
                <option value="onboarding">Onboarding</option>
                <option value="ok">Al día</option>
                <option value="warn">Atención</option>
                <option value="risk">En riesgo</option>
              </select>
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label>Cliente desde</label>
              <input type="date" name="client_since" defaultValue={hero?.client_since ?? ""} className={styles.inp} />
            </div>
          </div>

          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            Guardar
          </button>
        </form>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Piezas de contenido ({contentPieces?.length ?? 0})</h2>
        </div>
        {contentPieces && contentPieces.length > 0 ? (
          contentPieces.map((piece) => (
            <div key={piece.id} className={styles.attnItem} style={{ cursor: "default" }}>
              <div className={styles.attnBody}>
                <span className={styles.sopTag}>{piece.code}</span>
                <div className={styles.attnTitle} style={{ marginTop: "4px" }}>
                  {piece.title}
                </div>
              </div>
              <span className={styles.tag}>{CONTENT_STAGE_LABEL[piece.stage]}</span>
            </div>
          ))
        ) : (
          <div className={styles.empty}>Todavía no hay piezas para este Hero. Creá una desde el Pipeline.</div>
        )}
      </div>
    </div>
  );
}
