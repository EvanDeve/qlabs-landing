import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type TipoDeAcceso = "invite" | "recovery";

/**
 * Arma el link de los correos de acceso (invitación al equipo y recuperar
 * contraseña) apuntando a NUESTRA página, no al `/auth/v1/verify` de Supabase.
 *
 * El link que arma Supabase (`action_link`) gasta el token con el solo GET. Los
 * filtros de correo corporativos (Microsoft Safe Links, Proofpoint, Mimecast)
 * abren cada link de un correo entrante para revisarlo antes de que llegue a
 * la bandeja: el token se quema ahí, y cuando la persona aprieta el botón ve
 * "el link no es válido o ya venció". Le pasó a la primera invitación a una
 * dirección de @heineken.com (2026-10-08): la cuenta quedó confirmada 46 s
 * después del envío y sin contraseña.
 *
 * Con `token_hash` el GET no gasta nada: /auth/set-password muestra un botón y
 * recién al apretarlo llama a `verifyOtp`. Los escáneres no aprietan botones.
 *
 * Tampoco depende de la allowlist de Redirect URLs, porque no hay redirect.
 *
 * Para `invite`, `generateLink` además crea la cuenta: devuelve el usuario.
 *
 * `comoInvitacion` es para "Reenviar acceso" desde Equipo: va por recovery
 * (sirve haya o no confirmado la cuenta), pero la pantalla tiene que hablarle a
 * alguien que entra por primera vez, no a quien se olvidó la clave.
 */
export async function generarLinkDeAcceso(
  admin: Admin,
  {
    tipo,
    email,
    data,
    comoInvitacion = tipo === "invite",
  }: { tipo: TipoDeAcceso; email: string; data?: Record<string, unknown>; comoInvitacion?: boolean }
) {
  const { data: generado, error } =
    tipo === "invite"
      ? await admin.auth.admin.generateLink({ type: "invite", email, options: { data } })
      : await admin.auth.admin.generateLink({ type: "recovery", email });

  const tokenHash = generado?.properties?.hashed_token;
  if (error || !tokenHash) return { error: error?.message ?? "Supabase no devolvió el token.", link: null, user: null };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const query = new URLSearchParams({ token_hash: tokenHash, tipo });
  // El texto de la pantalla (invitación o recuperación) lo decide `modo`, igual
  // que con los links viejos que todavía andan dando vueltas.
  if (!comoInvitacion) query.set("modo", "recuperar");

  return { error: null, link: `${siteUrl}/auth/set-password?${query}`, user: generado.user };
}

/** El botón de los correos de acceso, el mismo en los tres. */
export function botonDeCorreo(link: string, texto: string) {
  return `<p><a href="${link}" style="display:inline-block;background:#705CF6;color:#fff;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">${texto}</a></p>`;
}
