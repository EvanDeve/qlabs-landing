import { createClient } from "@/lib/supabase/server";
import { estadoDeNivel, labelAccion, fechaCorta, COLOR_NIVEL, type Nivel } from "@/lib/ugc/loyalty";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * Loyalty Loop desde adentro.
 *
 * El punto de esta pantalla no es administrar nada —no hay un botón para
 * regalar puntos y no debería haberlo— sino poder responder dos preguntas
 * cuando alguien escribe: "¿por qué tengo estos puntos?" y "¿este canje entró?".
 * Por eso todo lo que se ve es lectura del ledger y del registro de canjes.
 */
export default async function AdminLoyaltyPage() {
  const supabase = await createClient();

  const [{ data: eventos }, { data: umbrales }, { data: reclamos }] = await Promise.all([
    supabase
      .from("points_events")
      .select("creator_id, action, points, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("level_thresholds").select("*").order("min_points"),
    supabase
      .from("redemptions")
      .select("id, coupon_id, creator_id, code, status, claimed_at, redeemed_at")
      .order("claimed_at", { ascending: false })
      .limit(60),
  ]);

  const { count: totalReclamos } = await supabase
    .from("redemptions")
    .select("id", { count: "exact", head: true });

  const escalera: Nivel[] = umbrales ?? [{ level: 1, name: "Bronce", min_points: 0 }];
  const lista = eventos ?? [];
  const canjes = reclamos ?? [];

  // El total y el último evento de cada creador se arman de una sola pasada
  // sobre el ledger. Los eventos ya vienen ordenados por fecha, así que el
  // primero que aparece de cada creador ES el último que ocurrió.
  const porCreador = new Map<
    string,
    { total: number; ultimaAccion: string; ultimaFecha: string; eventos: number }
  >();
  for (const e of lista) {
    const actual = porCreador.get(e.creator_id);
    if (actual) {
      actual.total += e.points;
      actual.eventos += 1;
    } else {
      porCreador.set(e.creator_id, {
        total: e.points,
        ultimaAccion: e.action,
        ultimaFecha: e.created_at,
        eventos: 1,
      });
    }
  }

  const creatorIds = [...new Set([...porCreador.keys(), ...canjes.map((r) => r.creator_id)])];
  const couponIds = [...new Set(canjes.map((r) => r.coupon_id))];

  const [{ data: creadores }, { data: cupones }, { data: aprobadas }] = await Promise.all([
    creatorIds.length
      ? supabase.from("creator_public_profiles").select("profile_id, handle").in("profile_id", creatorIds)
      : Promise.resolve({ data: [] as { profile_id: string; handle: string }[] }),
    couponIds.length
      ? supabase.from("coupons").select("id, title, brand_id").in("id", couponIds)
      : Promise.resolve({ data: [] as { id: string; title: string; brand_id: string }[] }),
    supabase.from("applications").select("creator_id").eq("status", "approved"),
  ]);

  const brandIds = [...new Set((cupones ?? []).map((c) => c.brand_id))];
  const { data: marcas } = brandIds.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
    : { data: [] };

  const handleDe = new Map((creadores ?? []).map((c) => [c.profile_id, c.handle]));
  const cuponDe = new Map((cupones ?? []).map((c) => [c.id, c]));
  const marcaDe = new Map((marcas ?? []).map((m) => [m.profile_id, m.brand_name]));

  const entregasDe = new Map<string, number>();
  for (const a of aprobadas ?? []) {
    entregasDe.set(a.creator_id, (entregasDe.get(a.creator_id) ?? 0) + 1);
  }
  const canjesDe = new Map<string, number>();
  for (const r of canjes.filter((r) => r.status === "canjeado")) {
    canjesDe.set(r.creator_id, (canjesDe.get(r.creator_id) ?? 0) + 1);
  }

  const filas = [...porCreador.entries()]
    .map(([id, datos]) => {
      const { actual } = estadoDeNivel(datos.total, escalera);
      return {
        id,
        handle: handleDe.get(id) ?? "—",
        total: datos.total,
        nivel: actual?.name ?? "Bronce",
        nivelNum: actual?.level ?? 1,
        entregas: entregasDe.get(id) ?? 0,
        canjes: canjesDe.get(id) ?? 0,
        ultimo: `${labelAccion(datos.ultimaAccion)} · ${fechaCorta(datos.ultimaFecha)}`,
      };
    })
    .sort((a, b) => b.total - a.total);

  const kpis = [
    { label: "Creadores con puntos", value: filas.length, icon: "users", color: "#6d54f3" },
    {
      label: "Puntos otorgados",
      value: lista.reduce((s, e) => s + e.points, 0).toLocaleString("es-CR"),
      icon: "sparkle",
      color: "#c07414",
    },
    {
      label: "Canjes confirmados",
      value: canjes.filter((r) => r.status === "canjeado").length,
      icon: "check",
      color: "#14a06a",
    },
    {
      label: "Reclamos vigentes",
      value: canjes.filter((r) => r.status === "reclamado").length,
      icon: "clock",
      color: "#7d8794",
    },
  ];

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px", marginBottom: "4px" }}>
        Loyalty Loop
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "24px", maxWidth: "70ch" }}>
        Todos los creadores con puntos, su nivel y su actividad. El ledger es la fuente de verdad: el
        nivel se calcula, nunca se edita.
      </p>

      <div className={styles.kpiRow} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
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
        <h2 className={styles.sectionHeadBig}>Todos los creadores</h2>
      </div>
      <div className={`${styles.card} ${styles.cardPad}`}>
        {filas.length === 0 ? (
          <div className={styles.empty}>Todavía nadie sumó puntos.</div>
        ) : (
          <table className={styles.acctTable}>
            <thead>
              <tr>
                <th>Creador</th>
                <th>Nivel</th>
                <th style={{ textAlign: "right" }}>Puntos</th>
                <th style={{ textAlign: "right" }}>Entregas</th>
                <th style={{ textAlign: "right" }}>Canjes</th>
                <th>Último evento</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>
                    <b>{f.handle}</b>
                  </td>
                  <td>
                    <span
                      className={styles.riskPill}
                      style={{
                        background: `${COLOR_NIVEL[f.nivelNum] ?? "#7d8794"}22`,
                        color: COLOR_NIVEL[f.nivelNum] ?? "#7d8794",
                      }}
                    >
                      {f.nivel.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <b>{f.total.toLocaleString("es-CR")}</b>
                  </td>
                  <td style={{ textAlign: "right" }}>{f.entregas}</td>
                  <td style={{ textAlign: "right" }}>{f.canjes}</td>
                  <td style={{ color: "var(--ink-2)" }}>{f.ultimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.sectionHead} style={{ marginTop: "30px" }}>
        <h2 className={styles.sectionHeadBig}>Registro global de canjes</h2>
        <span style={{ fontSize: "12.5px", color: "var(--ink-3)" }}>
          {(totalReclamos ?? 0) > 60 ? `Mostrando los últimos 60 de ${totalReclamos}` : "Todos los reclamos"}
        </span>
      </div>
      <div className={`${styles.card} ${styles.cardPad}`}>
        {canjes.length === 0 ? (
          <div className={styles.empty}>Todavía nadie reclamó un cupón.</div>
        ) : (
          <table className={styles.acctTable}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Marca</th>
                <th>Cupón</th>
                <th>Creador</th>
                <th>Código</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {canjes.map((r) => {
                const cupon = cuponDe.get(r.coupon_id);
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                      {fechaCorta(r.redeemed_at ?? r.claimed_at)}
                    </td>
                    <td>{marcaDe.get(cupon?.brand_id ?? "") ?? "—"}</td>
                    <td>{cupon?.title ?? "—"}</td>
                    <td>
                      <b>{handleDe.get(r.creator_id) ?? "—"}</b>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{r.code}</td>
                    <td>
                      <span
                        className={`${styles.riskPill} ${
                          r.status === "canjeado"
                            ? styles.riskOk
                            : r.status === "expirado"
                              ? styles.riskMuted
                              : styles.riskWarn
                        }`}
                      >
                        {r.status === "canjeado"
                          ? "Canjeado"
                          : r.status === "expirado"
                            ? "Expirado"
                            : "Reclamado"}
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
  );
}
