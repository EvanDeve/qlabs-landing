"use client";

import { useActionState } from "react";
import { reenviarAccesoAction, type ReenviarAccesoState } from "@/lib/actions/staff";
import styles from "@/styles/qos.module.css";

/**
 * Le manda de nuevo el link para definir contraseña a alguien del equipo. Es lo
 * que la pantalla de link vencido le dice a la persona que pida.
 */
export default function ReenviarAccesoButton({ profileId }: { profileId: string }) {
  const [state, formAction, pending] = useActionState<ReenviarAccesoState, FormData>(reenviarAccesoAction, null);

  return (
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <input type="hidden" name="profile_id" value={profileId} />
      {state && (
        <span role="status" style={{ fontSize: "12px", color: state.error ? "var(--risk)" : "var(--ok)" }}>
          {state.error ?? state.ok}
        </span>
      )}
      <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}>
        {pending ? "Enviando…" : "Reenviar acceso"}
      </button>
    </form>
  );
}
