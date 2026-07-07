import Link from "next/link";

export default function FinalCta() {
  return (
    <section>
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-ink">
          ¿Listo para empezar?
        </h2>
        <p className="mt-3 text-ink-soft">
          Registrate en un minuto, sin costo, y elegí tu rol.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/ugc/login?intent=marca"
            className="rounded-pill bg-violet px-7 py-3.5 font-bold text-white transition hover:bg-violet-deep"
          >
            Publicá tu campaña
          </Link>
          <Link
            href="/ugc/login?intent=creador"
            className="rounded-pill border border-line px-7 py-3.5 font-bold text-ink transition hover:border-ink"
          >
            Aplicá como creador
          </Link>
        </div>
      </div>
    </section>
  );
}
