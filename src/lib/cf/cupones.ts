import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CuponVista } from "@/components/ugc/creador/CuponesGrid";
import type { MiCupon } from "@/components/ugc/creador/MisCupones";
import { qrSvg, diasRestantes, fechaCorta, fechaLarga, fechaConAnio } from "@/lib/ugc/loyalty";

/**
 * Los cupones del miembro, armados con los mismos tipos que Recompensas del
 * creador para usar las mismas tarjetas (`CuponesGrid`, `MisCupones`,
 * `CuponQR`). Qué cupones ve cada quien lo decide la RLS de `coupons`
 * (audiencia y alcance, 20260924130000), no este archivo.
 *
 * - `disponibles`: publicados o agotados que todavía no reclamó.
 * - `mios`: su wallet — lo reclamado, con su estado y su QR.
 */
export async function cuponesDelMiembro(supabase: SupabaseClient<Database>): Promise<{
  disponibles: CuponVista[];
  mios: MiCupon[];
}> {
  const [{ data: publicados }, { data: reclamos }] = await Promise.all([
    supabase
      .from("coupons")
      .select("*")
      .in("status", ["publicado", "agotado"])
      .order("created_at", { ascending: false }),
    supabase
      .from("redemptions")
      .select("id, coupon_id, code, status, claimed_at, expires_at, redeemed_at")
      .order("claimed_at", { ascending: false }),
  ]);

  // Los reclamados pueden estar pausados o vencidos: se leen aparte (la policy
  // `coupons_select_reclamados_por_mi` los deja ver igual).
  const idsReclamados = [...new Set((reclamos ?? []).map((r) => r.coupon_id))];
  const { data: reclamados } = idsReclamados.length
    ? await supabase.from("coupons").select("*").in("id", idsReclamados)
    : { data: [] };

  const porId = new Map([...(publicados ?? []), ...(reclamados ?? [])].map((c) => [c.id, c]));
  const brandIds = [...new Set([...porId.values()].map((c) => c.brand_id))];
  const libres = (publicados ?? []).filter((c) => !idsReclamados.includes(c.id));

  const [{ data: marcas }, { data: stocks }] = await Promise.all([
    brandIds.length
      ? supabase.from("brand_public_profiles").select("profile_id, brand_name, logo_url, location").in("profile_id", brandIds)
      : Promise.resolve({ data: [] as { profile_id: string; brand_name: string; logo_url: string | null; location: string | null }[] }),
    libres.length
      ? supabase.from("coupon_stock").select("*").in("coupon_id", libres.map((c) => c.id))
      : Promise.resolve({ data: [] as { coupon_id: string; stock_total: number; stock_available: number }[] }),
  ]);
  const marcaDe = new Map((marcas ?? []).map((m) => [m.profile_id, m]));
  const stockDe = new Map((stocks ?? []).map((s) => [s.coupon_id, s]));

  const disponibles: CuponVista[] = libres.map((c) => {
    const marca = marcaDe.get(c.brand_id);
    const stock = stockDe.get(c.id);
    return {
      id: c.id,
      title: c.title,
      type: c.type,
      description: c.description,
      conditions: c.conditions,
      // Los miembros no tienen niveles: todo cupón está desbloqueado.
      minLevel: 1,
      minLevelName: "",
      puntosFaltantes: 0,
      brandName: marca?.brand_name ?? "Negocio",
      brandLocation: marca?.location ?? null,
      brandLogo: marca?.logo_url ?? null,
      imageUrl: c.image_url,
      stockAvailable: stock?.stock_available ?? 0,
      stockTotal: stock?.stock_total ?? c.stock_total,
      vigencia:
        c.type === "evento" && c.event_date
          ? fechaLarga(c.event_date)
          : c.claim_validity_days
            ? `${c.claim_validity_days} días desde el reclamo`
            : c.expires_at
              ? `hasta el ${fechaLarga(c.expires_at)}`
              : "—",
      vigenciaChip:
        c.type === "evento" && c.event_date
          ? fechaCorta(c.event_date)
          : c.claim_validity_days
            ? `Vigencia ${c.claim_validity_days} días`
            : c.expires_at
              ? `Hasta ${fechaCorta(c.expires_at)}`
              : null,
      eventLocation: c.event_location,
      reclamo: null,
    };
  });
  // Primero lo que se puede reclamar hoy; los agotados al final.
  disponibles.sort((a, b) => Number(a.stockAvailable <= 0) - Number(b.stockAvailable <= 0));

  // El QR solo para lo que todavía se puede usar: es lo único que se muestra.
  const qrDe = new Map(
    await Promise.all(
      (reclamos ?? [])
        .filter((r) => r.status === "reclamado" && new Date(r.expires_at) >= new Date())
        .map(async (r) => [r.code, await qrSvg(r.code)] as const)
    )
  );

  const mios: MiCupon[] = (reclamos ?? []).map((r) => {
    const cupon = porId.get(r.coupon_id);
    const marca = marcaDe.get(cupon?.brand_id ?? "");
    const dias = diasRestantes(r.expires_at);
    return {
      id: r.id,
      code: r.code,
      title: cupon?.title ?? "Cupón",
      brandName: marca?.brand_name ?? "Negocio",
      brandLocation: marca?.location ?? null,
      brandLogo: marca?.logo_url ?? null,
      type: cupon?.type ?? "producto",
      estado: r.status === "canjeado" ? "canjeado" : r.status === "expirado" || dias < 0 ? "vencido" : "por_usar",
      reclamadoTexto: fechaConAnio(r.claimed_at),
      venceTexto: fechaLarga(r.expires_at),
      venceCorto: fechaCorta(r.expires_at),
      diasRestantes: dias,
      canjeadoTexto: r.redeemed_at ? fechaCorta(r.redeemed_at) : null,
      eventLocation: cupon?.event_location ?? null,
      qr: qrDe.get(r.code) ?? null,
    };
  });

  return { disponibles, mios };
}
