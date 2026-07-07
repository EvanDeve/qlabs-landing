import Link from "next/link";

export default function Hero() {
  return (
    <section className="border-b border-line bg-lavender">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-pill border border-line bg-white px-4 py-1.5 text-sm font-bold text-ink-soft">
          El puente entre marcas y creadores en Costa Rica
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Contenido UGC real, hecho por creadores{" "}
          <span className="text-violet">verificados</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft">
          Restaurantes y hoteles publican campañas. Creadores costarricenses
          aplican y entregan. Vos elegís con quién trabajar.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/ugc/login?intent=marca"
            className="rounded-pill bg-violet px-7 py-3.5 font-bold text-white transition hover:bg-violet-deep"
          >
            Publicá tu campaña
          </Link>
          <Link
            href="/ugc/login?intent=creador"
            className="rounded-pill border border-line bg-white px-7 py-3.5 font-bold text-ink transition hover:border-ink"
          >
            Aplicá como creador
          </Link>
        </div>
      </div>
    </section>
  );
}
