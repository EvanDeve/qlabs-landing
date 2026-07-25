import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/ugc/AuthForm";
import { ROLE_DASHBOARD } from "@/lib/ugc/roles";

export const dynamic = "force-dynamic";

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

  return (
    <div className="flex min-h-screen flex-col bg-lavender/40">
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2 text-lg font-extrabold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          UGC·CRC
        </div>
        <Link href="/" className="text-sm font-semibold text-ink-soft transition hover:text-ink">
          ← Volver al sitio
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <AuthForm
          initialIntent={intent ? INTENT_TO_ROLE[intent] : undefined}
          googleError={error === "google"}
        />
      </main>
    </div>
  );
}
