import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteHeroAction } from "@/lib/actions/heroes";
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

  const { data: clients } = await supabase
    .from("agency_clients")
    .select("id, name, industry, logo_url, risk")
    .order("name", { ascending: true });

  const clientIds = (clients ?? []).map((c) => c.id);

  const { data: contentPieces } = clientIds.length
    ? await supabase.from("content_pieces").select("brand_id, stage, publish_date").in("brand_id", clientIds)
    : { data: [] };

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
        {(clients ?? []).map((client) => {
          const stage = latestStageByBrandId.get(client.id);
          const nextPublish = nextPublishByBrandId.get(client.id);
          const color = colorFor(client.id);

          return (
            <div key={client.id} className={styles.hcard}>
              <Link href={`/ugc/admin/heroes/${client.id}`}>
                <div className={styles.hcardTop}>
                  {client.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={client.logo_url} alt={client.name} className={styles.hcardMono} style={{ objectFit: "cover" }} />
                  ) : (
                    <span className={styles.hcardMono} style={{ background: color }}>
                      {client.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <div className={styles.hcardName}>{client.name}</div>
                    <div className={styles.hcardInd}>{client.industry ?? "Sin industria"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span className={`${styles.riskPill} ${styles[RISK_CLASS[client.risk]]}`}>
                    {HERO_RISK_LABEL[client.risk]}
                  </span>
                  {stage && <span className={styles.tag}>{CONTENT_STAGE_LABEL[stage as keyof typeof CONTENT_STAGE_LABEL]}</span>}
                </div>
                <div className={styles.hcardFoot}>
                  {nextPublish && (
                    <span style={{ fontSize: "11.5px", color: "var(--ink-2)" }}>
                      Próx.{" "}
                      <b style={{ color: "var(--ink)", fontWeight: 600 }}>
                        {new Date(nextPublish).toLocaleDateString("es-CR", { day: "numeric", month: "short" })}
                      </b>
                    </span>
                  )}
                </div>
              </Link>
              <ConfirmDeleteButton
                action={deleteHeroAction.bind(null, client.id)}
                confirmMessage={`¿Borrar definitivamente a ${client.name}? Esto elimina sus piezas y eventos. No se puede deshacer.`}
                className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
                style={{ width: "100%", justifyContent: "center", marginTop: "12px" }}
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
