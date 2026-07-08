"use client";

import { useActionState } from "react";
import { inviteStaffAction, type InviteStaffState } from "@/lib/actions/staff";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import type { StaffRole } from "@/lib/database.types";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

const STAFF_ROLES = Object.keys(STAFF_ROLE_LABEL) as StaffRole[];

export default function InviteStaffForm() {
  const [state, formAction, isPending] = useActionState<InviteStaffState, FormData>(inviteStaffAction, null);

  return (
    <form action={formAction} style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
      <div className={styles.field} style={{ flex: 1, minWidth: "160px" }}>
        <label>Nombre</label>
        <input name="display_name" required className={styles.inp} />
      </div>

      <div className={styles.field} style={{ flex: 1, minWidth: "180px" }}>
        <label>Email</label>
        <input type="email" name="email" required className={styles.inp} />
      </div>

      <div className={styles.field} style={{ flex: 1, minWidth: "160px" }}>
        <label>Rol</label>
        <select name="staff_role" className={styles.inp}>
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {STAFF_ROLE_LABEL[role]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Color</label>
        <input type="color" name="color" defaultValue="#705CF6" style={{ height: "42px", width: "56px" }} />
      </div>

      <div className={styles.field}>
        <label style={{ opacity: 0 }}>Invitar</label>
        <button type="submit" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
          {isPending ? "Enviando…" : "Invitar"}
        </button>
      </div>

      {state && "error" in state && (
        <p style={{ width: "100%", fontSize: "13px", fontWeight: 700, color: "var(--risk)" }}>{state.error}</p>
      )}
      {state && "message" in state && (
        <p style={{ width: "100%", fontSize: "13px", fontWeight: 700, color: "var(--ok)" }}>{state.message}</p>
      )}
    </form>
  );
}
