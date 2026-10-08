"use client";

import { useEffect, useRef } from "react";

/**
 * Avisa que alguien abrió el kit (spec 002). No pinta nada.
 *
 * La guarda con `useRef` evita el doble POST del modo estricto de React en
 * desarrollo; igual la base contaría una sola visita por persona y por día.
 */
export default function RegistrarVisitaKit({ creadorId }: { creadorId: string }) {
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    fetch("/api/ugc/visitas-kit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creador: creadorId }),
      keepalive: true,
    }).catch(() => {
      // Una visita sin contar no es asunto de quien mira el kit.
    });
  }, [creadorId]);

  return null;
}
