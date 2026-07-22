import { createClient } from "@/lib/supabase/server";
import PortfolioUploadForm from "@/components/ugc/creador/PortfolioUploadForm";
import PortfolioGrid from "@/components/ugc/creador/PortfolioGrid";
import { PORTFOLIO_BUCKET } from "@/lib/ugc/portfolio";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CreatorBookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: items }, { data: applications }] = await Promise.all([
    supabase
      .from("portfolio_items")
      .select("*")
      .eq("creator_id", user!.id)
      .order("position", { ascending: true }),
    supabase.from("applications").select("status, rating").eq("creator_id", user!.id),
  ]);

  const tiles = (items ?? []).map((item) => ({
    id: item.id,
    url: supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(item.storage_path).data.publicUrl,
    media_type: item.media_type,
    category: item.category,
    caption: item.caption,
    views: item.views,
  }));

  const totalViews = tiles.reduce((sum, t) => sum + (t.views ?? 0), 0);
  const piecesDelivered = (applications ?? []).filter(
    (a) => a.status === "delivered" || a.status === "approved"
  ).length;
  const ratings = (applications ?? []).map((a) => a.rating).filter((r): r is number => r != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

  const stats = [
    {
      label: "Views totales del book",
      value: totalViews > 0 ? totalViews.toLocaleString("es-CR") : "—",
      icon: "sparkle",
      color: "#6d54f3",
    },
    { label: "Piezas entregadas", value: piecesDelivered, icon: "check", color: "#14a06a" },
    {
      label: "Rating promedio de marcas",
      value: avgRating != null ? `${avgRating.toFixed(1)}★` : "Sin calificar",
      icon: "flag",
      color: "#c07414",
    },
  ];

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px" }}>
        Mi book
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "20px" }}>
        Las marcas ven tu book al revisar tu aplicación — mantenelo actualizado con tus mejores piezas.
      </p>

      <div className={styles.kpiRow} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {stats.map((s) => (
          <div key={s.label} className={styles.kpi}>
            <div className={styles.kTop}>
              <div className={styles.kIc} style={{ background: `${s.color}22`, color: s.color }}>
                <QosIcon name={s.icon} size={16} />
              </div>
              <div className={styles.kLabel}>{s.label}</div>
            </div>
            <div className={styles.kNum} style={{ color: s.color, fontSize: "26px" }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.sectionHead} style={{ marginTop: "28px" }}>
        <h2 className={styles.sectionHeadBig}>Piezas</h2>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <PortfolioUploadForm />
      </div>

      <PortfolioGrid items={tiles} />
    </div>
  );
}
