import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RecuperarForm from "@/components/ugc/RecuperarForm";
import { destinoDeSesion } from "@/lib/ugc/estado-cuenta";

export const dynamic = "force-dynamic";

export default async function RecuperarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión abierta no hay nada que recuperar.
  if (user) {
    redirect(await destinoDeSesion(supabase, user.id));
  }

  return (
    <div className="flex min-h-screen flex-col bg-lavender/40">
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2 text-lg font-extrabold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          UGC·CRC
        </div>
        <Link href="/ugc/login" className="text-sm font-semibold text-ink-soft transition hover:text-ink">
          ← Volver al acceso
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8">
        <RecuperarForm />
      </main>
    </div>
  );
}
