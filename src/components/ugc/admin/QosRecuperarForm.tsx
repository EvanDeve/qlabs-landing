"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type AuthActionState } from "@/lib/actions/auth";
import styles from "@/styles/qos.module.css";

/**
 * Pedir el link para recuperar la contraseña, del lado del equipo. Es el mismo
 * server action que usa el marketplace; lo único propio es la piel de Q·OS.
 */
export default function QosRecuperarForm() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    requestPasswordResetAction,
    null
  );

  // Con el correo ya mandado el formulario no tiene nada más que preguntar:
  // dejarlo en pantalla solo invita a apretar "Enviar" otra vez creyendo que
  // no funcionó.
  if (state && "message" in state) {
    return (
      <p className={styles.authOk}>
        <i className="fa-solid fa-circle-check" aria-hidden style={{ marginTop: "2px" }} />
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction}>
      <div className={styles.field}>
        <label htmlFor="qos-recuperar-email">Correo</label>
        <input
          id="qos-recuperar-email"
          type="email"
          name="email"
          required
          autoComplete="username"
          autoFocus
          className={styles.inp}
          placeholder="vos@qlabsmethod.com"
        />
      </div>

      {state && "error" in state ? (
        <p role="alert" className={styles.authError}>
          <i className="fa-solid fa-circle-exclamation" aria-hidden style={{ marginTop: "2px" }} />
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={`${styles.btn} ${styles.btnPrimary} ${styles.authSubmit}`}
      >
        {isPending ? "Mandando…" : "Mandarme el link"}
      </button>
    </form>
  );
}
