import { notFound } from "next/navigation";
import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import VerificacionAcciones from "@/components/ugc/admin/VerificacionAcciones";
import { estadoCuenta } from "@/lib/ugc/estado-cuenta";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { estadoDeNivel, labelAccion, fechaCorta, COLOR_NIVEL, type Nivel } from "@/lib/ugc/loyalty";
import { creatorPayout } from "@/lib/ugc/payout";
import { displayHandle, handleSlug } from "@/lib/ugc/handles";
import { getUserEmail } from "@/lib/email/resend";
import { QosIcon } from "@/lib/ugc/qos-icons";
import type { ApplicationStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/** Una entrega está cobrada cuando la marca la aprobó; antes es plata en camino. */
const COBRADA: ApplicationStatus[] = ["approved"];
/** Estados en los que la marca ya eligió al creador. */
const ELEGIDO: ApplicationStatus[] = ["accepted", "delivered", "approved", "disputed"];

const ESTILO_CANJE: Record<string, { label: string; clase: string }> = {
  reclamado: { label: "Reclamado", clase: styles.riskWarn },
  canjeado: { label: "Canjeado", clase: styles.riskOk },
  expirado: { label: "Expirado", clase: styles.riskMuted },
};

const colones = (n: number) => `₡${n.toLocaleString("es-CR")}`;

/**
 * La ficha de un creador: todo lo que el equipo necesita saber de él en una
 * pantalla, para responder cuando escribe o decidir si se verifica.
 *
 * Es lectura, salvo la verificación (los mismos botones de Marketplace). No
 * hay notas internas: Evan lo dejó afuera a propósito (2026-10-07).
 */
export default async function FichaCreadorPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireArea("ugc");
  const { id } = await params;

  const { data: creador } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("profile_id", id)
    .maybeSingle();
  if (!creador) notFound();

  const [
    { data: perfil },
    email,
    { data: servicios },
    { data: addons },
    { data: habilidades },
    { data: marcasPasadas },
    { count: piezasBook },
    { data: aplicaciones },
    { data: eventos },
    { data: umbrales },
    { data: canjes },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url, city, bio, created_at")
      .eq("id", id)
      .maybeSingle(),
    getUserEmail(id),
    supabase.from("creator_services").select("service").eq("creator_id", id),
    supabase.from("creator_addons").select("addon").eq("creator_id", id),
    supabase.from("creator_skills").select("name, level").eq("creator_id", id).order("position"),
    supabase.from("creator_past_brands").select("brand_name").eq("creator_id", id).order("position"),
    supabase.from("portfolio_items").select("id", { count: "exact", head: true }).eq("creator_id", id),
    supabase
      .from("applications")
      .select(
        "id, campaign_id, status, created_at, status_changed_at, rating, conflict_reason, conflict_by, conflict_at, admin_note",
      )
      .eq("creator_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("points_events")
      .select("id, action, points, created_at")
      .eq("creator_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("level_thresholds").select("*").order("min_points"),
    supabase
      .from("redemptions")
      .select("id, coupon_id, code, status, claimed_at, redeemed_at")
      .eq("creator_id", id)
      .order("claimed_at", { ascending: false }),
  ]);

  const listaApps = aplicaciones ?? [];
  const listaCanjes = canjes ?? [];
  const campaignIds = [...new Set(listaApps.map((a) => a.campaign_id))];
  const couponIds = [...new Set(listaCanjes.map((c) => c.coupon_id))];
  const [{ data: campanas }, { data: cupones }] = await Promise.all([
    campaignIds.length
      ? supabase.from("campaigns").select("id, title, brand_id, budget_amount").in("id", campaignIds)
      : Promise.resolve({
          data: [] as { id: string; title: string; brand_id: string; budget_amount: number }[],
        }),
    couponIds.length
      ? supabase.from("coupons").select("id, title, brand_id").in("id", couponIds)
      : Promise.resolve({ data: [] as { id: string; title: string; brand_id: string }[] }),
  ]);
  const brandIds = [
    ...new Set([...(campanas ?? []).map((c) => c.brand_id), ...(cupones ?? []).map((c) => c.brand_id)]),
  ];
  const { data: marcas } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };

  const campanaDe = new Map((campanas ?? []).map((c) => [c.id, c]));
  const cuponDe = new Map((cupones ?? []).map((c) => [c.id, c]));
  const marcaDe = new Map((marcas ?? []).map((m) => [m.profile_id, m.brand_name]));

  // ---- Números ----
  const estado = estadoCuenta(creador);
  const elegidas = listaApps.filter((a) => ELEGIDO.includes(a.status)).length;
  const aprobadas = listaApps.filter((a) => COBRADA.includes(a.status));
  const cobrado = aprobadas.reduce(
    (n, a) => n + creatorPayout(campanaDe.get(a.campaign_id)?.budget_amount ?? 0),
    0,
  );
  const ratings = listaApps.flatMap((a) => (a.rating ? [a.rating] : []));
  const ratingPromedio = ratings.length ? ratings.reduce((n, r) => n + r, 0) / ratings.length : null;

  const escalera: Nivel[] = umbrales ?? [{ level: 1, name: "Bronce", min_points: 0 }];
  const puntos = (eventos ?? []).reduce((n, e) => n + e.points, 0);
  const { actual: nivel } = estadoDeNivel(puntos, escalera);
  const colorNivel = COLOR_NIVEL[nivel?.level ?? 1] ?? "#7d8794";

  const disputas = listaApps.filter((a) => a.conflict_at);
  const slug = handleSlug(creador.handle);
  // El nombre suele ser el mismo handle ("@evanmarin"); repetido no dice nada.
  const nombre =
    perfil?.display_name && handleSlug(perfil.display_name).toLowerCase() !== slug.toLowerCase()
      ? perfil.display_name
      : null;

  const fechaLarga = (iso: string) =>
    new Date(iso).toLocaleDateString("es-CR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Costa_Rica",
    });

  const kv: { k: string; v: React.ReactNode }[] = [
    { k: "Correo", v: email ? <a href={`mailto:${email}`}>{email}</a> : "—" },
    { k: "Ciudad", v: perfil?.city || "—" },
    {
      k: "Instagram",
      v: creador.instagram_handle ? (
        <a
          href={`https://instagram.com/${handleSlug(creador.instagram_handle)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {displayHandle(creador.instagram_handle)}
        </a>
      ) : (
        "—"
      ),
    },
    {
      k: "TikTok",
      v: creador.tiktok_handle ? (
        <a
          href={`https://www.tiktok.com/@${handleSlug(creador.tiktok_handle)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {displayHandle(creador.tiktok_handle)}
        </a>
      ) : (
        "—"
      ),
    },
    { k: "Seguidores", v: creador.followers_count.toLocaleString("es-CR") },
    {
      k: "Alcance · vistas · engagement (promedio)",
      v:
        creador.avg_reach == null && creador.avg_views == null && creador.engagement_rate == null
          ? "—"
          : [
              creador.avg_reach != null ? creador.avg_reach.toLocaleString("es-CR") : "—",
              creador.avg_views != null ? creador.avg_views.toLocaleString("es-CR") : "—",
              creador.engagement_rate != null ? `${creador.engagement_rate}%` : "—",
            ].join(" · "),
    },
    { k: "Nichos", v: creador.niches.join(", ") || "—" },
    { k: "Idiomas", v: creador.languages.join(", ") || "—" },
    {
      k: "Tarifa",
      v:
        creador.rate_min != null || creador.rate_max != null
          ? [creador.rate_min, creador.rate_max]
              .filter((n): n is number => n != null)
              .map(colones)
              .join(" – ")
          : "—",
    },
    { k: "Servicios", v: (servicios ?? []).map((s) => s.service).join(", ") || "—" },
    { k: "Extras", v: (addons ?? []).map((a) => a.addon).join(", ") || "—" },
    {
      k: "Habilidades",
      v: (habilidades ?? []).map((h) => `${h.name} (${h.level}/5)`).join(", ") || "—",
    },
    { k: "Marcas con las que trabajó", v: (marcasPasadas ?? []).map((m) => m.brand_name).join(", ") || "—" },
    { k: "Book", v: `${piezasBook ?? 0} ${piezasBook === 1 ? "pieza" : "piezas"}` },
  ];

  const stats = [
    {
      label: "Aplicaciones",
      value: String(listaApps.length),
      sub: `${elegidas} ${elegidas === 1 ? "elegida" : "elegidas"} por la marca`,
    },
    { label: "Entregas aprobadas", value: String(aprobadas.length), sub: "colaboraciones cerradas" },
    { label: "Cobrado", value: colones(cobrado), sub: "lo que recibe el creador" },
    {
      label: "Rating",
      value: ratingPromedio != null ? ratingPromedio.toFixed(1) : "—",
      sub: ratings.length ? `promedio de ${ratings.length}` : "todavía sin calificar",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Link href="/admin/marketplace?tab=creadores" className={styles.backBtn}>
        <QosIcon name="chevL" size={14} /> Creadores
      </Link>

      <div className={styles.dossierHd}>
        <div className={styles.dsrRow}>
          {perfil?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.avatar_url}
              alt={creador.handle}
              className={styles.dsrMono}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <span className={styles.dsrMono} style={{ background: "var(--b-500)" }}>
              {(slug || "?").slice(0, 2).toUpperCase()}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div className={styles.dsrId}>EXPEDIENTE CREADOR</div>
            <div className={styles.dsrName}>{displayHandle(creador.handle)}</div>
            <div className={styles.dsrInd}>
              {[nombre, perfil?.city].filter(Boolean).join(" · ") || "Sin datos"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "26px", marginLeft: "auto", flexWrap: "wrap" }}>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                {puntos.toLocaleString("es-CR")}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(244,243,251,.55)" }}>
                Puntos · {nivel?.name ?? "Bronce"}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                {creador.followers_count.toLocaleString("es-CR")}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(244,243,251,.55)" }}>Seguidores</div>
            </div>
          </div>
        </div>
        <div className={styles.dsrMeta} style={{ flexWrap: "wrap" }}>
          <div>
            <div className={styles.dmL}>Se registró</div>
            <div className={styles.dmV}>{perfil?.created_at ? fechaLarga(perfil.created_at) : "—"}</div>
          </div>
          <div>
            <div className={styles.dmL}>Verificación</div>
            <div className={styles.dmV}>
              {estado === "verificada" ? "Verificado" : estado === "rechazada" ? "Rechazado" : "Pendiente"}
            </div>
          </div>
        </div>
      </div>

      {/* Verificación: los mismos botones que en Marketplace. */}
      <div className={`${styles.card} ${styles.cardPad}`}>
        <div
          className={`${styles.attnItem} ${styles.mktFila}`}
          style={{ cursor: "default", border: 0, padding: 0 }}
        >
          <div className={styles.attnBody}>
            <div className={styles.attnTitle}>
              Verificación{" "}
              <span
                className={`${styles.riskPill} ${
                  estado === "verificada"
                    ? styles.riskOk
                    : estado === "rechazada"
                      ? styles.riskRisk
                      : styles.riskWarn
                }`}
              >
                {estado === "verificada" ? "Verificado" : estado === "rechazada" ? "Rechazado" : "Pendiente"}
              </span>
            </div>
            <div className={styles.attnMeta}>
              {estado === "rechazada"
                ? `Motivo: ${creador.rejection_reason || "sin motivo"}`
                : estado === "verificada"
                  ? "Puede aplicar a campañas."
                  : "Todavía no puede entrar a su panel."}
            </div>
          </div>
          <div className={styles.attnRight}>
            {slug && (
              <a
                href={`/ugc/creadores/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              >
                Ver book
              </a>
            )}
            <VerificacionAcciones profileId={id} tipo="creator" estado={estado} />
          </div>
        </div>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Perfil</h2>
        </div>
        <div className={styles.fichaKv}>
          {kv.map((d) => (
            <div key={d.k}>
              <div className={styles.fichaK}>{d.k}</div>
              <div className={styles.fichaV}>{d.v}</div>
            </div>
          ))}
        </div>
        {perfil?.bio && (
          <div style={{ marginTop: 14 }}>
            <div className={styles.fichaK}>Bio</div>
            <div className={styles.fichaV} style={{ whiteSpace: "pre-line" }}>
              {perfil.bio}
            </div>
          </div>
        )}
      </div>

      <div className={styles.statCard} style={{ marginBottom: 0 }}>
        <div className={styles.statRow}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statNum}>{s.value}</div>
              <div className={styles.statSub}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Colaboraciones ({listaApps.length})</h2>
        </div>
        {listaApps.length === 0 ? (
          <div className={styles.empty}>Todavía no aplicó a ninguna campaña.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.acctTable}>
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Marca</th>
                  <th>Estado</th>
                  <th>Aplicó</th>
                  <th>Último cambio</th>
                  <th style={{ textAlign: "right" }}>Rating</th>
                  <th style={{ textAlign: "right" }}>Cobra</th>
                </tr>
              </thead>
              <tbody>
                {listaApps.map((a) => {
                  const c = campanaDe.get(a.campaign_id);
                  return (
                    <tr key={a.id}>
                      <td>
                        <b>{c?.title ?? "Campaña"}</b>
                      </td>
                      <td>{c ? (marcaDe.get(c.brand_id) ?? "—") : "—"}</td>
                      <td>
                        <span
                          className={`${styles.riskPill} ${styles[`risk${APPLICATION_STATUS_STYLE[a.status]}`]}`}
                        >
                          {APPLICATION_STATUS_LABEL[a.status]}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                        {fechaCorta(a.created_at)}
                      </td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                        {fechaCorta(a.status_changed_at)}
                      </td>
                      <td style={{ textAlign: "right" }}>{a.rating ? `${a.rating}★` : "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {c ? colones(creatorPayout(c.budget_amount)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Loyalty Loop</h2>
          <span className={styles.riskPill} style={{ background: `${colorNivel}22`, color: colorNivel }}>
            {(nivel?.name ?? "Bronce").toUpperCase()} · {puntos.toLocaleString("es-CR")} pts
          </span>
        </div>
        {(eventos ?? []).length === 0 && listaCanjes.length === 0 ? (
          <div className={styles.empty}>Todavía no sumó puntos ni reclamó cupones.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {(eventos ?? []).length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className={styles.acctTable}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Por qué</th>
                      <th style={{ textAlign: "right" }}>Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(eventos ?? []).map((e) => (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                          {fechaCorta(e.created_at)}
                        </td>
                        <td>{labelAccion(e.action)}</td>
                        <td style={{ textAlign: "right" }}>
                          <b>
                            {e.points > 0 ? "+" : ""}
                            {e.points}
                          </b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {listaCanjes.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className={styles.acctTable}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Marca</th>
                      <th>Cupón</th>
                      <th>Código</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaCanjes.map((r) => {
                      const cupon = cuponDe.get(r.coupon_id);
                      const est = ESTILO_CANJE[r.status];
                      return (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                            {fechaCorta(r.redeemed_at ?? r.claimed_at)}
                          </td>
                          <td>{cupon ? (marcaDe.get(cupon.brand_id) ?? "—") : "—"}</td>
                          <td>{cupon?.title ?? "—"}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{r.code}</td>
                          <td>
                            <span className={`${styles.riskPill} ${est?.clase ?? ""}`}>
                              {est?.label ?? r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Disputas ({disputas.length})</h2>
          {disputas.length > 0 && (
            <Link href="/admin/disputas" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}>
              Ir a Disputas
            </Link>
          )}
        </div>
        {disputas.length === 0 ? (
          <p className={styles.attnMeta}>
            <QosIcon name="check" size={12} /> Nunca estuvo en una disputa.
          </p>
        ) : (
          disputas.map((d) => {
            const c = campanaDe.get(d.campaign_id);
            const abierta = d.status === "disputed";
            return (
              <div
                key={d.id}
                className={styles.attnItem}
                style={{ cursor: "default", alignItems: "flex-start" }}
              >
                <div className={styles.attnBody}>
                  <div className={styles.attnTitle}>
                    {c?.title ?? "Campaña"}{" "}
                    <span className={`${styles.riskPill} ${abierta ? styles.riskRisk : styles.riskMuted}`}>
                      {abierta ? "Abierta" : `Resuelta · ${APPLICATION_STATUS_LABEL[d.status]}`}
                    </span>
                  </div>
                  <div className={styles.attnMeta} style={{ display: "block" }}>
                    {d.conflict_by === id ? "La abrió el creador" : "La abrió la marca"}
                    {d.conflict_at && ` el ${fechaLarga(d.conflict_at)}`}: {d.conflict_reason}
                    {!abierta && d.admin_note && (
                      <>
                        <br />
                        <b>Cómo se resolvió:</b> {d.admin_note}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
