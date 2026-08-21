"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type AuthActionState } from "@/lib/actions/auth";

/**
 * Pedir el link para recuperar la contraseña desde el marketplace. Mismo
 * server action que el de Q·OS (`QosRecuperarForm`), otra piel.
 */
export default function RecuperarForm() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    requestPasswordResetAction,
    null
  );

  return (
    <div className="w-full max-w-md rounded-[22px] border border-line bg-white p-7 shadow-[0_30px_70px_-40px_rgba(11,11,18,0.35)] sm:p-9">
      <div className="mb-3 flex items-center justify-center gap-2 text-lg font-extrabold text-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon-logo.png" alt="Q Labs" className="h-7 w-7 rounded-lg object-cover" />
        UGC·CRC
      </div>

      <h1 className="text-center text-2xl font-extrabold tracking-tight text-ink">
        ¿Olvidaste tu contraseña?
      </h1>
      <p className="mx-auto mb-6 mt-2 text-center text-sm text-ink-soft">
        Poné tu email y te mandamos un link para crear una nueva.
      </p>

      {state && "message" in state ? (
        // Mandado el correo, el formulario desaparece: dejarlo solo invita a
        // apretar "Enviar" de nuevo creyendo que no salió.
        <p className="rounded-xl border border-trust/25 bg-trust-bg px-4 py-3.5 text-sm font-semibold text-trust">
          {state.message}
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            required
            autoFocus
            placeholder="Email"
            autoComplete="email"
            className="rounded-xl border border-line bg-lavender px-4 py-3.5 text-sm outline-none transition focus:border-violet focus:bg-white"
          />

          {state && "error" in state && <p className="text-sm text-coral">{state.error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="mt-1 rounded-xl bg-violet py-3.5 text-sm font-bold text-white shadow-[0_10px_26px_-10px_rgba(112,92,246,0.7)] transition hover:bg-violet-deep disabled:opacity-60"
          >
            {isPending ? "Mandando..." : "Mandarme el link"}
          </button>
        </form>
      )}
    </div>
  );
}
