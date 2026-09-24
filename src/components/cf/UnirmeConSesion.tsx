"use client";

import { useActionState } from "react";
import { unirmeConSesionAction, type EstadoUnirme } from "@/lib/actions/close-friends";
import { BOTON, Casilla, MensajeError } from "@/components/cf/ui";

/**
 * Para quien ya es miembro y abre el QR de un cupón o de otro negocio: un toque.
 *
 * Lo único que se pregunta —y solo si todavía no era de este negocio— es lo
 * que es por negocio: compartir sus datos con ÉL. Arranca apagado; la ley pide
 * que sea una elección, no un default.
 */
export default function UnirmeConSesion({
  codigo,
  negocio,
  preguntarCompartir,
  conCupon,
}: {
  codigo: string;
  negocio: string;
  preguntarCompartir: boolean;
  conCupon: boolean;
}) {
  const [estado, accion, enviando] = useActionState<EstadoUnirme, FormData>(unirmeConSesionAction, null);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="codigo" value={codigo} />
      {preguntarCompartir && (
        <Casilla name="comparte_con_marca" ayuda={`Opcional. Si no la marcás, ${negocio} te ve solo por tu nombre de agente.`}>
          Compartir mi nombre y contacto con {negocio}
        </Casilla>
      )}
      <MensajeError>{estado?.error}</MensajeError>
      <button type="submit" disabled={enviando} className={BOTON}>
        {enviando ? "Agregando…" : conCupon ? "Agregar a mi wallet" : `Unirme a ${negocio}`}
      </button>
    </form>
  );
}
