"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarReclamoPorCodigo, type ReclamoEncontrado } from "@/lib/ugc/loyalty-marca";

export type BusquedaState = { error: string; reclamo?: never } | { error?: never; reclamo: ReclamoEncontrado } | null;

/**
 * Paso 1 del canje: buscar sin quemar.
 *
 * Existe separado de `canjearAction` a propósito. En el mostrador, quien
 * atiende necesita ver a quién tiene enfrente —handle, foto, nivel— antes de
 * confirmar; un botón único que canjea de una no deja verificar nada, y el
 * código se quema aunque la persona no sea la del cupón.
 */
export async function buscarCodigoAction(
  _prevState: BusquedaState,
  formData: FormData
): Promise<BusquedaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Escribí el código que te muestra el creador." };

  const reclamo = await buscarReclamoPorCodigo(supabase, code);
  if (!reclamo) {
    return {
      error: "No encontramos ese código. Verificá que esté bien escrito o pedile al creador que muestre el QR de nuevo.",
    };
  }

  return { reclamo };
}
