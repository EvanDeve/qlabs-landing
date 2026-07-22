import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

const OTHER_SYSTEMS = [
  {
    icon: "columns",
    name: "La Operación",
    desc: "Reservas, WhatsApp Business, CRM y automatización de respuestas.",
  },
  {
    icon: "doc",
    name: "La Vitrina",
    desc: "Página web que convierte, SEO local, Google Business y contenido para redes.",
  },
  {
    icon: "users",
    name: "Loyalty Loop",
    desc: "Seguimiento, cumpleaños y referidos para que los clientes regresen.",
  },
  {
    icon: "sparkle",
    name: "IA & Automatización",
    desc: "Asistentes de IA para reservas y chatbots de WhatsApp entrenados para tu negocio.",
  },
  {
    icon: "flag",
    name: "Crecimiento & Estrategia",
    desc: "Meta / Google / TikTok Ads, campañas de reseñas y estrategia de contenido.",
  },
];

export default async function MarcaResumenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user!.id).single();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("brand_id", user!.id);

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: applications } = campaignIds.length
    ? await supabase.from("applications").select("id, status, created_at").in("campaign_id", campaignIds)
    : { data: [] };

  const activeCampaigns = (campaigns ?? []).filter(
    (c) => c.status === "published" || c.status === "in_progress"
  ).length;
  const pendingApplicants = (applications ?? []).filter(
    (a) => a.status === "pending" || a.status === "reviewing"
  ).length;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newApplicantsThisWeek = (applications ?? []).filter(
    (a) => new Date(a.created_at) >= sevenDaysAgo
  ).length;

  const kpis = [
    { label: "Campañas activas", value: activeCampaigns, icon: "megaphone", color: "#6d54f3" },
    { label: "Aplicantes por revisar", value: pendingApplicants, icon: "clock", color: "#c07414" },
    { label: "Aplicantes nuevos (7 días)", value: newApplicantsThisWeek, icon: "users", color: "#14a06a" },
  ];

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px", marginBottom: "4px" }}>
        Buenas, {profile?.display_name ?? "de vuelta"} 👋
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "24px" }}>
        Tu Centro de Mando en Q Labs — UGC·CRC es tu sistema activo hoy.
      </p>

      <div className={styles.kpiRow} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={styles.kpi}>
            <div className={styles.kTop}>
              <div className={styles.kIc} style={{ background: `${kpi.color}22`, color: kpi.color }}>
                <QosIcon name={kpi.icon} size={16} />
              </div>
              <div className={styles.kLabel}>{kpi.label}</div>
            </div>
            <div className={styles.kNum} style={{ color: kpi.color }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.sectionHead} style={{ marginTop: "30px" }}>
        <h2 className={styles.sectionHeadBig}>Mis sistemas</h2>
      </div>
      <div className={styles.cardsGrid}>
        <div className={`${styles.card} ${styles.cardPad} ${styles.sysCard}`}>
          <div className={styles.sysHead}>
            <span className={styles.sysIc}>
              <QosIcon name="megaphone" size={19} />
            </span>
            <h3>UGC·CRC</h3>
            <span className={`${styles.riskPill} ${styles.riskOk}`} style={{ marginLeft: "auto" }}>
              Activo
            </span>
          </div>
          <p className={styles.sysDesc}>
            Marketplace de creadores verificados: campañas, aplicantes y contenido real.
          </p>
          <div className={styles.sysFoot}>
            <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>
              {activeCampaigns} campaña{activeCampaigns === 1 ? "" : "s"} activa{activeCampaigns === 1 ? "" : "s"}
            </span>
            <Link href="/ugc/marca/ugc" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
              Abrir panel
            </Link>
          </div>
        </div>

        {OTHER_SYSTEMS.map((sys) => (
          <div key={sys.name} className={`${styles.card} ${styles.cardPad} ${styles.sysCard}`}>
            <div className={styles.sysHead}>
              <span className={styles.sysIc}>
                <QosIcon name={sys.icon} size={19} />
              </span>
              <h3>{sys.name}</h3>
              <span className={`${styles.riskPill} ${styles.riskMuted}`} style={{ marginLeft: "auto" }}>
                Conocé más
              </span>
            </div>
            <p className={styles.sysDesc}>{sys.desc}</p>
            <div className={styles.sysFoot}>
              <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>Otro sistema de Q Labs</span>
              <a
                href="https://qlabsmethod.com"
                target="_blank"
                rel="noreferrer"
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              >
                Conocé más
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
