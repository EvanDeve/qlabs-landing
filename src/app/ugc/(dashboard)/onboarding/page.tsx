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
    <div className="flex min-h-screen flex-col bg-lavender/40">
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2 text-lg font-extrabold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          UGC·CRC
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <OnboardingForm lockedRole={lockedRole} initialRole={initialRole} />
      </main>
    </div>
  );
}
