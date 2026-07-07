import Link from "next/link";

export default function PublicNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/ugc" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet text-sm text-white">
            Q
          </span>
          UGC·CRC
        </Link>

        <div className="flex items-center gap-3">
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
        </div>
      </div>
    </header>
  );
}
