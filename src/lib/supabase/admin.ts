import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// service-role client: server-only, bypasses RLS. Used to look up a user's
// email (auth.users, not exposed via profiles) for transactional emails.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
