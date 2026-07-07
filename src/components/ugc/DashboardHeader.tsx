import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/ugc/SignOutButton";
import NotificationsBell from "@/components/ugc/NotificationsBell";

export default async function DashboardHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="mb-10 flex items-center justify-between">
      <div className="flex items-center gap-2 text-lg font-extrabold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet text-sm text-white">
          Q
        </span>
        UGC·CRC
      </div>
      <div className="flex items-center gap-3">
        <NotificationsBell notifications={notifications ?? []} />
        <SignOutButton />
      </div>
    </div>
  );
}
