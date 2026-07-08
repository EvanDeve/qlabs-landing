import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/ugc/AuthForm";
import type { AppRole } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const ROLE_DASHBOARD: Record<AppRole, string> = {
  creator: "/ugc/creador",
  brand: "/ugc/marca",
  admin: "/ugc/admin",
};

const INTENT_TO_ROLE: Record<string, "creator" | "brand"> = {
  creador: "creator",
  marca: "brand",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; next?: string; error?: string }>;
}) {
  const { intent, next, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role) {
      redirect(next ?? ROLE_DASHBOARD[profile.role]);
    }
    redirect("/ugc/onboarding");
  }

  const heading =
    intent === "marca"
      ? "Publicá tu campaña"
      : intent === "creador"
        ? "Aplicá como creador"
        : "¿Cómo querés entrar?";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2 text-lg font-extrabold">
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          UGC·CRC
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{heading}</h1>
        {error === "google" && (
          <p className="text-sm text-coral">
            No se pudo conectar con Google. Probá de nuevo o usá email.
          </p>
        )}
      </div>

      <AuthForm initialIntent={intent ? INTENT_TO_ROLE[intent] : undefined} />
    </div>
  );
}
