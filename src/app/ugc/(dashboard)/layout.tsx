import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Toaster from "@/components/ugc/Toaster";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  return (
    <Toaster>
      <div className="min-h-screen bg-white text-ink">{children}</div>
    </Toaster>
  );
}
