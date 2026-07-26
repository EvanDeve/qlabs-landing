"use client";

import { useState } from "react";
import Link from "next/link";

// Nav único para las dos caras públicas del sitio: la landing de marketing (/)
// y la del marketplace (/ugc). Antes eran dos componentes distintos con dos
// hojas de estilo distintas, y se fueron separando solos: distinta altura
// (97px vs 73px), distinto breakpoint de móvil, distinto centrado. Compartir el
// componente es lo que impide que vuelvan a divergir.
//
// Lo único que cambia entre páginas son el rótulo del logo y los botones, así
// que eso entra por props y el resto es igual por construcción.

export type NavAction = {
  href: string;
  label: string;
  variant: "primary" | "outline" | "ghost";
  /** Abre en pestaña nueva (Calendly, por ejemplo). */
  external?: boolean;
};

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/ugc", label: "UGC·CRC" },
];

const ESTILO: Record<NavAction["variant"], string> = {
  primary:
    "rounded-pill bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep",
  outline:
    "rounded-pill border border-line px-5 py-2.5 text-sm font-bold text-ink transition hover:border-ink",
  ghost: "text-sm font-bold text-ink-soft transition hover:text-ink",
};

export default function SiteNav({
  logoHref,
  logoLabel,
  actions,
}: {
  logoHref: string;
  logoLabel: string;
  actions: NavAction[];
}) {
  const [open, setOpen] = useState(false);
  const cerrar = () => setOpen(false);

  const boton = (a: NavAction, enDrawer: boolean) => {
    const clase = `${ESTILO[a.variant]} ${
      enDrawer ? (a.variant === "ghost" ? "block py-2" : "block text-center") : ""
    }`;
    // Los links externos no pasan por el router de Next.
    return a.external ? (
      <a
        key={a.href + a.label}
        href={a.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={cerrar}
        className={clase}
      >
        {a.label}
      </a>
    ) : (
      <Link key={a.href + a.label} href={a.href} onClick={cerrar} className={clase}>
        {a.label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/80 backdrop-blur">
      {/* Flex en móvil (logo + hamburguesa a los extremos). En desktop, grid
          1fr/auto/1fr: con space-between el centro se corre según cuánto
          difieran los lados, y el lado derecho cambia de ancho según la página
          y según haya sesión. Con columnas laterales iguales, el centro es el
          centro real pase lo que pase. */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 min-[769px]:grid min-[769px]:grid-cols-[1fr_auto_1fr]">
        <Link
          href={logoHref}
          onClick={cerrar}
          className="flex shrink-0 items-center gap-2 text-lg font-extrabold text-ink min-[769px]:justify-self-start"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          {logoLabel}
        </Link>

        <nav className="hidden items-center gap-6 min-[769px]:flex min-[769px]:justify-self-center">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-bold text-ink-soft transition hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 min-[769px]:flex min-[769px]:justify-self-end">
          {actions.map((a) => boton(a, false))}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="text-xl text-ink min-[769px]:hidden"
        >
          <i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} aria-hidden />
        </button>
      </div>

      {/* OJO: medidas explícitas (w-screen/h-screen), NO inset-0. El <header>
          tiene backdrop-blur y en Chrome eso lo vuelve containing block de sus
          descendientes position:fixed — con inset-0 el overlay se mediría
          contra los ~73px del header en vez de contra la ventana. */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={cerrar}
            className="fixed left-0 top-0 z-30 h-screen w-screen bg-ink/40 min-[769px]:hidden"
          />
          <div className="fixed right-0 top-0 z-40 flex h-screen w-[82%] max-w-sm flex-col gap-1 bg-white px-6 pb-10 pt-6 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] min-[769px]:hidden">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-lg font-extrabold text-ink">Menú</span>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar menú"
                className="text-xl text-ink"
              >
                <i className="fa-solid fa-xmark" aria-hidden />
              </button>
            </div>

            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={cerrar}
                className="border-b border-line py-3.5 text-base font-bold text-ink"
              >
                {l.label}
              </Link>
            ))}

            <div className="mt-6 flex flex-col gap-3">{actions.map((a) => boton(a, true))}</div>
          </div>
        </>
      )}
    </header>
  );
}
