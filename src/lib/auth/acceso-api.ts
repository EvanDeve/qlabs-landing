import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Cliente = SupabaseClient<Database>;

export type Acceso =
  | { ok: true; user: { id: string }; supabase: Cliente; role: AppRole }
  | { ok: false; status: 401 | 403; error: string };

/**
 * El mismo control que `requireRole`, pero para un route handler.
 *
 * Existe porque `requireRole` termina en `redirect()`, y un `redirect` dentro
 * de una API contesta un 307 con HTML a algo que espera JSON. Lo que cambia es
 * la salida, no la regla: sesión → rol → **verificación**.
 *
 * Esa última parte era el agujero. Los handlers de `/api/*` chequeaban el rol a
 * mano y nada más, y `/api/*` tampoco está en el matcher del proxy
 * (`["/ugc/:path*", "/admin/:path*"]`), así que no había ninguna otra capa
 * atrás. Medido el 2026-08-26 con una cuenta que ni terminó el onboarding:
 * `/ugc/creador/transcripcion` la rebotaba a `/ugc/onboarding` y
 * `POST /api/ugc/transcribe` le contestaba 400 de validación — o sea que había
 * pasado el control de acceso. Y el rol lo elige la persona al registrarse.
 *
 * Admin queda exento de la verificación, igual que en `requireRole`: no tiene
 * fila en `creator_profiles` ni en `brand_profiles`, y su acceso lo da
 * `profiles.role`, que solo puede cambiar otro admin (`protect_role_change`).
 */
export async function accesoDeApi(rolesPermitidos: AppRole[]): Promise<Acceso> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Necesitás iniciar sesión." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;
  if (!role || !rolesPermitidos.includes(role)) {
    return { ok: false, status: 403, error: "Tu cuenta no tiene acceso a esto." };
  }

  if (role === "creator" || role === "brand") {
    const tabla = role === "creator" ? "creator_profiles" : "brand_profiles";
    const { data: fila } = await supabase
      .from(tabla)
      .select("verified")
      .eq("profile_id", user.id)
      .maybeSingle();

    // Sin fila es una cuenta que se registró y nunca terminó el onboarding: no
    // está "pendiente", directamente no existe como creador o marca.
    if (!fila?.verified) {
      return { ok: false, status: 403, error: "Tu cuenta todavía no está verificada." };
    }
  }

  return { ok: true, user: { id: user.id }, supabase, role };
}
