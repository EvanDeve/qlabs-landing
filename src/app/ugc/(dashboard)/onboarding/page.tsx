import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "@/components/ugc/OnboardingForm";
import type { AppRole } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const ROLE_DASHBOARD: Record<AppRole, string> = {
  creator: "/ugc/creador",
  brand: "/ugc/marca",
  admin: "/ugc/admin",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role: roleParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect(ROLE_DASHBOARD.admin);
  }

  if (profile?.role) {
    const table = profile.role === "creator" ? "creator_profiles" : "brand_profiles";
    const { data: roleProfile } = await supabase
      .from(table)
      .select("profile_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (roleProfile) {
      redirect(ROLE_DASHBOARD[profile.role]);
    }
  }

  const lockedRole = (profile?.role as "creator" | "brand" | null) ?? null;
  const initialRole = lockedRole ?? (roleParam === "brand" ? "brand" : "creator");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-lg font-extrabold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet text-sm text-white">
            Q
          </span>
          UGC·CRC
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          Completá tu perfil
        </h1>
        <p className="text-ink-soft">
          Últimos datos antes de entrar a tu panel.
        </p>
      </div>

      <OnboardingForm lockedRole={lockedRole} initialRole={initialRole} />
    </div>
  );
}
