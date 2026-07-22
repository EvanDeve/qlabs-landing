"use client";

import { useActionState } from "react";
import { applyToCampaignAction, type ApplyActionState } from "@/lib/actions/applications";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function ApplyForm({ campaignId }: { campaignId: string }) {
  const [state, formAction, pending] = useActionState<ApplyActionState, FormData>(
    applyToCampaignAction,
    null
  );

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <input type="hidden" name="campaign_id" value={campaignId} />
      <textarea
        name="pitch_message"
        placeholder="Mensaje opcional para la marca (por qué encajás con esta campaña)"
        rows={2}
        className={styles.inp}
        style={{ resize: "none" }}
      />
      {state?.error && <p style={{ fontSize: "12.5px", color: "var(--risk)" }}>{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ alignSelf: "flex-start" }}
      >
        {pending ? "Enviando…" : "Aplicar"}
      </button>
    </form>
  );
}
