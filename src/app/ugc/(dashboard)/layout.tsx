import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Toaster from "@/components/ugc/Toaster";
import styles from "@/styles/qos.module.css";

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
      {/* `fuenteMarketplace` pone Plus Jakarta Sans —la tipografía de la marca—
          en todo lo que cuelga de acá. Va en este layout y no en QosShell
          porque el shell lo comparte Q·OS, que tiene identidad propia. */}
      <div className={`${styles.fuenteMarketplace} min-h-screen bg-white text-ink`}>{children}</div>
    </Toaster>
  );
}
