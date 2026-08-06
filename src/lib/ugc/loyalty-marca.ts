import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ReclamoEncontrado = {
  code: string;
  status: string;
  expiresAt: string;
  couponTitle: string;
  couponType: string;
  esEvento: boolean;
  creatorHandle: string;
  creatorAvatar: string | null;
  creatorLevel: number;
  creatorLevelName: string;
};

/**
 * Buscar un reclamo por su código, para la pantalla de validación.
 *
 * No filtra por marca a mano: la RLS de `redemptions` ya solo deja ver los
 * reclamos de los cupones propios. Un código de otra marca devuelve null, que
 * es exactamente la misma respuesta que un código inventado — y así tiene que
 * ser, o la pantalla se vuelve un oráculo para adivinar códigos ajenos.
 *
 * El nivel del creador sale de `creator_level()`, que es security definer: la
 * marca puede ver el nivel de cualquier creador, pero no su ledger.
 */
export async function buscarReclamoPorCodigo(
  supabase: SupabaseClient<Database>,
  code: string
): Promise<ReclamoEncontrado | null> {
  const limpio = code.trim().toUpperCase();
  if (!limpio) return null;

  const { data: reclamo } = await supabase
    .from("redemptions")
    .select("code, status, expires_at, coupon_id, creator_id")
    .eq("code", limpio)
    .maybeSingle();

  if (!reclamo) return null;

  const [{ data: cupon }, { data: creador }, { data: nivel }] = await Promise.all([
    supabase.from("coupons").select("title, type").eq("id", reclamo.coupon_id).maybeSingle(),
    supabase
      .from("creator_public_profiles")
      .select("handle, avatar_url")
      .eq("profile_id", reclamo.creator_id)
      .maybeSingle(),
    supabase.rpc("creator_level", { p_creator: reclamo.creator_id }),
  ]);

  const nivelNum = typeof nivel === "number" ? nivel : 1;
  const { data: umbral } = await supabase
    .from("level_thresholds")
    .select("name")
    .eq("level", nivelNum)
    .maybeSingle();

  return {
    code: reclamo.code,
    status: reclamo.status,
    expiresAt: reclamo.expires_at,
    couponTitle: cupon?.title ?? "Cupón",
    couponType: cupon?.type ?? "producto",
    esEvento: cupon?.type === "evento",
    creatorHandle: creador?.handle ?? "Creador",
    creatorAvatar: creador?.avatar_url ?? null,
    creatorLevel: nivelNum,
    creatorLevelName: umbral?.name ?? "Bronce",
  };
}
