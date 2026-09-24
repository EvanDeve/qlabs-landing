import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { MiCupon } from "@/components/ugc/creador/MisCupones";
import { qrSvg, diasRestantes, fechaCorta, fechaLarga, fechaConAnio } from "@/lib/ugc/loyalty";

/**
 * La wallet del miembro, armada con los mismos tipos que Recompensas del
 * creador para usar las mismas tarjetas (`MisCupones`, `CuponQR`). Son solo
 * los cupones que tiene: se consiguen escaneando su QR, no hay vitrina
 * (20260924180000). La RLS de `coupons` le deja leer la ficha de lo que
 * reclamó aunque la marca la haya pausado (`tengo_reclamo`).
 */
export async function cuponesDelMiembro(supabase: SupabaseClient<Database>): Promise<{ mios: MiCupon[] }> {
  const { data: reclamos } = await supabase
    .from("redemptions")
    .select("id, coupon_id, code, status, claimed_at, expires_at, redeemed_at")
    .order("claimed_at", { ascending: false });

  const ids = [...new Set((reclamos ?? []).map((r) => r.coupon_id))];
  const { data: cupones } = ids.length
    ? await supabase.from("coupons").select("id, title, type, brand_id, event_location").in("id", ids)
    : { data: [] };
  const porId = new Map((cupones ?? []).map((c) => [c.id, c]));

  const brandIds = [...new Set((cupones ?? []).map((c) => c.brand_id))];
  const { data: marcas } = brandIds.length
    ? await supabase.from("brand_public_profiles").select("profile_id, brand_name, logo_url, location").in("profile_id", brandIds)
    : { data: [] };
  const marcaDe = new Map((marcas ?? []).map((m) => [m.profile_id, m]));

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

  return { mios };
}
