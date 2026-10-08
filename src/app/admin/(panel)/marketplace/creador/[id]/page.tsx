import { notFound } from "next/navigation";
import Link from "next/link";
import { requireArea } from "@/lib/auth/areas";
import VerificacionAcciones from "@/components/ugc/admin/VerificacionAcciones";
import { PestanasAdmin } from "@/components/ugc/admin/PestanasAdmin";
import { estadoCuenta } from "@/lib/ugc/estado-cuenta";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_STYLE } from "@/lib/ugc/application-status";
import { estadoDeNivel, labelAccion, fechaCorta, COLOR_NIVEL, type Nivel } from "@/lib/ugc/loyalty";
import { creatorPayout } from "@/lib/ugc/payout";
import { displayHandle, handleSlug } from "@/lib/ugc/handles";
import { iniciales, leerEstado, rutaFichaCreador } from "@/lib/ugc/marketplace-admin";
import { getUserEmail } from "@/lib/email/resend";
import { QosIcon } from "@/lib/ugc/qos-icons";
import type { ApplicationStatus } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

const PESTANAS = ["perfil", "colaboraciones", "loyalty", "disputas"] as const;

/** Una entrega está cobrada cuando la marca la aprobó; antes es plata en camino. */
const COBRADA: ApplicationStatus[] = ["approved"];
/** Estados en los que la marca ya eligió al creador. */
const ELEGIDO: ApplicationStatus[] = ["accepted", "delivered", "approved", "disputed"];
/** Estados en los que el creador ya entregó algo. */
const ENTREGADA: ApplicationStatus[] = ["delivered", "approved", "disputed"];

const ESTILO_CANJE: Record<string, { label: string; clase: string }> = {
  reclamado: { label: "Reclamado", clase: styles.riskWarn },
  canjeado: { label: "Canjeado", clase: styles.riskOk },
  expirado: { label: "Expirado", clase: styles.riskMuted },
};

const colones = (n: number) => `₡${n.toLocaleString("es-CR")}`;

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  });

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={styles.fichaK}>{k}</div>
      <div className={styles.fichaV}>{children}</div>
    </div>
  );
}

/**
 * La ficha de un creador (mockup 1c): todo lo que el equipo necesita saber de
 * él, para responder cuando escribe o decidir si se verifica. Arriba quién es
 * y sus números; abajo, por pestañas, el perfil, las colaboraciones, Loyalty y
 * las disputas.
 *
 * Es lectura, salvo la verificación (los mismos botones de Marketplace). No
 * hay notas internas ni seguidores por red: lo primero lo dejó afuera Evan y
 * lo segundo no existe en la base (2026-10-07).
 */
export default async function FichaCreadorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { supabase } = await requireArea("ugc");
  const { id } = await params;
  const tab = leerEstado((await searchParams).tab, PESTANAS) ?? "perfil";

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
  const listaEventos = eventos ?? [];
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
  const entregadas = listaApps.filter((a) => ENTREGADA.includes(a.status)).length;
  const aprobadas = listaApps.filter((a) => COBRADA.includes(a.status));
  const cobrado = aprobadas.reduce(
    (n, a) => n + creatorPayout(campanaDe.get(a.campaign_id)?.budget_amount ?? 0),
    0,
  );
  const ratings = listaApps.flatMap((a) => (a.rating ? [a.rating] : []));
  const ratingPromedio = ratings.length ? ratings.reduce((n, r) => n + r, 0) / ratings.length : null;

  const escalera: Nivel[] = umbrales ?? [{ level: 1, name: "Bronce", min_points: 0 }];
  const puntos = listaEventos.reduce((n, e) => n + e.points, 0);
  const { actual: nivel } = estadoDeNivel(puntos, escalera);
  const colorNivel = COLOR_NIVEL[nivel?.level ?? 1] ?? "#7d8794";

  const disputas = listaApps.filter((a) => a.conflict_at);
  const slug = handleSlug(creador.handle);
  // El nombre suele ser el mismo handle ("@evanmarin"); repetido no dice nada.
  const nombre =
    perfil?.display_name && handleSlug(perfil.display_name).toLowerCase() !== slug.toLowerCase()
      ? perfil.display_name
      : null;

  const meta = [
    nombre,
    perfil?.city,
    `${creador.followers_count.toLocaleString("es-CR")} seguidores`,
    perfil?.created_at ? `en UGC·CRC desde el ${fechaLarga(perfil.created_at)}` : null,
  ].filter(Boolean);

  const stats = [
    {
      label: "Aplicaciones",
      value: String(listaApps.length),
      sub: `${elegidas} ${elegidas === 1 ? "elegida" : "elegidas"} por la marca`,
    },
    {
      label: "Entregas aprobadas",
      value: String(aprobadas.length),
      sub: `de ${entregadas} ${entregadas === 1 ? "entregada" : "entregadas"}`,
    },
    // El pago pasa por fuera de la app: esto es lo que le corresponde, no lo
    // que se le transfirió.
    { label: "Total cobrado", value: colones(cobrado), sub: "neto, fuera de la app" },
    {
      label: "Rating promedio",
      value: ratingPromedio != null ? ratingPromedio.toFixed(1) : "—",
      sub: ratings.length
        ? `${ratings.length} ${ratings.length === 1 ? "calificación" : "calificaciones"}`
        : "todavía sin calificar",
    },
  ];

  const base = rutaFichaCreador(id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <nav className={styles.migas} aria-label="Ubicación">
        <Link href="/admin/marketplace">Marketplace</Link>
        <span>›</span>
        <Link href="/admin/marketplace?tab=creadores">Creadores</Link>
        <span>›</span>
        <b>{displayHandle(creador.handle)}</b>
      </nav>

      <div className={`${styles.card} ${styles.fichaHead}`}>
        {perfil?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={perfil.avatar_url} alt={creador.handle} className={styles.fichaAv} />
        ) : (
          <span className={styles.fichaAv}>{iniciales(perfil?.display_name || creador.handle)}</span>
        )}
        <div className={styles.fichaHeadTxt}>
          <div className={styles.fichaNombre}>
            <h2>{displayHandle(creador.handle)}</h2>
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
            <span className={styles.riskPill} style={{ background: `${colorNivel}1f`, color: colorNivel }}>
              {nivel?.name ?? "Bronce"} · {puntos.toLocaleString("es-CR")} pts
            </span>
          </div>
          <div className={styles.fichaMeta}>{meta.join(" · ")}</div>
          {estado === "rechazada" && (
            <div className={styles.fichaMeta} style={{ color: "var(--risk)" }}>
              Rechazado: {creador.rejection_reason || "sin motivo"}
            </div>
          )}
        </div>
        <div className={styles.fichaHeadAcc}>
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

      <div className={`${styles.statCard} ${styles.statCardGrupo}`} style={{ paddingTop: 8 }}>
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

      <div>
        <PestanasAdmin
          base={base}
          label="Secciones de la ficha"
          activa={tab}
          pestanas={[
            { id: "perfil", label: "Perfil" },
            { id: "colaboraciones", label: "Colaboraciones", count: listaApps.length },
            { id: "loyalty", label: "Loyalty", count: listaEventos.length },
            { id: "disputas", label: "Disputas", count: disputas.length },
          ]}
        />
      </div>

      {tab === "perfil" && (
        <div className={styles.fichaGrid3}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <h3 className={styles.fichaH3}>Contacto y redes</h3>
            <div className={styles.fichaPila}>
              <Dato k="Correo">{email ? <a href={`mailto:${email}`}>{email}</a> : "—"}</Dato>
              <Dato k="Instagram">
                {creador.instagram_handle ? (
                  <a
                    href={`https://instagram.com/${handleSlug(creador.instagram_handle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {displayHandle(creador.instagram_handle)}
                  </a>
                ) : (
                  "—"
                )}
              </Dato>
              <Dato k="TikTok">
                {creador.tiktok_handle ? (
                  <a
                    href={`https://www.tiktok.com/@${handleSlug(creador.tiktok_handle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {displayHandle(creador.tiktok_handle)}
                  </a>
                ) : (
                  "—"
                )}
              </Dato>
              <Dato k="Idiomas">{creador.languages.join(", ") || "—"}</Dato>
            </div>
          </div>

          <div className={`${styles.card} ${styles.cardPad}`}>
            <h3 className={styles.fichaH3}>Rendimiento promedio</h3>
            <div className={styles.fichaCajas}>
              {[
                { k: "Alcance", v: creador.avg_reach?.toLocaleString("es-CR") },
                { k: "Vistas", v: creador.avg_views?.toLocaleString("es-CR") },
                {
                  k: "Engagement",
                  v: creador.engagement_rate != null ? `${creador.engagement_rate}%` : null,
                },
              ].map((c) => (
                <div key={c.k} className={styles.fichaCaja}>
                  <div className={styles.fichaK}>{c.k}</div>
                  <b>{c.v ?? "—"}</b>
                </div>
              ))}
            </div>
            <div className={styles.fichaPila}>
              <Dato k="Tarifa">
                {creador.rate_min != null
                  ? `Desde ${colones(creador.rate_min)}`
                  : creador.rate_max != null
                    ? `Hasta ${colones(creador.rate_max)}`
                    : "—"}
              </Dato>
              <Dato k="Servicios">{(servicios ?? []).map((s) => s.service).join(" · ") || "—"}</Dato>
              {(addons ?? []).length > 0 && (
                <Dato k="Extras">{(addons ?? []).map((a) => a.addon).join(" · ")}</Dato>
              )}
              <Dato k="Marcas con las que trabajó">
                {(marcasPasadas ?? []).map((m) => m.brand_name).join(", ") || "—"}
              </Dato>
            </div>
          </div>

          <div className={`${styles.card} ${styles.cardPad}`}>
            <h3 className={styles.fichaH3}>Habilidades</h3>
            {(habilidades ?? []).length === 0 ? (
              <p className={styles.attnMeta}>No cargó habilidades.</p>
            ) : (
              <div className={styles.fichaHabs}>
                {(habilidades ?? []).map((h) => (
                  <div key={h.name} className={styles.fichaHab}>
                    <span>{h.name}</span>
                    <span className={styles.fichaPuntos} aria-label={`${h.level} de 5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <i key={i} data-on={i < h.level ? "" : undefined} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div
              className={styles.fichaPila}
              style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-2)" }}
            >
              <Dato k="Nichos">{creador.niches.join(" · ") || "—"}</Dato>
              <div className={styles.fichaV} style={{ color: "var(--ink-2)" }}>
                {perfil?.bio && <span style={{ whiteSpace: "pre-line" }}>{perfil.bio} </span>}
                {piezasBook ?? 0} {piezasBook === 1 ? "pieza" : "piezas"} en el book.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "colaboraciones" &&
        (listaApps.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>Todavía no aplicó a ninguna campaña.</div>
        ) : (
          <div className={styles.card}>
            <table className={styles.tablaLista}>
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th className={styles.colEscritorio}>Marca</th>
                  <th className={styles.colEscritorio}>Aplicó</th>
                  <th className={styles.colEscritorio}>Último cambio</th>
                  <th className={`${styles.numCelda} ${styles.colEscritorio}`}>Rating</th>
                  <th className={`${styles.numCelda} ${styles.colEscritorio}`}>Cobra</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {listaApps.map((a) => {
                  const c = campanaDe.get(a.campaign_id);
                  const marca = c ? (marcaDe.get(c.brand_id) ?? "—") : "—";
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className={styles.celdaNombre}>
                          <span style={{ minWidth: 0 }}>
                            <b>{c?.title ?? "Campaña"}</b>
                            <small className={styles.soloMovil}>
                              {marca} · {c ? colones(creatorPayout(c.budget_amount)) : "—"}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td className={styles.colEscritorio}>{marca}</td>
                      <td
                        className={styles.colEscritorio}
                        style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}
                      >
                        {fechaCorta(a.created_at)}
                      </td>
                      <td
                        className={styles.colEscritorio}
                        style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}
                      >
                        {fechaCorta(a.status_changed_at)}
                      </td>
                      <td className={`${styles.numCelda} ${styles.colEscritorio}`}>
                        {a.rating ? `${a.rating}★` : "—"}
                      </td>
                      <td
                        className={`${styles.numCelda} ${styles.colEscritorio}`}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {c ? colones(creatorPayout(c.budget_amount)) : "—"}
                      </td>
                      <td>
                        <span
                          className={`${styles.riskPill} ${styles[`risk${APPLICATION_STATUS_STYLE[a.status]}`]}`}
                        >
                          {APPLICATION_STATUS_LABEL[a.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "loyalty" &&
        (listaEventos.length === 0 && listaCanjes.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>Todavía no sumó puntos ni reclamó cupones.</div>
        ) : (
          <div className={styles.resGrid} style={{ alignItems: "start" }}>
            <div className={`${styles.card} ${styles.cardPad}`}>
              <h3 className={styles.fichaH3}>Puntos ({puntos.toLocaleString("es-CR")})</h3>
              {listaEventos.length === 0 ? (
                <p className={styles.attnMeta}>Sin puntos todavía.</p>
              ) : (
                <table className={`${styles.acctTable} ${styles.tablaCompacta}`}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Por qué</th>
                      <th style={{ textAlign: "right" }}>Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaEventos.map((e) => (
                      <tr key={e.id}>
                        <td style={{ color: "var(--ink-2)" }}>{fechaCorta(e.created_at)}</td>
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
              )}
            </div>
            <div className={`${styles.card} ${styles.cardPad}`}>
              <h3 className={styles.fichaH3}>Cupones ({listaCanjes.length})</h3>
              {listaCanjes.length === 0 ? (
                <p className={styles.attnMeta}>No reclamó cupones.</p>
              ) : (
                <table className={`${styles.acctTable} ${styles.tablaCompacta}`}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cupón</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaCanjes.map((r) => {
                      const cupon = cuponDe.get(r.coupon_id);
                      const est = ESTILO_CANJE[r.status];
                      return (
                        <tr key={r.id}>
                          <td style={{ color: "var(--ink-2)" }}>
                            {fechaCorta(r.redeemed_at ?? r.claimed_at)}
                          </td>
                          <td style={{ whiteSpace: "normal" }}>
                            <b>{cupon?.title ?? "—"}</b>
                            <span className={styles.notaEstado}>
                              {cupon ? (marcaDe.get(cupon.brand_id) ?? "—") : "—"} · {r.code}
                            </span>
                          </td>
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
              )}
            </div>
          </div>
        ))}

      {tab === "disputas" &&
        (disputas.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>
            <QosIcon name="check" size={13} /> Nunca estuvo en una disputa.
          </div>
        ) : (
          <div className={`${styles.card} ${styles.cardPad}`}>
            {disputas.map((d) => {
              const c = campanaDe.get(d.campaign_id);
              const abierta = d.status === "disputed";
              return (
                <div key={d.id} className={styles.esperaFila} style={{ alignItems: "flex-start" }}>
                  <span className={`${styles.esperaAv} ${abierta ? styles.esperaAvRisk : ""}`}>!</span>
                  <div className={styles.esperaTxt}>
                    <div className={styles.esperaT}>
                      {c?.title ?? "Campaña"}{" "}
                      <span className={`${styles.riskPill} ${abierta ? styles.riskRisk : styles.riskMuted}`}>
                        {abierta ? "Abierta" : `Resuelta · ${APPLICATION_STATUS_LABEL[d.status]}`}
                      </span>
                    </div>
                    <div className={styles.fichaV} style={{ marginTop: 4, color: "var(--ink-2)" }}>
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
                  {abierta && (
                    <Link
                      href={`/admin/disputas?caso=${d.id}`}
                      className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}
                    >
                      Resolver
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
