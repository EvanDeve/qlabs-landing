import { createClient } from "@/lib/supabase/server";
import LoyaltyMarcaTabs, { type CuponMarca, type CanjeFila } from "@/components/ugc/marca/LoyaltyMarcaTabs";
import { fechaCorta, fechaLarga } from "@/lib/ugc/loyalty";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function LoyaltyMarcaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: marca }, { data: cupones }, { data: umbrales }] = await Promise.all([
    supabase.from("brand_profiles").select("verified").eq("profile_id", user!.id).maybeSingle(),
    supabase.from("coupons").select("*").eq("brand_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("level_thresholds").select("*").order("min_points"),
  ]);

  const lista = cupones ?? [];
  const ids = lista.map((c) => c.id);

  const [{ data: stocks }, { data: reclamos }] = await Promise.all([
    ids.length
      ? supabase.from("coupon_stock").select("*").in("coupon_id", ids)
      : Promise.resolve({ data: [] as { coupon_id: string; stock_total: number; stock_available: number }[] }),
    ids.length
      ? supabase
          .from("redemptions")
          .select("id, coupon_id, creator_id, code, status, claimed_at, redeemed_at")
          .in("coupon_id", ids)
          .order("claimed_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const stockDe = new Map((stocks ?? []).map((s) => [s.coupon_id, s]));
  const nombreNivel = new Map((umbrales ?? []).map((n) => [n.level, n.name]));

  // El nivel de cada creador sale de `creator_level()` una vez por persona, no
  // una por fila: en un canje repetido la misma cuenta aparece varias veces.
  const creatorIds = [...new Set((reclamos ?? []).map((r) => r.creator_id))];
  const [{ data: creadores }, niveles] = await Promise.all([
    creatorIds.length
      ? supabase.from("creator_public_profiles").select("profile_id, handle").in("profile_id", creatorIds)
      : Promise.resolve({ data: [] as { profile_id: string; handle: string }[] }),
    Promise.all(
      creatorIds.map(async (id) => {
        const { data } = await supabase.rpc("creator_level", { p_creator: id });
        return [id, typeof data === "number" ? data : 1] as const;
      })
    ),
  ]);

  const handleDe = new Map((creadores ?? []).map((c) => [c.profile_id, c.handle]));
  const nivelDe = new Map(niveles);
  const tituloDe = new Map(lista.map((c) => [c.id, c.title]));

  const cuponesVista: CuponMarca[] = lista.map((c) => {
    const stock = stockDe.get(c.id);
    return {
      id: c.id,
      title: c.title,
      type: c.type,
      description: c.description,
      status: c.status,
      minLevel: c.min_level,
      minLevelName: nombreNivel.get(c.min_level) ?? `Nivel ${c.min_level}`,
      stockTotal: stock?.stock_total ?? c.stock_total,
      stockAvailable: stock?.stock_available ?? c.stock_total,
      vigencia:
        c.type === "evento" && c.event_date
          ? fechaLarga(c.event_date)
          : c.claim_validity_days
            ? `${c.claim_validity_days} días desde el reclamo`
            : c.expires_at
              ? `hasta el ${fechaLarga(c.expires_at)}`
              : "—",
      eventLocation: c.event_location,
      conditions: c.conditions,
    };
  });

  const canjes: CanjeFila[] = (reclamos ?? []).map((r) => ({
    id: r.id,
    fecha: fechaCorta(r.redeemed_at ?? r.claimed_at),
    handle: handleDe.get(r.creator_id) ?? "Creador",
    nivel: nombreNivel.get(nivelDe.get(r.creator_id) ?? 1) ?? "Bronce",
    cupon: tituloDe.get(r.coupon_id) ?? "Cupón",
    code: r.code,
    status: r.status,
  }));

  const activos = lista.filter((c) => c.status === "publicado").length;
  const reclamados = (reclamos ?? []).length;
  const canjeados = (reclamos ?? []).filter((r) => r.status === "canjeado").length;

  const kpis = [
    { label: "Cupones activos", value: activos, icon: "sparkle", color: "#6d54f3" },
    { label: "Reclamos totales", value: reclamados, icon: "users", color: "#c07414" },
    { label: "Canjes confirmados", value: canjeados, icon: "check", color: "#14a06a" },
  ];

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px", marginBottom: "4px" }}>
        Loyalty Loop
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "24px", maxWidth: "68ch" }}>
        Creá cupones para atraer creadores, definí quién puede reclamarlos según su nivel, y validá
        los canjes en tu local con un escaneo.
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

      <div style={{ marginTop: "26px" }}>
        <LoyaltyMarcaTabs
          cupones={cuponesVista}
          canjes={canjes}
          niveles={(umbrales ?? []).map((n) => ({ level: n.level, name: n.name }))}
          verificada={Boolean(marca?.verified)}
        />
      </div>
    </div>
  );
}
