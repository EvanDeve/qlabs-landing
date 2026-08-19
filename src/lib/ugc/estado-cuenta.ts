import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole, Database } from "@/lib/database.types";
import { ROLE_DASHBOARD } from "@/lib/ugc/roles";

/**
 * En qué punto de la verificación está una cuenta de creador o de marca.
 *
 * Sale de dos columnas y no de un enum a propósito: `verified` ya era la fuente
 * de verdad de "puede operar" en media app y en cinco policies de RLS, así que
 * el rechazo se sumó al lado (`rejected_at`) en vez de reemplazarlo. Ver la
 * migración 20260807000000.
 */
export type EstadoCuenta = "pendiente" | "verificada" | "rechazada";

export type FilaVerificable = {
  verified: boolean;
  rejected_at: string | null;
  rejection_reason?: string | null;
};

export function estadoCuenta(fila: FilaVerificable): EstadoCuenta {
  if (fila.verified) return "verificada";
  return fila.rejected_at ? "rechazada" : "pendiente";
}

/** La pantalla de espera para todo el que no está verificado. */
export const RUTA_PENDIENTE = "/ugc/pendiente";

/**
 * A dónde mandar a alguien que tiene sesión. Es el ÚNICO lugar que arma esta
 * decisión: la usan el login (página y server action), el onboarding y el botón
 * "Ir a mi panel" del nav público. Con la lógica repetida en cinco lados,
 * cualquiera de ellos podía dejar entrar a una cuenta sin verificar.
 *
 * Admin queda exento del gate: no tiene fila en creator_profiles/brand_profiles
 * y su acceso lo da `profiles.role`, que solo cambia otro admin.
 */
export async function destinoDeSesion(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile?.role) return "/ugc/onboarding";

  const role = profile.role as AppRole;
  if (role === "admin") return ROLE_DASHBOARD.admin;

  const tabla = role === "creator" ? "creator_profiles" : "brand_profiles";
  const { data: fila } = await supabase
    .from(tabla)
    .select("verified, rejected_at")
    .eq("profile_id", userId)
    .maybeSingle();

  // El registro puede quedar a medias: el trigger `handle_new_user` ya dejó el
  // rol puesto desde el metadata del signup, pero la fila del perfil se crea
  // recién al terminar el onboarding. Sin ella el panel saldría vacío.
  if (!fila) return "/ugc/onboarding";

  return fila.verified ? ROLE_DASHBOARD[role] : RUTA_PENDIENTE;
}

/**
 * Aplica el `next` de un login sobre el destino que le toca a la sesión.
 *
 * `next` es de dónde venía quien rebotó al login (lo pone el middleware) y es
 * texto que llega por la URL, así que no se puede obedecer a ciegas:
 *
 * - Solo se respeta si la cuenta ya puede entrar a un panel. Si no, un link con
 *   ?next=/ugc/creador dejaría a una cuenta sin verificar aterrizando adentro
 *   (el layout la rebota igual, pero el rebote se ve y confunde).
 * - Tiene que ser una ruta del propio sitio. Sin esto, ?next=https://otro.sitio
 *   o ?next=//otro.sitio convierten el login en un redirector abierto: un link
 *   con el dominio de Q Labs que termina en otro lado.
 * - Y tiene que caer dentro del árbol al que esa cuenta entra, para que un
 *   creador con ?next=/admin/equipo no se vaya a chocar contra el panel del
 *   equipo.
 */
export function destinoConNext(destino: string, next?: string): string {
  if (!next) return destino;
  if (destino === "/ugc/onboarding" || destino === RUTA_PENDIENTE) return destino;
  if (!next.startsWith("/") || next.startsWith("//")) return destino;
  if (next !== destino && !next.startsWith(`${destino}/`) && !next.startsWith(`${destino}?`)) {
    return destino;
  }
  return next;
}
