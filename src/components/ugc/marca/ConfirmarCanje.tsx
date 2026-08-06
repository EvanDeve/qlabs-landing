"use client";

import { useActionState } from "react";
import { canjearAction, type CanjeState } from "@/lib/actions/cupones";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * El botón que quema el código, para la pantalla a la que lleva el QR.
 *
 * Sin `window.confirm`: congela la automatización del navegador y además en un
 * celular en el mostrador un diálogo nativo es peor que el propio botón, que ya
 * es explícito. La confirmación es el botón mismo.
 */
export default function ConfirmarCanje({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState<CanjeState, FormData>(canjearAction, null);

  if (state && "ok" in state) {
    return (
      <div>
        <b style={{ color: "var(--ok)" }}>Canje confirmado ✓</b>
        <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginTop: "4px" }}>
          Quedó registrado en tus canjes. El código está quemado.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={code} />
      <button
        type="submit"
        disabled={pending}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ width: "100%" }}
      >
        {pending ? "Confirmando…" : "✓ Confirmar canje"}
      </button>
      {state && "error" in state && state.error && (
        <p style={{ fontSize: "12.5px", color: "var(--risk)", marginTop: "10px" }}>{state.error}</p>
      )}
    </form>
  );
}
