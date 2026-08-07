"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoDeSesion } from "@/lib/ugc/estado-cuenta";

export type AuthActionState = { error: string } | { message: string } | null;

// El onboarding a medias (rol puesto por el trigger pero sin perfil todavía) y
// la cuenta sin verificar los resuelve `destinoDeSesion`, compartido con la
// página de login, el onboarding y el nav público.
async function redirectAfterLogin(userId: string): Promise<never> {
  const supabase = await createClient();
  redirect(await destinoDeSesion(supabase, userId));
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[signInAction] supabase signIn error:", error.status, error.message);
    return { error: "Email o contraseña incorrectos." };
  }

  return await redirectAfterLogin(data.user.id);
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
  await supabase.auth.signOut();
  redirect("/ugc/login");
}
