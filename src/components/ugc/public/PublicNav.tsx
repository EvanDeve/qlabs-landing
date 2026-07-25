import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ROLE_DASHBOARD, ROLE_DASHBOARD_LABEL } from "@/lib/ugc/roles";

export default async function PublicNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un visitante con sesión no debería ver "Iniciar sesión" ni los CTAs de
  // registro: se le ofrece la entrada directa a su panel. Sin rol todavía
  // (registro a medias) lo mandamos a terminar el onboarding.
  let session: { href: string; label: string } | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    session = profile?.role
      ? { href: ROLE_DASHBOARD[profile.role], label: ROLE_DASHBOARD_LABEL[profile.role] }
      : { href: "/ugc/onboarding", label: "Completá tu registro" };
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/ugc" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          UGC·CRC
        </Link>

        <div className="flex items-center gap-3">
          {session ? (
            <Link
              href={session.href}
              className="rounded-pill bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep"
            >
              {session.label}
            </Link>
          ) : (
            <>
              <Link
                href="/ugc/login"
                className="hidden text-sm font-bold text-ink-soft transition hover:text-ink sm:inline"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/ugc/login?intent=marca"
                className="rounded-pill border border-line px-5 py-2.5 text-sm font-bold text-ink transition hover:border-ink"
              >
                Publicá una campaña
              </Link>
              <Link
                href="/ugc/login?intent=creador"
                className="rounded-pill bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep"
              >
                Aplicá como creador
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
