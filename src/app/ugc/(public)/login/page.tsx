import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/ugc/AuthForm";
import { destinoDeSesion, destinoConNext } from "@/lib/ugc/estado-cuenta";

export const dynamic = "force-dynamic";

const INTENT_TO_ROLE: Record<string, "creator" | "brand"> = {
  creador: "creator",
  marca: "brand",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; next?: string }>;
}) {
  const { intent, next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const destino = await destinoDeSesion(supabase, user.id);
    redirect(destinoConNext(destino, next));
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
        <AuthForm initialIntent={intent ? INTENT_TO_ROLE[intent] : undefined} />
      </main>

      {/* Los links legales de AuthForm viven en el segundo paso (el formulario);
          en el primero —elegir rol— hay un return temprano y no se renderizan.
          Como /ugc/login sin intent es justo por donde entra la mayoría, van
          también acá abajo para que sean alcanzables siempre. */}
      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 pb-8 text-xs text-ink-soft">
        <Link href="/legal/terminos" className="font-semibold transition hover:text-ink">
          Términos y condiciones
        </Link>
        <Link href="/legal/privacidad" className="font-semibold transition hover:text-ink">
          Política de privacidad
        </Link>
      </footer>
    </div>
  );
}
