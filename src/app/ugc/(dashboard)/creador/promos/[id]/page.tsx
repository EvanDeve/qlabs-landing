import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ApplyForm from "@/components/ugc/creador/ApplyForm";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import { FORMAT_LABEL } from "@/lib/ugc/deliverables";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { creatorPayout } from "@/lib/ugc/payout";
import { hasUsageRights, usageRightsChips } from "@/lib/ugc/usage-rights";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function PromoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Solo campañas publicadas: el brief completo no puede verse desde una
  // campaña en borrador aunque se adivine el id (RLS ya lo respalda).
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!campaign) {
    notFound();
  }

  const [{ data: brand }, { data: application }, { data: creatorProfile }] = await Promise.all([
    supabase.from("brand_profiles").select("*").eq("profile_id", campaign.brand_id).maybeSingle(),
    supabase
      .from("applications")
      .select("status")
      .eq("campaign_id", campaign.id)
      .eq("creator_id", user!.id)
      .maybeSingle(),
    supabase.from("creator_profiles").select("verified").eq("profile_id", user!.id).single(),
  ]);

  const deliverables = Array.isArray(campaign.deliverables)
    ? (campaign.deliverables as { type: string; qty: number }[])
    : [];
  const payout = creatorPayout(campaign.budget_amount);
  const usageChips = usageRightsChips(campaign);
  const brandName = brand?.brand_name ?? "Marca";
  const igHandle = brand?.instagram_handle?.replace(/^@/, "");

  return (
    <div>
      {/* Botón, no link de texto: es la salida principal de esta página. */}
      <Link
        href="/ugc/creador/promos"
        className={`${styles.btn} ${styles.btnGhost}`}
        style={{ marginBottom: "16px" }}
      >
        <i className="fa-solid fa-arrow-left" aria-hidden /> Volver al feed
      </Link>

      <div className={styles.promoDetailGrid}>
        {/* ---------- La promo ---------- */}
        <div className={`${styles.card} ${styles.cardPad}`}>
          <h1 className={styles.tbTitle} style={{ fontSize: "24px", marginBottom: "6px" }}>
            {campaign.title}
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: "13px", marginBottom: "18px" }}>
            Publicada por {brandName}
            {brand?.location ? ` · ${brand.location}` : ""}
          </p>

          <div className={styles.promoFacts}>
            <div className={styles.promoFact}>
              <div className={styles.promoFactLabel}>Lo que cobrás</div>
              <div className={styles.promoFactValue}>₡{payout.toLocaleString("es-CR")}</div>
            </div>
            {campaign.deadline_days && (
              <div className={styles.promoFact}>
                <div className={styles.promoFactLabel}>Plazo</div>
                <div className={styles.promoFactValue}>{campaign.deadline_days} días</div>
              </div>
            )}
            {deliverables.length > 0 && (
              <div className={styles.promoFact}>
                <div className={styles.promoFactLabel}>Entregables</div>
                <div className={styles.promoFactValue}>
                  {deliverables.map((d) => `${d.qty}x ${FORMAT_LABEL[d.type] ?? d.type}`).join(", ")}
                </div>
              </div>
            )}
          </div>

          {campaign.compensation_details && (
            <p style={{ marginTop: "14px", fontSize: "13.5px", color: "var(--b-600)", fontWeight: 600 }}>
              + {campaign.compensation_details}
            </p>
          )}

          <h2 style={{ fontSize: "15px", margin: "22px 0 8px" }}>El brief</h2>
          <p className={styles.promoDetailBrief}>{campaign.brief}</p>

          {campaign.target_audience && (
            <>
              <h2 style={{ fontSize: "15px", margin: "22px 0 8px" }}>A quién busca</h2>
              <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                {campaign.target_audience}
              </p>
            </>
          )}

          {/* Va justo antes del botón de aplicar a propósito: es lo último que
              el creador debería leer antes de comprometerse. */}
          <h2 style={{ fontSize: "15px", margin: "22px 0 8px" }}>Derechos de uso</h2>
          {hasUsageRights(campaign) ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {usageChips.map((chip) => (
                  <span key={chip} className={styles.tag}>
                    {chip}
                  </span>
                ))}
              </div>
              <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                {brandName} puede usar la pieza en{" "}
                <b>{usageChips[0]?.toLowerCase()}</b> durante <b>{usageChips[1]?.toLowerCase()}</b>{" "}
                desde que aprueba la entrega, y{" "}
                {campaign.usage_rights_editing
                  ? "puede recortarla o reeditarla"
                  : "debe publicarla tal como se la entregás"}
                . Vos siempre podés publicarla en tu propio perfil.
              </p>
              {campaign.usage_rights_notes && (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.6 }}>
                  {campaign.usage_rights_notes}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.6 }}>
              Esta promo se publicó sin especificar derechos de uso. Antes de entregar, acordá con{" "}
              {brandName} dónde y por cuánto tiempo va a usar el contenido.
            </p>
          )}

          <div style={{ marginTop: "26px", borderTop: "1px solid var(--line)", paddingTop: "20px" }}>
            {application ? (
              <span
                className={`${styles.riskPill} ${styles["risk" + APPLICATION_STATUS_STYLE[application.status]]}`}
              >
                Ya aplicaste — {APPLICATION_STATUS_LABEL[application.status]}
              </span>
            ) : creatorProfile?.verified ? (
              <ApplyForm campaignId={campaign.id} />
            ) : (
              <div>
                <span className={`${styles.riskPill} ${styles.riskMuted}`}>Perfil en revisión</span>
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--ink-2)" }}>
                  Cuando verifiquemos tu perfil vas a poder aplicar a esta promo.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ---------- La marca ---------- */}
        <aside className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.brandCardHead}>
            <BrandAvatar name={brandName} logoUrl={brand?.logo_url} size={52} radius={14} />
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: "15px", display: "block" }}>
                {brandName}
                {brand?.verified && (
                  <i
                    className="fa-solid fa-circle-check"
                    title="Marca verificada"
                    style={{ marginLeft: "6px", color: "var(--ok)", fontSize: "12px" }}
                  />
                )}
              </b>
              <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>
                {[brand?.industry, brand?.location].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>

          {brand?.description && (
            <p style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--ink-2)" }}>{brand.description}</p>
          )}

          <div className={styles.brandCardLinks}>
            {brand?.slug && (
              <Link href={`/ugc/marcas/${brand.slug}`} className={styles.brandCardLink}>
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden /> Ver perfil de la marca
              </Link>
            )}
          </div>

          {(brand?.website || igHandle) && (
            <div className={styles.brandCardLinks}>
              {brand?.website && (
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.brandCardLink}
                >
                  <i className="fa-solid fa-globe" aria-hidden /> Sitio web
                </a>
              )}
              {igHandle && (
                <a
                  href={`https://instagram.com/${igHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.brandCardLink}
                >
                  <i className="fa-brands fa-instagram" aria-hidden /> @{igHandle}
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
