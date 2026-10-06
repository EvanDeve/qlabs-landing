"use client";

import { useActionState, useState } from "react";
import { cambiarRolAction, type CambiarRolState } from "@/lib/actions/staff";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import type { StaffRole } from "@/lib/database.types";
import styles from "@/styles/qos.module.css";

const STAFF_ROLES = Object.keys(STAFF_ROLE_LABEL) as StaffRole[];

/**
 * El rol de un integrante, editable en el lugar. "Guardar" aparece solo cuando
 * el select ya no dice lo que está guardado: cambiar el rol de alguien cambia
 * qué ve en Q·OS, y no tiene que pasar por tocar el select sin querer.
 *
 * El select es controlado y arranca del rol guardado. Un `defaultValue` fijo
 * en un form de edición es cómo se borran datos sin que nadie lo note.
 */
export default function StaffRoleSelect({
  profileId,
  rol,
  esPropio,
}: {
  profileId: string;
  rol: StaffRole;
  /** El propio rol no se cambia desde acá: lo tiene que hacer otro director. */
  esPropio: boolean;
}) {
  const [elegido, setElegido] = useState<StaffRole>(rol);
  const [state, formAction, pending] = useActionState<CambiarRolState, FormData>(cambiarRolAction, null);

  if (esPropio) return <div className={styles.attnMeta}>{STAFF_ROLE_LABEL[rol]}</div>;

  const cambio = elegido !== rol;

  return (
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
      <input type="hidden" name="profile_id" value={profileId} />
      <select
        name="staff_role"
        value={elegido}
        onChange={(e) => setElegido(e.target.value as StaffRole)}
        className={styles.selectInp}
        aria-label="Rol"
        style={{ fontSize: "12.5px", padding: "4px 28px 4px 10px" }}
      >
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {STAFF_ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {cambio && (
        <>
          <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnSm} ${styles.btnPrimary}`}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setElegido(rol)}
            className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
          >
            Cancelar
          </button>
        </>
      )}
      {state && !cambio && (
        <span role="status" style={{ fontSize: "12px", color: state.error ? "var(--risk)" : "var(--ok)" }}>
          {state.error ?? state.ok}
        </span>
      )}
      {state?.error && cambio && (
        <span role="status" style={{ fontSize: "12px", color: "var(--risk)" }}>
          {state.error}
        </span>
      )}
    </form>
  );
}
