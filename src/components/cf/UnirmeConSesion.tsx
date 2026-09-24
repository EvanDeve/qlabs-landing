"use client";

import { useActionState } from "react";
import { unirmeConSesionAction, type EstadoUnirme } from "@/lib/actions/close-friends";
import { BOTON, MensajeError } from "@/components/cf/ui";

/**
 * Para quien ya es miembro y abre el QR de un cupón o de otro negocio: un
 * toque, sin preguntas. Compartir el contacto ya lo decidió al registrarse
 * para todos sus negocios (20260924170000), y lo cambia desde su perfil.
 */
export default function UnirmeConSesion({
  codigo,
  negocio,
  conCupon,
}: {
  codigo: string;
  negocio: string;
  conCupon: boolean;
}) {
  const [estado, accion, enviando] = useActionState<EstadoUnirme, FormData>(unirmeConSesionAction, null);

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="codigo" value={codigo} />
      <MensajeError>{estado?.error}</MensajeError>
      <button type="submit" disabled={enviando} className={BOTON}>
        {enviando ? "Agregando…" : conCupon ? "Agregar a mi wallet" : `Unirme a ${negocio}`}
      </button>
    </form>
  );
}
