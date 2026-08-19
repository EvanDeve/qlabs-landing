"use client";

import { useActionState, useState } from "react";
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
    <form action={formAction} style={{ display: "grid", gap: "14px" }}>
      {/* De dónde venía. Solo se respeta si la sesión que entra puede pisar esa
          ruta — el filtro está en signInAction, no acá. */}
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
        <div style={{ position: "relative" }}>
          <input
            id="qos-pwd"
            type={verPwd ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            className={styles.inp}
            style={{ paddingRight: "42px" }}
          />
          <button
            type="button"
            onClick={() => setVerPwd((v) => !v)}
            tabIndex={-1}
            aria-label={verPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: 0,
              padding: 0,
              cursor: "pointer",
              color: "var(--ink-3)",
              lineHeight: 1,
            }}
          >
            <i className={verPwd ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"} aria-hidden />
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ width: "100%", justifyContent: "center", height: "42px", marginTop: "2px" }}
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>

      {state && "error" in state ? (
        <p
          role="alert"
          style={{
            margin: 0,
            borderRadius: "var(--r-md)",
            background: "var(--risk-bg)",
            border: "1px solid var(--risk-line)",
            color: "var(--risk)",
            padding: "9px 12px",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
