"use client";

import { useState } from "react";

/**
 * "Compartir" de una página pública.
 *
 * Usa `navigator.share` cuando existe —en el teléfono es la hoja del sistema,
 * con WhatsApp adentro, que es por donde estos links viajan de verdad— y cae a
 * copiar el link en escritorio, donde esa API no está.
 *
 * El link se arma con `window.location.href` y no con `NEXT_PUBLIC_SITE_URL`,
 * que en el repo vale localhost: es un link que alguien le manda a otra
 * persona. Misma decisión que en CompartirPerfil del creador.
 */
export default function CompartirPagina({ titulo }: { titulo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartir() {
    const url = window.location.href;
    if (navigator.share) {
      // Cancelar la hoja del sistema lanza AbortError: no es un fallo y no
      // tiene que dejar la pantalla diciendo nada.
      try {
        await navigator.share({ title: titulo, url });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={compartir}
      className="text-sm font-extrabold text-violet transition hover:text-violet-deep"
    >
      {copiado ? "Link copiado" : "Compartir"}
    </button>
  );
}
