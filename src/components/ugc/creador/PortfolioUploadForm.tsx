"use client";

import { useActionState, useRef, useState } from "react";
import {
  uploadPortfolioItemAction,
  type UploadPortfolioItemState,
} from "@/lib/actions/portfolio";
import { PORTFOLIO_CATEGORIES, PORTFOLIO_CATEGORY_LABEL } from "@/lib/ugc/portfolio";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function PortfolioUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<UploadPortfolioItemState, FormData>(
    async (_prevState, formData) => {
      const result = await uploadPortfolioItemAction(_prevState, formData);
      if (!result) {
        formRef.current?.reset();
        setFileName(null);
      }
      return result;
    },
    null
  );

  return (
    <form ref={formRef} action={formAction} className={`${styles.card} ${styles.cardPad}`}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "14px" }}>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label>Archivo</label>
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
              accept="image/*,video/*"
              required
              style={{ display: "none" }}
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>
        </div>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label>Categoría</label>
          <select name="category" defaultValue={PORTFOLIO_CATEGORIES[0]} className={styles.inp}>
            {PORTFOLIO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PORTFOLIO_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field} style={{ marginBottom: 0, minWidth: "180px" }}>
          <label>Descripción (opcional)</label>
          <input type="text" name="caption" placeholder="Reel · Zonna" className={styles.inp} />
        </div>
        <div className={styles.field} style={{ marginBottom: 0, width: "130px" }}>
          <label>Views (opcional)</label>
          <input type="number" name="views" min={0} placeholder="82000" className={styles.inp} />
        </div>
        <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
          {pending ? "Subiendo…" : "Subir"}
        </button>
      </div>
      {state?.error && (
        <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--risk)" }}>{state.error}</p>
      )}
    </form>
  );
}
