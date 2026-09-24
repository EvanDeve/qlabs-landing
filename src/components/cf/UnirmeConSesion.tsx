"use client";

import { useActionState } from "react";
import { unirmeConSesionAction, type EstadoUnirme } from "@/lib/actions/close-friends";
import { BOTON, Casilla, MensajeError } from "@/components/cf/ui";

/**
 * Para quien ya es miembro y escanea el QR de otro negocio: un toque. Lo único
 * que se pregunta es lo que es por negocio — compartir sus datos con ESTE.
 */
export default function UnirmeConSesion({ codigo, negocio }: { codigo: string; negocio: string }) {
  const [estado, accion, enviando] = useActionState<EstadoUnirme, FormData>(unirmeConSesionAction, null);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="codigo" value={codigo} />
      <Casilla name="comparte_con_marca" ayuda={`Opcional. Si no la marcás, ${negocio} te ve solo por tu nombre de agente.`}>
        Compartir mi nombre y contacto con {negocio}
      </Casilla>
      <MensajeError>{estado?.error}</MensajeError>
      <button type="submit" disabled={enviando} className={BOTON}>
        {enviando ? "Uniéndote…" : `Unirme a ${negocio}`}
      </button>
    </form>
  );
}
