"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionState } from "@/lib/actions/auth";
import styles from "@/styles/qos.module.css";

/**
 * La puerta de Q·OS. A diferencia de AuthForm (el del marketplace) no pregunta
 * "¿sos creador o marca?" ni ofrece registrarse: al equipo lo da de alta un
 * director desde Equipo, nadie se crea una cuenta de Q·OS por su cuenta.
 *
 * Reusa `signInAction`, que decide el destino con `destinoDeSesion`. Por eso
 * una cuenta de creador que entre por acá termina en su propio panel sin
 * enterarse de que se equivocó de puerta.
 */
export default function QosLoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(signInAction, null);
  const [verPwd, setVerPwd] = useState(false);

  return (
    <form action={formAction}>
      {/* De dónde venía. Solo se respeta si la sesión que entra puede pisar esa
          ruta — el filtro está en `destinoConNext`, no acá. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className={styles.field}>
        <label htmlFor="qos-email">Correo</label>
        <input
          id="qos-email"
          type="email"
          name="email"
          required
          autoComplete="username"
          autoFocus
          className={styles.inp}
          placeholder="vos@qlabsmethod.com"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="qos-pwd">Contraseña</label>
        <div className={styles.authPwd}>
          <input
            id="qos-pwd"
            type={verPwd ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            className={styles.inp}
          />
          <button
            type="button"
            onClick={() => setVerPwd((v) => !v)}
            tabIndex={-1}
            aria-label={verPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            className={styles.authEye}
          >
            <i className={verPwd ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"} aria-hidden />
          </button>
        </div>
      </div>

      {state && "error" in state ? (
        <p role="alert" className={styles.authError}>
          <i className="fa-solid fa-circle-exclamation" aria-hidden style={{ marginTop: "2px" }} />
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary} ${styles.authSubmit}`}>
        {isPending ? "Entrando…" : "Entrar"}
      </button>

      {/* Fuera del <form>-submit pero adentro del form: así el link queda en el
          orden de tabulación justo después del botón, que es donde lo busca
          quien ya se dio cuenta de que no se acuerda de la clave. */}
      <p className={styles.authAlt}>
        <Link href="/admin/recuperar">Olvidé mi contraseña</Link>
      </p>
    </form>
  );
}
