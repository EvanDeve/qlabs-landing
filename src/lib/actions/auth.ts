"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/database.types";

export type AuthActionState = { error: string } | { message: string } | null;

const ROLE_DASHBOARD: Record<AppRole, string> = {
  creator: "/ugc/creador",
  brand: "/ugc/marca",
  admin: "/ugc/admin",
};

async function redirectAfterLogin(userId: string): Promise<never> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  redirect(profile?.role ? ROLE_DASHBOARD[profile.role] : "/ugc/onboarding");
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
    return { error: "Email o contraseña incorrectos." };
  }

  return await redirectAfterLogin(data.user.id);
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");

  if (role !== "creator" && role !== "brand") {
    return { error: "Elegí si sos creador o marca." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
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
    return { error: error.message === "User already registered"
      ? "Ese email ya tiene una cuenta — iniciá sesión."
      : "No se pudo crear la cuenta. Intentá de nuevo." };
  }

  if (data.session) {
    // email confirmation is disabled on this project: session starts immediately
    await redirectAfterLogin(data.user!.id);
  }

  return { message: "Te enviamos un email para confirmar tu cuenta. Revisá tu bandeja de entrada." };
}

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
