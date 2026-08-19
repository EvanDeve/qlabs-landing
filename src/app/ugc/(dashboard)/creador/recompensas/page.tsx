import { createClient } from "@/lib/supabase/server";
import RecompensasTabs from "@/components/ugc/creador/RecompensasTabs";
import type { CuponVista } from "@/components/ugc/creador/CuponesGrid";
import type { MiCupon } from "@/components/ugc/creador/MisCupones";
import {
  estadoDeNivel,
  labelAccion,
  qrSvg,
  diasRestantes,
  fechaCorta,
  fechaLarga,
  EMOJI_NIVEL,
  COLOR_NIVEL,
  type Nivel,
} from "@/lib/ugc/loyalty";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function RecompensasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: puntos }, { data: umbrales }, { data: cupones }, { data: reclamos }, { data: historial }] =
    await Promise.all([
      supabase.from("creator_points").select("total_points").eq("creator_id", user!.id).maybeSingle(),
      supabase.from("level_thresholds").select("*").order("min_points"),
      // 'agotado' entra a propósito: si el cupón se agota después de que este
      // creador lo reclamó, sacarlo del feed le desaparecería su propio código.
      supabase
        .from("coupons")
        .select("*")
        .in("status", ["publicado", "agotado"])
        .order("created_at", { ascending: false }),
      supabase
        .from("redemptions")
        .select("id, coupon_id, code, status, expires_at, redeemed_at")
        .order("claimed_at", { ascending: false }),
      supabase
        .from("points_events")
        .select("id, action, points, reference_type, reference_id, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  // Las reglas se leen de la base y NO se hardcodean acá: el día que se ajuste
  // la economía con un UPDATE, esta tabla tiene que cambiar sola o pasa a
  // mentir. El total de eventos es para no cortar la lista en silencio.
  const [{ data: reglas }, { count: totalEventos }] = await Promise.all([
    supabase.from("point_rules").select("*").eq("active", true).order("points", { ascending: false }),
    supabase.from("points_events").select("id", { count: "exact", head: true }),
  ]);

  const totalPoints = puntos?.total_points ?? 0;
  const escaleraDb: Nivel[] = umbrales ?? [{ level: 1, name: "Bronce", min_points: 0 }];
  const { escalera, actual, siguiente, faltan, progreso } = estadoDeNivel(totalPoints, escaleraDb);

  // Los cupones que reclamé, aunque la marca los haya pausado o ya hayan
  // vencido: si no, "Mis cupones" mostraría filas sin título. La policy
  // `coupons_select_reclamados_por_mi` es la que lo permite.
  const misCouponIds = [...new Set((reclamos ?? []).map((r) => r.coupon_id))];
  const { data: cuponesReclamados } = misCouponIds.length
    ? await supabase.from("coupons").select("*").in("id", misCouponIds)
    : { data: [] };

  const listaCupones = cupones ?? [];
  const porId = new Map([...listaCupones, ...(cuponesReclamados ?? [])].map((c) => [c.id, c]));
  const todos = [...porId.values()];

  const brandIds = [...new Set(todos.map((c) => c.brand_id))];
  const couponIds = listaCupones.map((c) => c.id);

  // Dos consultas sueltas en vez de un embed anidado: `coupons.brand_id` apunta
  // a `profiles`, y el nombre del negocio vive un salto más allá, en
  // `brand_profiles`. Pedirlo con PostgREST en una sola query obliga a nombrar
  // la FK a mano y se rompe sola si alguien renombra la constraint.
  const [{ data: marcas }, { data: stocks }] = await Promise.all([
    brandIds.length
      ? supabase.from("brand_profiles").select("profile_id, brand_name, logo_url").in("profile_id", brandIds)
      : Promise.resolve({ data: [] as { profile_id: string; brand_name: string; logo_url: string | null }[] }),
    couponIds.length
      ? supabase.from("coupon_stock").select("*").in("coupon_id", couponIds)
      : Promise.resolve({ data: [] as { coupon_id: string; stock_total: number; stock_available: number }[] }),
  ]);

  const marcaDe = new Map((marcas ?? []).map((m) => [m.profile_id, m]));
  const stockDe = new Map((stocks ?? []).map((s) => [s.coupon_id, s]));
  const reclamoDe = new Map((reclamos ?? []).map((r) => [r.coupon_id, r]));
  const nombreNivel = new Map(escalera.map((n) => [n.level, n.name]));

  // Los QR de lo ya reclamado se generan acá, en el servidor: al recargar la
  // página el código tiene que seguir estando, no depender de haber visto el
  // modal en su momento. Solo para los vigentes — dibujar el QR de un cupón
  // vencido es invitar a que alguien lo intente igual.
  const qrPorCodigo = new Map(
    await Promise.all(
      (reclamos ?? [])
        .filter((r) => r.status === "reclamado" && new Date(r.expires_at) >= new Date())
        .map(async (r) => [r.code, await qrSvg(r.code)] as const)
    )
  );

  const vistas: CuponVista[] = listaCupones.map((c) => {
    const marca = marcaDe.get(c.brand_id);
    const stock = stockDe.get(c.id);
    const reclamo = reclamoDe.get(c.id);
    const nombre = marca?.brand_name ?? "Marca de UGC·CRC";

    const vigencia =
      c.type === "evento" && c.event_date
        ? fechaLarga(c.event_date)
        : c.claim_validity_days
          ? `${c.claim_validity_days} días desde el reclamo`
          : c.expires_at
            ? `hasta el ${fechaLarga(c.expires_at)}`
            : "—";

    return {
      id: c.id,
      title: c.title,
      type: c.type,
      description: c.description,
      conditions: c.conditions,
      minLevel: c.min_level,
      minLevelName: nombreNivel.get(c.min_level) ?? `Nivel ${c.min_level}`,
      // Cuántos puntos le faltan para poder reclamarlo. Es más accionable que
      // "requiere Oro": traduce el nivel a lo único que el creador mueve.
      puntosFaltantes: Math.max(0, (escalera.find((n) => n.level === c.min_level)?.min_points ?? 0) - totalPoints),
      brandName: nombre,
      brandInitials: nombre.slice(0, 2).toUpperCase(),
      brandLogo: marca?.logo_url ?? null,
      imageUrl: c.image_url,
      stockAvailable: stock?.stock_available ?? 0,
      stockTotal: stock?.stock_total ?? c.stock_total,
      vigencia,
      eventLocation: c.event_location,
      reclamo: reclamo
        ? {
            code: reclamo.code,
            status: reclamo.status,
            venceTexto: fechaLarga(reclamo.expires_at),
            qr: qrPorCodigo.get(reclamo.code) ?? null,
          }
        : null,
    };
  });

  // El feed pone adelante lo que se puede reclamar hoy. Los bloqueados por
  // nivel quedan en el medio a propósito —son el motivo para seguir
  // entregando— y los agotados van al fondo, que es donde estorban menos.
  const nivelActualNum = actual?.level ?? 1;
  vistas.sort((a, b) => {
    const orden = (c: CuponVista) =>
      c.reclamo ? 1 : c.stockAvailable <= 0 ? 3 : nivelActualNum >= c.minLevel ? 0 : 2;
    return orden(a) - orden(b);
  });

  // "Mis cupones": el estado no sale solo de `status`. Un reclamo puede seguir
  // en 'reclamado' y estar vencido de hecho, porque el barrido diario todavía
  // no pasó. Para el creador eso es un cupón vencido, no uno por usar.
  const mios: MiCupon[] = (reclamos ?? []).map((r) => {
    const cupon = porId.get(r.coupon_id);
    const dias = diasRestantes(r.expires_at);
    const estado =
      r.status === "canjeado"
        ? ("canjeado" as const)
        : r.status === "expirado" || dias < 0
          ? ("vencido" as const)
          : ("por_usar" as const);

    return {
      id: r.id,
      code: r.code,
      title: cupon?.title ?? "Cupón",
      brandName: marcaDe.get(cupon?.brand_id ?? "")?.brand_name ?? "Marca de UGC·CRC",
      type: cupon?.type ?? "producto",
      estado,
      venceTexto: fechaLarga(r.expires_at),
      diasRestantes: dias,
      canjeadoTexto: r.redeemed_at ? fechaLarga(r.redeemed_at) : null,
      eventLocation: cupon?.event_location ?? null,
      imageUrl: cupon?.image_url ?? null,
      qr: qrPorCodigo.get(r.code) ?? null,
    };
  });

  // La referencia del historial: para lo que nació de una aplicación se muestra
  // el nombre de la campaña, que es como el creador lo recuerda ("el reel de
  // Zonna"), no un uuid.
  const applicationIds = [
    ...new Set(
      (historial ?? [])
        .filter((e) => e.reference_type === "application" && e.reference_id)
        .map((e) => e.reference_id as string)
    ),
  ];
  const { data: aplicaciones } = applicationIds.length
    ? await supabase.from("applications").select("id, campaign_id").in("id", applicationIds)
    : { data: [] };
  const campaignIds = [...new Set((aplicaciones ?? []).map((a) => a.campaign_id))];
  const { data: campanas } = campaignIds.length
    ? await supabase.from("campaigns").select("id, title").in("id", campaignIds)
    : { data: [] };

  // Dos saltos y no un embed: los tipos de la base están escritos a mano y no
  // declaran relaciones, así que PostgREST no puede tipar el anidado. Es además
  // lo que ya hace la pantalla de Mis aplicaciones.
  const tituloCampana = new Map((campanas ?? []).map((c) => [c.id, c.title]));
  const tituloDe = new Map(
    (aplicaciones ?? []).map((a) => [a.id, tituloCampana.get(a.campaign_id)])
  );

  const colorActual = COLOR_NIVEL[actual?.level ?? 1] ?? "#6d54f3";

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px", marginBottom: "4px" }}>
        Recompensas
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "24px", maxWidth: "62ch" }}>
        Acumulás puntos entregando trabajo real. Tu nivel desbloquea cupones de las marcas de la
        plataforma.
      </p>

      {/* ── Héroe de nivel ── */}
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "30px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 1fr) minmax(220px, 320px)",
            gap: "28px",
            alignItems: "center",
          }}
        >
          <div>
            <span
              className={styles.riskPill}
              style={{ background: `${colorActual}22`, color: colorActual, fontSize: "12px" }}
            >
              {EMOJI_NIVEL[actual?.level ?? 1]} {(actual?.name ?? "Bronce").toUpperCase()}
            </span>
            <div style={{ marginTop: "12px", fontSize: "34px", fontWeight: 800, lineHeight: 1.1 }}>
              {totalPoints.toLocaleString("es-CR")}{" "}
              <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink-3)" }}>puntos</span>
            </div>
            <div className={styles.loadTrack} style={{ marginTop: "14px", maxWidth: "420px" }}>
              <div
                className={styles.loadFill}
                style={{ width: `${progreso}%`, background: colorActual }}
              />
            </div>
            <p style={{ marginTop: "8px", fontSize: "12.5px", color: "var(--ink-2)" }}>
              {siguiente
                ? `Te faltan ${faltan.toLocaleString("es-CR")} pts para ${EMOJI_NIVEL[siguiente.level]} ${siguiente.name}`
                : "Llegaste al nivel más alto de la escalera 💎"}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {escalera.map((n) => {
              const alcanzado = totalPoints >= n.min_points;
              const esActual = n.level === actual?.level;
              return (
                <div
                  key={n.level}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "7px 10px",
                    borderRadius: "8px",
                    background: esActual ? `${colorActual}14` : "transparent",
                    fontSize: "13px",
                    fontWeight: esActual ? 700 : 500,
                    color: alcanzado ? "var(--ink)" : "var(--ink-3)",
                  }}
                >
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: alcanzado ? COLOR_NIVEL[n.level] : "var(--surface-3)",
                    }}
                  />
                  {n.name} · {n.min_points.toLocaleString("es-CR")} pts
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Cupones ── */}
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionHeadBig}>Cupones disponibles para vos</h2>
        <span style={{ fontSize: "12.5px", color: "var(--ink-3)" }}>
          Los cupones 🔒 se desbloquean subiendo de nivel
        </span>
      </div>

      <RecompensasTabs disponibles={vistas} mios={mios} nivelActual={actual?.level ?? 1} />

      {/* ── Cómo se ganan puntos ── */}
      <div className={styles.sectionHead} style={{ marginTop: "34px" }}>
        <h2 className={styles.sectionHeadBig}>Cómo se ganan puntos</h2>
        <span style={{ fontSize: "12.5px", color: "var(--ink-3)" }}>
          El peso está en el trabajo entregado, no en moverse
        </span>
      </div>
      <div className={`${styles.card} ${styles.cardPad}`}>
        <table className={styles.acctTable}>
          <thead>
            <tr>
              <th>Acción</th>
              <th style={{ textAlign: "right" }}>Puntos</th>
              <th>Límite</th>
            </tr>
          </thead>
          <tbody>
            {(reglas ?? []).map((r) => (
              <tr key={r.action}>
                <td>
                  <b>{labelAccion(r.action)}</b>
                </td>
                <td style={{ textAlign: "right" }}>
                  <b style={{ color: "var(--ok)" }}>+{r.points}</b>
                </td>
                <td style={{ color: "var(--ink-2)" }}>
                  {r.once_only
                    ? "Una sola vez"
                    : r.monthly_cap
                      ? `Hasta ${r.monthly_cap} por mes`
                      : "Sin límite"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "12px" }}>
          Los límites mensuales existen para que el nivel refleje trabajo entregado. Lo que pase del
          tope sigue contando para tu book, pero no suma puntos ese mes.
        </p>
      </div>

      {/* ── Historial ── */}
      <div className={styles.sectionHead} style={{ marginTop: "34px" }}>
        <h2 className={styles.sectionHeadBig}>Historial de puntos</h2>
        <span style={{ fontSize: "12.5px", color: "var(--ink-3)" }}>
          {(totalEventos ?? 0) > 25
            ? `Mostrando los últimos 25 de ${totalEventos}`
            : "Cada punto queda registrado — nada se edita a mano"}
        </span>
      </div>

      <div className={`${styles.card} ${styles.cardPad}`}>
        {(historial ?? []).length === 0 ? (
          <div className={styles.empty}>
            Todavía no sumaste puntos. Completá tu perfil, subí piezas al book y aplicá a promos para
            arrancar.
          </div>
        ) : (
          <table className={styles.acctTable}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Referencia</th>
                <th style={{ textAlign: "right" }}>Puntos</th>
              </tr>
            </thead>
            <tbody>
              {(historial ?? []).map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>{fechaCorta(e.created_at)}</td>
                  <td>
                    <b>{labelAccion(e.action)}</b>
                  </td>
                  <td style={{ color: "var(--ink-2)" }}>
                    {e.reference_type === "application"
                      ? (tituloDe.get(e.reference_id ?? "") ?? "Campaña")
                      : e.reference_type === "book_piece"
                        ? "Mi book"
                        : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <b style={{ color: "var(--ok)" }}>+{e.points}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
