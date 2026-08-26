import { createClient } from "@/lib/supabase/server";
import LoyaltyMarcaTabs, { type CuponMarca, type CanjeFila } from "@/components/ugc/marca/LoyaltyMarcaTabs";
import { fechaCorta, fechaLarga } from "@/lib/ugc/loyalty";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function LoyaltyMarcaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: marca }, { data: cupones }, { data: umbrales }] = await Promise.all([
    supabase.from("brand_profiles").select("brand_name").eq("profile_id", user!.id).maybeSingle(),
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
          .select("id, coupon_id, creator_id, code, status, claimed_at, redeemed_at, expires_at")
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

  // Cuántos creadores tienen un código vivo de cada cupón, y hasta cuándo.
  // Pausar NO invalida lo ya reclamado —y está bien, esa gente ya se
  // comprometió— pero la marca tenía que enterarse por las malas: pausaba
  // creyendo que cortaba el grifo y seguía llegando gente al local.
  const vigentesDe = new Map<string, { cuantos: number; ultimo: string }>();
  for (const r of reclamos ?? []) {
    if (r.status !== "reclamado") continue;
    const previo = vigentesDe.get(r.coupon_id);
    vigentesDe.set(r.coupon_id, {
      cuantos: (previo?.cuantos ?? 0) + 1,
      ultimo: !previo || r.expires_at > previo.ultimo ? r.expires_at : previo.ultimo,
    });
  }

  const cuponesVista: CuponMarca[] = lista.map((c) => {
    const stock = stockDe.get(c.id);
    const vigentes = vigentesDe.get(c.id);
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
      imageUrl: c.image_url,
      claimValidityDays: c.claim_validity_days,
      // El <input type="date"> quiere YYYY-MM-DD en hora local de Costa Rica.
      // Cortar el ISO con slice(0,10) daría el día de UTC, que después de las
      // 6 p.m. es el día siguiente — el evento aparecería corrido un día.
      eventDateInput: c.event_date
        ? new Date(c.event_date).toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" })
        : null,
      reclamosVigentes: vigentes?.cuantos ?? 0,
      ultimoVence: vigentes ? fechaLarga(vigentes.ultimo) : null,
    };
  });

  // Server Component con `force-dynamic`: se renderiza una vez por visita, y
  // así además todas las filas miden contra el mismo instante.
  // eslint-disable-next-line react-hooks/purity
  const ahora = Date.now();
  const canjes: CanjeFila[] = (reclamos ?? []).map((r) => ({
    id: r.id,
    fecha: fechaCorta(r.redeemed_at ?? r.claimed_at),
    handle: handleDe.get(r.creator_id) ?? "Creador",
    nivel: nombreNivel.get(nivelDe.get(r.creator_id) ?? 1) ?? "Bronce",
    cupon: tituloDe.get(r.coupon_id) ?? "Cupón",
    code: r.code,
    status: r.status,
    vence: r.expires_at ? fechaCorta(r.expires_at) : null,
    // Días que le quedan. Es lo que dice si hay que apurar a alguien, y una
    // fecha suelta obliga a hacer la cuenta de cabeza.
    diasRestantes: r.expires_at
      ? Math.ceil((new Date(r.expires_at).getTime() - ahora) / 86_400_000)
      : null,
  }));

  return (
    <div className={styles.mcCol}>
      <LoyaltyMarcaTabs
        cupones={cuponesVista}
        canjes={canjes}
        niveles={(umbrales ?? []).map((n) => ({ level: n.level, name: n.name }))}
        nombreMarca={marca?.brand_name ?? "tu negocio"}
      />
    </div>
  );
}
