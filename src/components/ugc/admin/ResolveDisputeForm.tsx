"use client";

import { useActionState, useState } from "react";
import { resolveDisputeAction, type ConflictActionState } from "@/lib/actions/conflicts";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

// Resolver una disputa manda correo a las dos partes, así que la nota es
// obligatoria: es el registro de por qué se decidió lo que se decidió.
export default function ResolveDisputeForm({ applicationId }: { applicationId: string }) {
  const [decision, setDecision] = useState<"approve" | "cancel">("approve");
  const [state, formAction, pending] = useActionState<ConflictActionState, FormData>(
    resolveDisputeAction,
    null
  );

  return (
    <form action={formAction} style={{ marginTop: "16px" }}>
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="decision" value={decision} />

      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setDecision("approve")}
          className={`${styles.subtab} ${decision === "approve" ? styles.subtabOn : ""}`}
        >
          Dar la entrega por aprobada
        </button>
        <button
          type="button"
          onClick={() => setDecision("cancel")}
          className={`${styles.subtab} ${decision === "cancel" ? styles.subtabOn : ""}`}
        >
          Cancelar la colaboración
        </button>
      </div>

      <textarea
        name="admin_note"
        required
        minLength={10}
        rows={3}
        placeholder="Cómo se resolvió y por qué. Lo van a leer las dos partes."
        className={styles.inp}
        style={{ width: "100%", resize: "vertical", marginBottom: "10px" }}
      />

      {state && "error" in state && (
        <p style={{ fontSize: "13px", color: "var(--risk)", marginBottom: "10px" }}>{state.error}</p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
          {pending
            ? "Resolviendo…"
            : decision === "approve"
              ? "Aprobar y avisar a ambos"
              : "Cancelar y avisar a ambos"}
        </button>
      </div>
    </form>
  );
}
