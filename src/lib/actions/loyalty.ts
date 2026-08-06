"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { qrSvg } from "@/lib/ugc/loyalty";

export type ReclamarState =
  | { error: string; reclamo?: never }
  | { error?: never; reclamo: { code: string; expires_at: string; qr: string } }
  | null;

/**
 * Reclamar un cupón.
 *
 * Toda la validación —nivel, stock, estado del cupón, reclamo previo— pasa
 * adentro de `claim_coupon`, en una transacción con lock. Acá no se re-chequea
 * nada: hacerlo daría una segunda opinión que puede diferir de la que manda, y
 * entre el chequeo y el insert cabe otro creador llevándose el último lugar.
 *
 * Los mensajes de error vienen escritos de la base en español y se muestran tal
 * cual: cada uno dice qué pasó ("Ya reclamaste este cupón", "Se agotaron los
 * cupones de esta recompensa"), que es lo que el creador necesita saber.
 */
export async function reclamarCuponAction(
  _prevState: ReclamarState,
  formData: FormData
): Promise<ReclamarState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const couponId = String(formData.get("coupon_id") ?? "");
  if (!couponId) {
    return { error: "Cupón inválido." };
  }

  const { data, error } = await supabase.rpc("claim_coupon", { p_coupon: couponId });

  if (error) {
    // `message` es el texto del `raise exception`. Si el error viene de otro
    // lado (red, permisos), no se le muestra crudo al creador.
    const esperado = error.message?.trim();
    return {
      error:
        esperado && esperado.length < 120
          ? esperado
          : "No se pudo reclamar el cupón. Intentá de nuevo.",
    };
  }

  const reclamo = data as { code: string; expires_at: string } | null;
  if (!reclamo?.code) {
    return { error: "No se pudo reclamar el cupón. Intentá de nuevo." };
  }

  // El QR se arma acá y viaja con la respuesta para que el modal se abra al
  // instante con el código adentro. Al recargar, la página lo genera de nuevo
  // del lado del servidor — no se guarda en ningún lado porque es una función
  // pura del código.
  const qr = await qrSvg(reclamo.code);

  revalidatePath("/ugc/creador/recompensas");

  return { reclamo: { code: reclamo.code, expires_at: reclamo.expires_at, qr } };
}
