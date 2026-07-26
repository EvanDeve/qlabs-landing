"use client";

import { useState } from "react";
import Link from "next/link";

export type NavSession = { href: string; label: string } | null;

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/ugc", label: "UGC·CRC" },
];

export default function PublicNavClient({ session }: { session: NavSession }) {
  const [open, setOpen] = useState(false);
  const cerrar = () => setOpen(false);

  // Los CTAs se repiten en la barra y en el drawer, así que viven acá una vez.
  const acciones = (enDrawer: boolean) =>
    session ? (
      <Link
        href={session.href}
        onClick={cerrar}
        className={`rounded-pill bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep ${
          enDrawer ? "block text-center" : ""
        }`}
      >
        {session.label}
      </Link>
    ) : (
      <>
        <Link
          href="/ugc/login"
          onClick={cerrar}
          className={`text-sm font-bold text-ink-soft transition hover:text-ink ${
            enDrawer ? "block py-2" : "hidden lg:inline"
          }`}
        >
          Iniciar sesión
        </Link>
        <Link
          href="/ugc/login?intent=marca"
          onClick={cerrar}
          className={`rounded-pill border border-line px-5 py-2.5 text-sm font-bold text-ink transition hover:border-ink ${
            enDrawer ? "block text-center" : ""
          }`}
        >
          Publicá una campaña
        </Link>
        <Link
          href="/ugc/login?intent=creador"
          onClick={cerrar}
          className={`rounded-pill bg-violet px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-deep ${
            enDrawer ? "block text-center" : ""
          }`}
        >
          Aplicá como creador
        </Link>
      </>
    );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/ugc"
          onClick={cerrar}
          className="flex shrink-0 items-center gap-2 text-lg font-extrabold text-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
          UGC·CRC
        </Link>

        {/* Navegación de secciones: la misma que la landing principal, para que
            desde cualquiera de los dos lados se pueda llegar al otro. */}
        <nav className="hidden items-center gap-6 md:flex">
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

        <div className="hidden items-center gap-3 md:flex">{acciones(false)}</div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="text-xl text-ink md:hidden"
        >
          <i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} aria-hidden />
        </button>
      </div>

      {/* OJO: medidas explícitas (w-screen/h-screen), NO inset-0. El <header>
          tiene backdrop-blur y en Chrome eso lo vuelve containing block de sus
          descendientes position:fixed — con inset-0 el overlay se mediría
          contra los ~70px del header en vez de contra la ventana. */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={cerrar}
            className="fixed left-0 top-0 z-30 h-screen w-screen bg-ink/40 md:hidden"
          />
          <div className="fixed right-0 top-0 z-40 flex h-screen w-[82%] max-w-sm flex-col gap-1 bg-white px-6 pb-10 pt-6 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] md:hidden">
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

            <div className="mt-6 flex flex-col gap-3">{acciones(true)}</div>
          </div>
        </>
      )}
    </header>
  );
}
