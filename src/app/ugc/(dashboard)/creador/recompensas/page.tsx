import { createClient } from "@/lib/supabase/server";
import RecompensasTabs from "@/components/ugc/creador/RecompensasTabs";
import type { CuponVista } from "@/components/ugc/creador/CuponesGrid";
import type { MiCupon } from "@/components/ugc/creador/MisCupones";
import type {
  FilaHistorial,
  MesHistorial,
  NivelCamino,
  ReglaPuntos,
} from "@/components/ugc/creador/HistorialPuntos";
import {
  estadoDeNivel,
  labelAccion,
  qrSvg,
  diasRestantes,
  fechaCorta,
  fechaLarga,
  fechaConAnio,
  mesLargo,
  claveMes,
  COLOR_NIVEL,
  type Nivel,
} from "@/lib/ugc/loyalty";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * Cuántos movimientos del ledger se traen.
 *
 * No es solo cuántos se muestran: los hitos de nivel se deducen sumando el
 * acumulado desde el primer evento, así que con el ledger cortado la cuenta
 * daría mal. Si algún día un creador pasa este número, los hitos se apagan
 * solos (ver `ledgerCompleto`) en vez de mentir.
 */
const MAX_EVENTOS = 300;

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
        .select("id, coupon_id, code, status, claimed_at, expires_at, redeemed_at")
        .order("claimed_at", { ascending: false }),
      supabase
        .from("points_events")
        .select("id, action, points, reference_type, reference_id, created_at")
        .order("created_at", { ascending: false })
        .limit(MAX_EVENTOS),
    ]);

  // Las reglas se leen de la base y NO se hardcodean acá: el día que se ajuste
  // la economía con un UPDATE, esta lista tiene que cambiar sola o pasa a
  // mentir. El total de eventos es para no cortar el historial en silencio.
  const [{ data: reglasDb }, { count: totalEventos }] = await Promise.all([
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
      ? supabase
          .from("brand_profiles")
          .select("profile_id, brand_name, logo_url, location")
          .in("profile_id", brandIds)
      : Promise.resolve({
          data: [] as {
            profile_id: string;
            brand_name: string;
            logo_url: string | null;
            location: string | null;
          }[],
        }),
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

    // La misma vigencia en corto: en un chip no entra "14 días desde el
    // reclamo", pero "Vigencia 14 días" dice lo mismo de un vistazo.
    const vigenciaChip =
      c.type === "evento" && c.event_date
        ? fechaCorta(c.event_date)
        : c.claim_validity_days
          ? `Vigencia ${c.claim_validity_days} días`
          : c.expires_at
            ? `Hasta ${fechaCorta(c.expires_at)}`
            : null;

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
      brandLocation: marca?.location ?? null,
      brandLogo: marca?.logo_url ?? null,
      imageUrl: c.image_url,
      stockAvailable: stock?.stock_available ?? 0,
      stockTotal: stock?.stock_total ?? c.stock_total,
      vigencia,
      vigenciaChip,
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
    const marca = marcaDe.get(cupon?.brand_id ?? "");
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
      brandName: marca?.brand_name ?? "Marca de UGC·CRC",
      brandLocation: marca?.location ?? null,
      brandLogo: marca?.logo_url ?? null,
      type: cupon?.type ?? "producto",
      estado,
      reclamadoTexto: fechaConAnio(r.claimed_at),
      venceTexto: fechaLarga(r.expires_at),
      venceCorto: fechaCorta(r.expires_at),
      diasRestantes: dias,
      canjeadoTexto: r.redeemed_at ? fechaCorta(r.redeemed_at) : null,
      eventLocation: cupon?.event_location ?? null,
      qr: qrPorCodigo.get(r.code) ?? null,
    };
  });

  // ── Los tres números del encabezado ──
  // Los tres salen de datos que ya existen. "Marcas visitadas" son las marcas
  // donde el cupón se canjeó de verdad: un canje lo confirma alguien del local
  // escaneando el QR, así que es literalmente haber ido.
  const canjeados = (reclamos ?? []).filter((r) => r.status === "canjeado");
  const stats = [
    {
      num: mios.filter((m) => m.estado === "por_usar").length,
      label: (n: number) => (n === 1 ? "cupón por usar" : "cupones por usar"),
    },
    { num: canjeados.length, label: (n: number) => (n === 1 ? "canje hecho" : "canjes hechos") },
    {
      num: new Set(canjeados.map((r) => porId.get(r.coupon_id)?.brand_id).filter(Boolean)).size,
      label: (n: number) => (n === 1 ? "marca visitada" : "marcas visitadas"),
    },
  ];

  // ── Historial ──
  // La referencia: para lo que nació de una aplicación se muestra la marca y el
  // nombre de la campaña, que es como el creador lo recuerda ("el reel de
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
    ? await supabase.from("campaigns").select("id, title, brand_id").in("id", campaignIds)
    : { data: [] };

  const marcasCampana = [...new Set((campanas ?? []).map((c) => c.brand_id))];
  const { data: marcasDeCampanas } = marcasCampana.length
    ? await supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", marcasCampana)
    : { data: [] };
  const nombreMarcaCampana = new Map((marcasDeCampanas ?? []).map((m) => [m.profile_id, m.brand_name]));

  // Dos saltos y no un embed: los tipos de la base están escritos a mano y no
  // declaran relaciones, así que PostgREST no puede tipar el anidado. Es además
  // lo que ya hace la pantalla de Mis aplicaciones.
  const campanaDe = new Map((campanas ?? []).map((c) => [c.id, c]));
  const refDe = new Map(
    (aplicaciones ?? []).map((a) => {
      const campana = campanaDe.get(a.campaign_id);
      return [
        a.id,
        [campana ? nombreMarcaCampana.get(campana.brand_id) : null, campana?.title]
          .filter(Boolean)
          .join(" · "),
      ];
    })
  );

  const filas: (FilaHistorial & { fecha: string })[] = (historial ?? []).map((e) => ({
    id: e.id,
    fecha: e.created_at,
    titulo: labelAccion(e.action),
    detalle: [
      e.reference_type === "application"
        ? refDe.get(e.reference_id ?? "")
        : e.reference_type === "book_piece"
          ? "Mi book"
          : null,
      fechaCorta(e.created_at),
    ]
      .filter(Boolean)
      .join(" · "),
    puntos: e.points,
    etiqueta: null,
    esHito: false,
  }));

  // Reclamar un cupón no da ni quita puntos, pero es parte de la historia del
  // creador en el módulo: sin esto, "Mis cupones" y el historial contaban dos
  // vidas distintas. Sale de `redemptions.claimed_at`, no de una regla nueva.
  for (const r of reclamos ?? []) {
    const cupon = porId.get(r.coupon_id);
    filas.push({
      id: `reclamo-${r.id}`,
      fecha: r.claimed_at,
      titulo: "Cupón reclamado",
      detalle: [marcaDe.get(cupon?.brand_id ?? "")?.brand_name, cupon?.title, fechaCorta(r.claimed_at)]
        .filter(Boolean)
        .join(" · "),
      puntos: null,
      etiqueta: "Sin costo",
      esHito: false,
    });
  }

  // Los hitos de nivel NO están en la base: se deducen recorriendo el ledger de
  // más viejo a más nuevo y viendo en qué movimiento el acumulado cruzó cada
  // umbral. Es dato real, no una fila inventada — por eso se apagan si el
  // ledger vino cortado, donde el acumulado arrancaría a mitad de camino.
  const ledgerCompleto = (totalEventos ?? 0) <= MAX_EVENTOS;
  if (ledgerCompleto) {
    const ascendente = [...(historial ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const pendientes = escalera.filter((n) => n.min_points > 0);
    let acumulado = 0;
    for (const e of ascendente) {
      acumulado += e.points;
      while (pendientes.length && acumulado >= pendientes[0].min_points) {
        const nivel = pendientes.shift()!;
        filas.push({
          id: `hito-${nivel.level}`,
          fecha: e.created_at,
          titulo: `Nivel ${nivel.name} alcanzado`,
          detalle: fechaLarga(e.created_at),
          puntos: null,
          etiqueta: "Hito",
          esHito: true,
        });
      }
    }
  }

  filas.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const meses: MesHistorial[] = [];
  for (const fila of filas) {
    const clave = claveMes(fila.fecha);
    let mes = meses.find((m) => m.clave === clave);
    if (!mes) {
      mes = { clave, titulo: mesLargo(fila.fecha), total: 0, filas: [] };
      meses.push(mes);
    }
    mes.total += fila.puntos ?? 0;
    mes.filas.push(fila);
  }

  const camino: NivelCamino[] = escalera.map((n) => ({
    level: n.level,
    name: n.name,
    alcanzado: totalPoints >= n.min_points,
    esActual: n.level === actual?.level,
  }));

  const reglas: ReglaPuntos[] = (reglasDb ?? []).map((r) => ({
    action: r.action,
    label: labelAccion(r.action),
    points: r.points,
    limite: r.once_only
      ? "Una sola vez"
      : r.monthly_cap
        ? `Hasta ${r.monthly_cap} por mes`
        : "Sin límite",
  }));

  const colorActual = COLOR_NIVEL[actual?.level ?? 1] ?? "#6d54f3";

  return (
    <div>
      <h1 className={styles.feedTitle} style={{ marginBottom: "16px" }}>
        Recompensas
      </h1>

      {/* ── Puntos, nivel y los tres números ── */}
      <div className={styles.recCard}>
        <div className={styles.recPuntosLabel}>Tus puntos</div>
        <div className={styles.recPuntosFila}>
          <div className={styles.recPuntos}>
            {totalPoints.toLocaleString("es-CR")}
            <span className={styles.recPuntosUnidad}>pts</span>
          </div>
          <span className={styles.recNivelPill}>
            <span className={styles.recNivelDot} style={{ background: colorActual }} />
            Nivel {actual?.name ?? "Bronce"}
          </span>
        </div>

        <div className={styles.recBarra}>
          <div className={styles.recBarraFill} style={{ width: `${progreso}%`, background: colorActual }} />
        </div>
        <div className={styles.recBarraPies}>
          <span>{(actual?.min_points ?? 0).toLocaleString("es-CR")}</span>
          <span className={styles.recBarraFalta}>
            {siguiente
              ? `Faltan ${faltan.toLocaleString("es-CR")} pts para ${siguiente.name.toLowerCase()}`
              : "Llegaste al nivel más alto"}
          </span>
          <span>{siguiente ? siguiente.min_points.toLocaleString("es-CR") : ""}</span>
        </div>

        <div className={styles.recStats}>
          {stats.map((s) => (
            <div key={s.label(2)} className={styles.recStat}>
              <div className={styles.recStatNum}>{s.num}</div>
              <div className={styles.recStatLabel}>{s.label(s.num)}</div>
            </div>
          ))}
        </div>
      </div>

      <RecompensasTabs
        disponibles={vistas}
        mios={mios}
        nivelActual={nivelActualNum}
        camino={camino}
        meses={meses}
        reglas={reglas}
        totalEventos={totalEventos ?? 0}
        mostrados={(historial ?? []).length}
      />
    </div>
  );
}
