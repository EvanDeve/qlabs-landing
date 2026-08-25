"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { destinoDeSesion, destinoConNext } from "@/lib/ugc/estado-cuenta";

export type AuthActionState = { error: string } | { message: string } | null;

// El onboarding a medias (rol puesto por el trigger pero sin perfil todavía) y
// la cuenta sin verificar los resuelve `destinoDeSesion`, compartido con la
// página de login, el onboarding y el nav público.
async function redirectAfterLogin(userId: string, next?: string): Promise<never> {
  const supabase = await createClient();
  const destino = await destinoDeSesion(supabase, userId);
  redirect(destinoConNext(destino, next));
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[signInAction] supabase signIn error:", error.status, error.message);
    return { error: "Email o contraseña incorrectos." };
  }

  return await redirectAfterLogin(data.user.id, next);
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const role = String(formData.get("role") ?? "");

  if (role !== "creator" && role !== "brand") {
    return { error: "Elegí si sos creador o marca." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Poné un email válido." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== passwordConfirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role },
      emailRedirectTo: `${siteUrl}/ugc/auth/callback?next=/ugc/onboarding`,
    },
  });

  if (error) {
    console.error("[signUpAction] supabase signUp error:", error.status, error.message);
    return { error: error.message === "User already registered"
      ? "Ese email ya tiene una cuenta — iniciá sesión."
      : "No se pudo crear la cuenta. Intentá de nuevo." };
  }

  if (data.session) {
    // Sin confirmación por email la sesión arranca de una. El trigger ya dejó
    // seteado profiles.role, pero todavía falta crear el perfil de creador/marca
    // (handle, nichos, etc.), así que se manda SIEMPRE al onboarding — no al
    // dashboard, que sin ese perfil quedaría vacío/roto.
    redirect("/ugc/onboarding");
  }

  return { message: "Te enviamos un email para confirmar tu cuenta. Revisá tu bandeja de entrada." };
}

// NOTA: hoy ninguna UI llama a esta acción. El botón "Continuar con Google" se
// quitó de AuthForm porque el provider de Google NO está habilitado en el
// proyecto de Supabase (/auth/v1/settings devuelve `external` vacío), así que
// el click siempre terminaba en /ugc/login?error=google. Se deja el código listo:
// para reactivarlo, habilitá Google en Supabase → Auth → Providers y volvé a
// montar el botón en AuthForm.
export async function signInWithGoogleAction(intent?: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const next = intent ? `/ugc/onboarding?role=${intent}` : "/ugc/onboarding";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/ugc/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) {
    redirect("/ugc/login?error=google");
  }

  redirect(data.url);
}

export async function signOutAction() {
  const supabase = await createClient();

  // El rol se lee ANTES de cerrar la sesión: después, `getUser` ya no devuelve
  // a nadie y no habría con qué decidir a qué puerta volver. Este action lo
  // comparten los tres paneles (QosShell es el mismo componente), así que el
  // destino no se puede clavar.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let esAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    esAdmin = profile?.role === "admin";
  }

  await supabase.auth.signOut();
  redirect(esAdmin ? "/admin/login" : "/ugc/login");
}

const ESPERA_ENTRE_RESETS_MS = 60_000;
/** Una fila que ya no frena nada se borra; no vale la pena un cron para esto. */
const VIDA_DEL_FRENO_MS = 24 * 60 * 60 * 1000;

/**
 * Manda el correo para recuperar la contraseña. Lo comparten las dos puertas:
 * /admin/recuperar (equipo) y /ugc/recuperar (creadores y marcas).
 *
 * NO usa `supabase.auth.resetPasswordForEmail`, que sería lo obvio, por dos
 * razones concretas:
 *
 * 1. El cliente de @supabase/ssr habla PKCE. Con PKCE el link del correo solo
 *    sirve en el MISMO navegador que pidió el reset, porque el verifier queda
 *    en una cookie de acá. Y recuperar la contraseña es justo el caso donde la
 *    gente pide desde la compu y abre el correo en el teléfono: el link moría
 *    con "invalid request" y no había forma de que la persona entendiera por qué.
 * 2. El correo lo mandaría Supabase con su plantilla en inglés y su límite de
 *    envíos por hora, mientras el resto de la app ya manda todo por Resend
 *    desde notificaciones@qlabsmethod.com.
 *
 * `generateLink` arma el mismo link de recovery pero sin PKCE (token en el
 * fragmento, flujo implícito) y sin mandar nada — el correo lo mandamos
 * nosotros. Es exactamente la forma que ya sabe leer /auth/set-password,
 * que es como funcionan las invitaciones al equipo desde el día uno.
 */
export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Poné un email válido." };
  }

  // La misma respuesta exista o no la cuenta: si dijéramos "ese email no está
  // registrado", este formulario público serviría para averiguar quién tiene
  // cuenta en Q Labs probando direcciones de a una.
  const respuestaNeutra = {
    message: `Si ${email} tiene una cuenta, te mandamos un link para crear una contraseña nueva. Revisá tu correo (mirá también spam).`,
  };

  // Freno contra el bucle: el formulario es público y sin sesión, así que sin
  // esto cualquiera puede pedir mil resets seguidos para la dirección de otro y
  // llenarle la bandeja (y de paso quemarnos la cuota de Resend).
  //
  // Vive en la base y no en memoria del proceso: en Vercel hay varias
  // instancias y cada deploy las reinicia, así que un Map frenaba a quien
  // cayera dos veces en la misma máquina y a nadie más.
  const admin = createAdminClient();
  const ahora = Date.now();

  const { data: freno } = await admin
    .from("password_reset_throttle")
    .select("last_requested_at")
    .eq("email", email)
    .maybeSingle();

  if (freno && ahora - new Date(freno.last_requested_at).getTime() < ESPERA_ENTRE_RESETS_MS) {
    // Se responde lo mismo que en el camino feliz: decir "esperá" confirmaría
    // que la cuenta existe, que es justo lo que el mensaje neutro evita.
    return respuestaNeutra;
  }

  const { error: frenoError } = await admin
    .from("password_reset_throttle")
    .upsert({ email, last_requested_at: new Date(ahora).toISOString() }, { onConflict: "email" });

  // Si el freno no se pudo escribir se sigue igual: dejar a alguien sin poder
  // recuperar su cuenta porque falló la tabla de rate limit es peor que mandar
  // un correo de más.
  if (frenoError) {
    console.error("No se pudo registrar el freno de reset:", frenoError.message);
  }

  // Barrido de las filas viejas, en el mismo camino que las escribe. Son
  // direcciones de correo de gente que ya resolvió su problema.
  void admin
    .from("password_reset_throttle")
    .delete()
    .lt("last_requested_at", new Date(ahora - VIDA_DEL_FRENO_MS).toISOString());

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const destino = `${siteUrl}/auth/set-password?modo=recuperar`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: destino },
  });

  if (error || !data.properties?.action_link) {
    // El caso normal acá es "no existe esa cuenta", que no es un error nuestro
    // y no se le cuenta a quien pregunta.
    console.warn("[requestPasswordReset] no se generó link para", email, "—", error?.message);
    return respuestaNeutra;
  }

  const link = data.properties.action_link;

  // Supabase NO falla si el `redirectTo` no está en la allowlist de Redirect
  // URLs: lo cambia por el Site URL del proyecto y devuelve 200. El link llega
  // igual, la persona lo abre, y aterriza en la home del sitio con el token
  // colgando del `#` y sin nada que lo lea. Se ve como "el correo no sirve".
  // Por eso se compara: si nos lo cambiaron, que quede gritado en los logs.
  if (!link.includes(encodeURIComponent(destino)) && !link.includes(destino)) {
    console.error(
      "[requestPasswordReset] Supabase ignoró el redirect_to y lo reemplazó por el Site URL.",
      "Agregá", `${siteUrl}/**`, "en Authentication → URL Configuration → Redirect URLs.",
      "Link generado:", link
    );
  }

  const enviado = await sendTransactionalEmail(
    email,
    "Recuperá tu contraseña",
    `<p>Pediste crear una contraseña nueva para tu cuenta de Q Labs.</p>
     <p><a href="${link}" style="display:inline-block;background:#705CF6;color:#fff;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none">Crear contraseña nueva</a></p>
     <p>El link vence en una hora y sirve una sola vez.</p>
     <p style="color:#5B5570;font-size:13px">Si no fuiste vos, ignorá este correo: tu contraseña actual sigue funcionando.</p>`
  );

  // Un fallo de Resend sí se cuenta. No filtra nada —habla de nuestro servidor
  // de correo, no de si la cuenta existe— y callarlo deja a la persona
  // esperando un mail que nunca salió.
  if (!enviado) {
    return { error: "No pudimos mandar el correo en este momento. Probá de nuevo en unos minutos." };
  }

  return respuestaNeutra;
}

/**
 * A qué panel mandar a quien acaba de definir su contraseña. Existe porque
 * /auth/set-password es un componente de cliente y `destinoDeSesion` mira
 * tablas que solo se leen del lado del servidor.
 *
 * Antes esa pantalla mandaba a /admin fijo, que servía cuando su único uso era
 * la invitación al equipo. Con el reset abierto a todo el mundo, un creador
 * terminaba estrellándose contra el panel del equipo apenas cambiaba la clave.
 */
export async function destinoTrasSetPasswordAction(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/ugc/login";
  return await destinoDeSesion(supabase, user.id);
}
