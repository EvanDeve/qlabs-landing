"use client";

import { useState } from "react";

// El hueco más grande que tenía la página: se hablaba de "contenido UGC real"
// pero en ningún lado se contaba qué pasa después de registrarse.
//
// Los pasos describen el flujo que la app REALMENTE hace hoy —verificación
// manual como bloqueo duro, derechos de uso visibles antes de aplicar, pago
// coordinado por Q Labs—. Si el flujo cambia, esto hay que cambiarlo: es lo
// que le prometemos a alguien que todavía no se registró.

const PASOS = {
  creador: [
    {
      icono: "fa-user-pen",
      titulo: "Creá tu perfil",
      texto: "Tu handle, tu ciudad, tus nichos y tu book. Es gratis y toma un par de minutos.",
    },
    {
      icono: "fa-shield-halved",
      titulo: "Te verificamos a mano",
      texto:
        "El equipo de Q Labs revisa tu identidad y tus redes. No es un formulario automático: por eso el sello significa algo.",
    },
    {
      icono: "fa-paper-plane",
      titulo: "Aplicá a las promos",
      texto:
        "Antes de aplicar ves el brief completo, cuánto cobrás y qué derechos de uso pide la marca: dónde va a usar la pieza y por cuánto tiempo.",
    },
    {
      icono: "fa-money-bill-wave",
      titulo: "Entregás y cobrás",
      texto:
        "Subís el video y el link del post publicado. Cuando la marca aprueba, Q Labs coordina tu pago.",
    },
  ],
  marca: [
    {
      icono: "fa-store",
      titulo: "Registrá tu negocio",
      texto: "Nombre, rubro, zona y logo. Así los creadores saben con quién van a trabajar.",
    },
    {
      icono: "fa-shield-halved",
      titulo: "Te verificamos",
      texto:
        "Confirmamos que el negocio existe antes de que puedas publicar. Es lo que hace que un creador se anime a aplicar.",
    },
    {
      icono: "fa-bullhorn",
      titulo: "Publicá tu campaña",
      texto:
        "Definís presupuesto, entregables, plazo y los derechos de uso del contenido. Todo queda por escrito desde el arranque.",
    },
    {
      icono: "fa-circle-check",
      titulo: "Elegí y aprobá",
      texto:
        "Revisás quién aplicó y su book, aceptás a quien te cierre, recibís la entrega y la aprobás. Si algo sale mal, nosotros respondemos.",
    },
  ],
};

type Rol = keyof typeof PASOS;

export default function HowItWorks() {
  const [rol, setRol] = useState<Rol>("creador");

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <h2
          className="text-center text-3xl font-extrabold tracking-tight text-ink"
          data-anim-in
        >
          Cómo funciona
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-ink-soft" data-anim-in>
          De registrarte a cobrar, sin intermediarios sueltos ni acuerdos de palabra.
        </p>

        <div className="mx-auto mt-8 flex w-fit gap-1 rounded-pill border border-line bg-white p-1">
          {(["creador", "marca"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRol(r)}
              className={`rounded-pill px-5 py-2 text-sm font-bold transition ${
                rol === r ? "bg-violet text-white" : "text-ink-soft"
              }`}
            >
              {r === "creador" ? "Soy creador" : "Soy marca"}
            </button>
          ))}
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2" data-anim-stagger>
          {PASOS[rol].map((paso, i) => (
            <li
              key={paso.titulo}
              className="relative rounded-card border border-line bg-white p-6"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lavender text-violet">
                  <i className={`fa-solid ${paso.icono}`} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {/* El número va como dato, no como decoración: es el orden
                        real del flujo y ayuda a leerlo en móvil, donde las
                        tarjetas quedan una debajo de otra. */}
                    <span className="font-mono text-xs font-bold text-violet">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-extrabold text-ink">{paso.titulo}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{paso.texto}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
