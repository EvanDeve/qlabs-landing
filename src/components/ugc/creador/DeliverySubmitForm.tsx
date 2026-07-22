"use client";

import { useActionState, useRef, useState } from "react";
import { submitDeliveryAction, type SubmitDeliveryState } from "@/lib/actions/deliveries";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function DeliverySubmitForm({ applicationId }: { applicationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<SubmitDeliveryState, FormData>(
    async (_prevState, formData) => {
      const result = await submitDeliveryAction(_prevState, formData);
      if (!result) {
        formRef.current?.reset();
        setFileName(null);
      }
      return result;
    },
    null
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{
        marginTop: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
        borderRadius: "var(--r-lg)",
        background: "var(--surface-3)",
      }}
    >
      <p style={{ fontSize: "12.5px", color: "var(--ink-3)" }}>
        Subí el video final y pegá el link del post ya publicado en redes — podés mandar los dos juntos.
      </p>
      <div className={styles.field} style={{ marginBottom: 0 }}>
        <label>Archivo (video final)</label>
        <div className={styles.fileRow}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSoft}`}
            onClick={() => fileInputRef.current?.click()}
          >
            Elegir archivo
          </button>
          <span className={styles.fileName}>{fileName ?? "Sin archivo seleccionado"}</span>
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            style={{ display: "none" }}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </div>
      </div>
      <div className={styles.field} style={{ marginBottom: 0 }}>
        <label>Link del post publicado (Instagram, TikTok, etc.)</label>
        <input type="url" name="external_url" placeholder="https://..." className={styles.inp} />
      </div>
      <div className={styles.field} style={{ marginBottom: 0 }}>
        <label>Nota (opcional)</label>
        <input type="text" name="note" placeholder="Reel final, versión con subtítulos" className={styles.inp} />
      </div>
      <input type="hidden" name="application_id" value={applicationId} />
      {state?.error && <p style={{ fontSize: "12.5px", color: "var(--risk)" }}>{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`${styles.btn} ${styles.btnPrimary}`}
        style={{ alignSelf: "flex-start" }}
      >
        {pending ? "Entregando…" : "Entregar pieza"}
      </button>
    </form>
  );
}
