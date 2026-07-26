import Link from "next/link";

// El marketplace está arrancando y todavía no tiene volumen que mostrar.
// Decirlo es mejor que dejar que se note: un visitante que no ve campañas
// interpreta abandono, no arranque. Y para un creador, entrar temprano es
// genuinamente mejor —menos competencia por promo—, así que no hay que
// maquillarlo, hay que nombrarlo.
//
// Nada de esta sección afirma actividad que no existe: no hay contadores, ni
// "cientos de creadores", ni testimonios.
export default function EarlyAccess() {
  return (
    <section className="border-b border-line bg-ink">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center" data-anim-in>
        <span className="inline-flex items-center gap-2 rounded-pill border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-bold text-white/80">
          <span className="h-2 w-2 rounded-full bg-trust" aria-hidden />
          Estamos arrancando en Costa Rica
        </span>

        <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
          Sé de los primeros
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/70">
          UGC·CRC recién abre. Entrar ahora significa competir con menos gente por cada promo
          y construir tu historial desde el primer trabajo.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/ugc/login?intent=creador"
            className="rounded-pill bg-white px-7 py-3.5 font-bold text-ink transition hover:bg-white/90"
          >
            Quiero ser de los primeros
          </Link>
          <Link
            href="/ugc/login?intent=marca"
            className="rounded-pill border border-white/25 px-7 py-3.5 font-bold text-white transition hover:border-white/60"
          >
            Tengo un negocio
          </Link>
        </div>
      </div>
    </section>
  );
}
