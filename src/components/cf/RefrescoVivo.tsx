"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedir la pantalla cada pocos segundos mientras está a la vista.
 *
 * Es para el momento de la caja: la persona tiene el teléfono en la mano con el
 * QR y quien atiende lo valida en su panel. Sin esto, el cupón seguiría
 * diciendo "por usar" hasta recargar. `router.refresh()` rehace solo los
 * Server Components; el estado de la pantalla (una pestaña, un QR abierto) no
 * se pierde. Con la pestaña en segundo plano no gasta nada.
 */
export default function RefrescoVivo({ cadaMs = 5000 }: { cadaMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, cadaMs);
    return () => clearInterval(t);
  }, [router, cadaMs]);
  return null;
}
