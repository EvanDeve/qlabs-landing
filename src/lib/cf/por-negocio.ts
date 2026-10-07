import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type NegocioCf = {
  id: string;
  nombre: string;
  miembros: number;
  escaneos: number;
  registros: number;
  reclamados: number;
  canjeados: number;
};

export type VinculoCf = { member_id: string; brand_id: string };

/**
 * Close Friends negocio por negocio: lo usan la pantalla de Close Friends y el
 * Resumen de UGC, y vive acá para que los dos digan el mismo número.
 *
 * Entran los negocios que tocan el programa: con QR o con algún miembro. Los
 * canjes son los que no son de creadores (esos son Loyalty Loop). Por
 * `creator_id` y no por `member_id`: el canje de alguien que pidió que lo
 * borraran queda sin titular, y sigue siendo un canje del negocio.
 */
export async function cargarCfPorNegocio(
  supabase: SupabaseClient<Database>
): Promise<{ negocios: NegocioCf[]; vinculos: VinculoCf[] }> {
  const [{ data: vinculos }, { data: codigos }, { data: canjes }] = await Promise.all([
    supabase.from("member_brand_links").select("member_id, brand_id"),
    supabase.from("brand_invite_codes").select("brand_id, scans, signups"),
    supabase.from("redemptions").select("coupon_id, status").is("creator_id", null),
  ]);

  const listaVinculos = vinculos ?? [];
  const listaCanjes = canjes ?? [];
  const brandIds = [
    ...new Set([...(codigos ?? []).map((c) => c.brand_id), ...listaVinculos.map((v) => v.brand_id)]),
  ];
  const couponIds = [...new Set(listaCanjes.map((r) => r.coupon_id))];
  const [{ data: marcas }, { data: cupones }] = await Promise.all([
    brandIds.length
      ? supabase.from("brand_profiles").select("profile_id, brand_name").in("profile_id", brandIds)
      : Promise.resolve({ data: [] as { profile_id: string; brand_name: string }[] }),
    couponIds.length
      ? supabase.from("coupons").select("id, brand_id").in("id", couponIds)
      : Promise.resolve({ data: [] as { id: string; brand_id: string }[] }),
  ]);
  const nombreDeMarca = new Map((marcas ?? []).map((m) => [m.profile_id, m.brand_name]));
  const marcaDeCupon = new Map((cupones ?? []).map((c) => [c.id, c.brand_id]));

  const porNegocio = new Map<string, NegocioCf>(
    brandIds.map((id) => [
      id,
      {
        id,
        nombre: nombreDeMarca.get(id) ?? "Negocio sin nombre",
        miembros: 0,
        escaneos: 0,
        registros: 0,
        reclamados: 0,
        canjeados: 0,
      },
    ])
  );
  for (const v of listaVinculos) porNegocio.get(v.brand_id)!.miembros++;
  for (const c of codigos ?? []) {
    const f = porNegocio.get(c.brand_id)!;
    f.escaneos += c.scans;
    f.registros += c.signups;
  }
  for (const r of listaCanjes) {
    const f = porNegocio.get(marcaDeCupon.get(r.coupon_id) ?? "");
    if (!f) continue;
    f.reclamados++;
    if (r.status === "canjeado") f.canjeados++;
  }

  const negocios = [...porNegocio.values()].sort(
    (a, b) => b.miembros - a.miembros || a.nombre.localeCompare(b.nombre, "es")
  );
  return { negocios, vinculos: listaVinculos };
}
