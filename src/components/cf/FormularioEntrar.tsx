"use client";

import { useActionState, useState } from "react";
import { entrarAction, type EstadoEntrar } from "@/lib/actions/close-friends";
import { BOTON, CAMPO, CampoCodigo, MensajeError } from "@/components/cf/ui";

/** Entrar sin contraseña: el correo y el código que llega ahí. */
export default function FormularioEntrar({ next }: { next?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(entrarAction, { paso: "email" });
  const [volviAtras, setVolviAtras] = useState(false);

  if (estado.paso === "codigo" && !volviAtras) {
    return (
      <div className="flex flex-col">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Revisá tu correo</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          Si <b className="text-ink">{estado.email}</b> es miembro, le llegó un código.
        </p>
        {/* `key` distinta en cada paso: sin ella React reusa el mismo <input>
            de la posición 2 —el correo editable, después el oculto— y avisa
            que un campo pasó de no controlado a controlado. */}
        <form key="codigo" action={accion} className="mt-8 flex flex-col gap-4">
          <input type="hidden" name="paso" value="codigo" />
          <input type="hidden" name="email" value={estado.email} />
          {next && <input type="hidden" name="next" value={next} />}
          <CampoCodigo error={Boolean(estado.error)} />
          <MensajeError>{estado.error}</MensajeError>
          <button type="submit" disabled={enviando} className={BOTON}>
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setVolviAtras(true)}
          className="mt-4 min-h-11 text-[15px] font-semibold text-ink-soft transition hover:text-violet"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Entrá a tu cuenta</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">
        Sin contraseña: te mandamos un código al correo con el que te registraste.
      </p>
      <form
        key="email"
        action={(fd) => {
          setVolviAtras(false);
          accion(fd);
        }}
        className="mt-8 flex flex-col gap-4"
      >
        <input type="hidden" name="paso" value="email" />
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          // Pantalla de un solo campo (ver nota de autoFocus en los pendientes).
          autoFocus
          aria-label="Correo"
          placeholder="tu@correo.com"
          defaultValue={estado.paso === "codigo" ? estado.email : ""}
          className={CAMPO}
        />
        <MensajeError>{estado.paso === "email" ? estado.error : undefined}</MensajeError>
        <button type="submit" disabled={enviando} className={BOTON}>
          {enviando ? "Enviando…" : "Enviarme el código"}
        </button>
      </form>
    </div>
  );
}
