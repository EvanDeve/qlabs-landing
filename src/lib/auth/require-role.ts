import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/database.types";

const ROLE_DASHBOARD: Record<AppRole, string> = {
  creator: "/ugc/creador",
  brand: "/ugc/marca",
  admin: "/ugc/admin",
};

// UI-level gate for the role dashboards: RLS is the real security boundary
// at the data level, so a bug here can never leak another role's data.
export async function requireRole(role: AppRole) {
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

  if (!profile?.role) {
    redirect("/ugc/onboarding");
  }

  if (profile.role !== role) {
    redirect(ROLE_DASHBOARD[profile.role]);
  }

  return { user, supabase };
}
