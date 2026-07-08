import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CONTENT_STAGE_LABEL } from "@/lib/ugc/content-stage";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "./qos.module.css";

export const dynamic = "force-dynamic";

const OVERLOAD_THRESHOLD = 6;

const KPI_COLORS = ["#6d54f3", "#df4650", "#c07414", "#14a06a"];
const KPI_ICONS = ["users", "alert", "check", "calendar"];

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    { data: agencyClients },
    { data: contentPieces },
    { data: staffMembers },
    { data: calendarEvents },
  ] = await Promise.all([
    supabase.from("agency_clients").select("*"),
    supabase.from("content_pieces").select("*").order("publish_date", { ascending: true }),
    supabase.from("staff_members").select("profile_id, staff_role, color").eq("active", true),
    supabase
      .from("calendar_events")
      .select("*")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", in7Days.toISOString()),
  ]);

  const brandNameByProfileId = new Map((agencyClients ?? []).map((c) => [c.id, c.name]));

  const staffIds = (staffMembers ?? []).map((s) => s.profile_id);
  const { data: staffAccountProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", staffIds)
    : { data: [] };
  const staffNameById = new Map((staffAccountProfiles ?? []).map((p) => [p.id, p.display_name]));

  const pieces = contentPieces ?? [];
  const activePieces = pieces.filter((p) => p.stage !== "publicado");

  const heroesManaged = agencyClients ?? [];

  const overduePieces = activePieces.filter((p) => p.publish_date && new Date(p.publish_date) < now);
  const pendingApprovalPieces = activePieces.filter(
    (p) => p.stage === "aprobacion_guion" || p.stage === "revision_cliente"
  );
  const publishingThisWeekPieces = pieces.filter(
    (p) => p.publish_date && new Date(p.publish_date) >= now && new Date(p.publish_date) <= in7Days
  );

  const kpis = [
    { label: "Heroes", value: heroesManaged.length },
    { label: "Piezas atrasadas", value: overduePieces.length },
    { label: "Pend. aprobación", value: pendingApprovalPieces.length },
    { label: "Publican esta semana", value: publishingThisWeekPieces.length },
  ];

  const attentionItems = [
    ...overduePieces.map((p) => ({ piece: p, reason: "Publicación vencida", late: true })),
    ...pendingApprovalPieces
      .filter((p) => !overduePieces.includes(p))
      .map((p) => ({ piece: p, reason: "Esperando aprobación del cliente", late: false })),
  ].sort((a, b) => {
    const aDate = a.piece.publish_date ? new Date(a.piece.publish_date).getTime() : Infinity;
    const bDate = b.piece.publish_date ? new Date(b.piece.publish_date).getTime() : Infinity;
    return aDate - bDate;
  });

  const weekAgendaItems = [
    ...pieces
      .filter((p) => p.publish_date && new Date(p.publish_date) >= now && new Date(p.publish_date) <= in7Days)
      .map((p) => ({ date: p.publish_date as string, title: p.title, type: "Publicación", brandId: p.brand_id })),
    ...pieces
      .filter((p) => p.record_date && new Date(p.record_date) >= now && new Date(p.record_date) <= in7Days)
      .map((p) => ({ date: p.record_date as string, title: p.title, type: "Grabación", brandId: p.brand_id })),
    ...(calendarEvents ?? []).map((e) => ({
      date: e.starts_at,
      title: e.title,
      type: e.type,
      brandId: e.brand_id,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const teamLoad = (staffMembers ?? []).map((staff) => {
    const count = activePieces.filter((p) => p.owner_id === staff.profile_id).length;
    return {
      profileId: staff.profile_id,
      name: staffNameById.get(staff.profile_id) ?? "Sin nombre",
      role: STAFF_ROLE_LABEL[staff.staff_role],
      color: staff.color,
      count,
      overloaded: count > OVERLOAD_THRESHOLD,
    };
  });

  const maxLoad = Math.max(1, ...teamLoad.map((t) => t.count));
  const overloadedStaff = teamLoad.filter((t) => t.overloaded);

  return (
    <div>
      <div className={styles.kpiRow}>
        {kpis.map((kpi, i) => (
          <div key={kpi.label} className={styles.kpi}>
            <div className={styles.kTop}>
              <div className={styles.kIc} style={{ background: `${KPI_COLORS[i]}22`, color: KPI_COLORS[i] }}>
                <QosIcon name={KPI_ICONS[i]} size={16} />
              </div>
              <div className={styles.kLabel}>{kpi.label}</div>
            </div>
            <div className={styles.kNum} style={{ color: KPI_COLORS[i] }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.dashGrid}>
        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionHeadBig}>Requiere tu atención</h2>
              <span className={`${styles.chip} ${styles.riskRisk}`}>{attentionItems.length} items</span>
            </div>
            {attentionItems.length > 0 ? (
              attentionItems.map(({ piece, reason, late }) => (
                <Link key={piece.id} href={`/ugc/admin/heroes/${piece.brand_id}`} className={styles.attnItem}>
                  <div className={styles.attnBar} style={{ background: late ? "var(--risk)" : "var(--warn)" }} />
                  <div className={styles.attnBody}>
                    <div className={styles.attnTitle}>{piece.title}</div>
                    <div className={styles.attnMeta}>
                      <span>{brandNameByProfileId.get(piece.brand_id)}</span>
                      <span>·</span>
                      <span style={{ color: late ? "var(--risk)" : "var(--warn)", fontWeight: 600 }}>{reason}</span>
                    </div>
                  </div>
                  <div className={styles.attnRight}>
                    <span className={styles.tag}>{CONTENT_STAGE_LABEL[piece.stage]}</span>
                    <QosIcon name="chevR" size={16} />
                  </div>
                </Link>
              ))
            ) : (
              <div className={styles.empty}>Nada pendiente por ahora.</div>
            )}
          </div>

          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2>Estado de las cuentas</h2>
            </div>
            <table className={styles.acctTable}>
              <thead>
                <tr>
                  <th>Hero</th>
                  <th>Etapa actual</th>
                  <th>Próx. publicación</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {heroesManaged.map((hero) => {
                  const heroPieces = pieces.filter((p) => p.brand_id === hero.id);
                  const activeHeroPieces = heroPieces.filter((p) => p.stage !== "publicado");
                  const nextPublish = heroPieces
                    .filter((p) => p.publish_date && new Date(p.publish_date) >= now)
                    .sort((a, b) => new Date(a.publish_date!).getTime() - new Date(b.publish_date!).getTime())[0];

                  return (
                    <tr key={hero.id}>
                      <td>
                        <Link href={`/ugc/admin/heroes/${hero.id}`} className={styles.acctHero}>
                          {hero.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={hero.logo_url} alt={hero.name} className={styles.heroMono} style={{ objectFit: "cover" }} />
                          ) : (
                            <span className={styles.heroMono} style={{ background: staffColorFromString(hero.id) }}>
                              {hero.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          {hero.name}
                        </Link>
                      </td>
                      <td>
                        {activeHeroPieces.length > 0 ? CONTENT_STAGE_LABEL[activeHeroPieces[0].stage] : "Sin piezas"}
                      </td>
                      <td style={{ color: "var(--ink-2)" }}>
                        {nextPublish
                          ? new Date(nextPublish.publish_date!).toLocaleDateString("es-CR", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--ink-3)" }}>
                        <QosIcon name="chevR" size={16} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2>Esta semana</h2>
            </div>
            {weekAgendaItems.length > 0 ? (
              weekAgendaItems.map((item, i) => (
                <div key={i} className={styles.weekRow}>
                  <div className={styles.weekWhen}>
                    {new Date(item.date).toLocaleDateString("es-CR", { day: "numeric", month: "short" })}
                  </div>
                  <span className={styles.weekType} style={{ background: "#6d54f3" }} />
                  <div className={styles.weekBody}>
                    {item.title}
                    <small>
                      {item.type}
                      {item.brandId && ` · ${brandNameByProfileId.get(item.brandId)}`}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No hay eventos en los próximos 7 días.</div>
            )}
          </div>

          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2>Carga del equipo</h2>
            </div>
            {teamLoad.map((t) => (
              <div key={t.profileId} className={styles.loadRow}>
                <div className={styles.lrName}>
                  <span className={styles.avSm} style={{ background: t.color, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 }}>
                    {t.name.charAt(0).toUpperCase()}
                  </span>
                  {t.name}
                </div>
                <div className={styles.loadTrack}>
                  <div
                    className={styles.loadFill}
                    style={{
                      width: `${Math.min(100, (t.count / maxLoad) * 100)}%`,
                      background: t.overloaded ? "var(--risk)" : "var(--b-500)",
                    }}
                  />
                </div>
                <div className={styles.loadVal}>{t.count} piezas</div>
              </div>
            ))}
            {overloadedStaff.length > 0 && (
              <div style={{ fontSize: "11.5px", color: "var(--ink-3)", marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <QosIcon name="alert" size={13} />
                {overloadedStaff.map((t) => t.name).join(", ")} con más de {OVERLOAD_THRESHOLD} piezas activas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function staffColorFromString(input: string): string {
  const palette = ["#6d54f3", "#c0392b", "#2aa5c0", "#3f8f4f", "#b3487f", "#8a5a2b", "#1f9ac9"];
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
