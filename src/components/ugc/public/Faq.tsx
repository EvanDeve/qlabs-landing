"use client";

import { useState } from "react";

const FAQ_BY_ROLE = {
  creador: [
    {
      q: "¿Cuánto cuesta aplicar a campañas?",
      a: "Nada. Crear tu perfil y aplicar a campañas es gratis para creadores.",
    },
    {
      q: "¿Cómo y cuándo me pagan?",
      a: "El pago se coordina directamente con la marca una vez aceptada tu aplicación. Q Labs acompaña el proceso como intermediario de confianza.",
    },
    {
      q: "¿Necesito muchos seguidores para aplicar?",
      a: "No. Cada campaña indica su propia audiencia mínima — muchas buscan creadores con pocos miles de seguidores pero contenido auténtico.",
    },
    {
      q: "¿Qué significa el sello de verificado?",
      a: "Que el equipo de Q Labs confirmó manualmente tu identidad y tus redes. Ayuda a que las marcas confíen más en tu perfil.",
    },
  ],
  marca: [
    {
      q: "¿Cuánto cuesta publicar una campaña?",
      a: "Publicar campañas está incluido en Fase 1 sin costo. El pago al creador se coordina directamente con vos.",
    },
    {
      q: "¿Cómo elijo con qué creador trabajar?",
      a: "Ves todas las aplicaciones a tu campaña con el perfil de cada creador y elegís con quién avanzar.",
    },
    {
      q: "¿Puedo ver el trabajo previo del creador?",
      a: "Por ahora ves handle, seguidores, nichos y redes. El portfolio completo llega en una fase posterior.",
    },
    {
      q: "¿Qué pasa si el creador no entrega?",
      a: "Q Labs acompaña el proceso como mediador humano ante cualquier problema de entrega.",
    },
  ],
} as const;

type Role = keyof typeof FAQ_BY_ROLE;

export default function Faq() {
  const [role, setRole] = useState<Role>("creador");

  return (
    <section className="border-b border-line bg-lavender/40">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink">
          Preguntas frecuentes
        </h2>

        <div className="mx-auto mt-8 flex w-fit gap-1 rounded-pill border border-line bg-white p-1">
          {(["creador", "marca"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-pill px-5 py-2 text-sm font-bold transition ${
                role === r ? "bg-violet text-white" : "text-ink-soft"
              }`}
            >
              {r === "creador" ? "Soy creador" : "Soy marca"}
            </button>
          ))}
        </div>

        <div className="mt-10 space-y-4">
          {FAQ_BY_ROLE[role].map((item) => (
            <div key={item.q} className="rounded-card border border-line bg-white p-5">
              <div className="font-bold text-ink">{item.q}</div>
              <p className="mt-2 text-sm text-ink-soft">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
