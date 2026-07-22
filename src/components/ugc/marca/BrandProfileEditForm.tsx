"use client";

import { useActionState } from "react";
import { updateBrandProfileAction, type UpdateBrandProfileState } from "@/lib/actions/brand-profile";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type BrandProfile = {
  brand_name: string;
  industry: string | null;
  website: string | null;
  instagram_handle: string | null;
  description: string | null;
};

export default function BrandProfileEditForm({ initial }: { initial: BrandProfile }) {
  const [state, formAction, pending] = useActionState<UpdateBrandProfileState, FormData>(
    updateBrandProfileAction,
    null
  );

  return (
    <form action={formAction}>
      <div className={styles.field}>
        <label htmlFor="brand_name">Nombre del negocio</label>
        <input
          id="brand_name"
          name="brand_name"
          defaultValue={initial.brand_name}
          required
          className={styles.inp}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="industry">Industria</label>
        <input id="industry" name="industry" defaultValue={initial.industry ?? ""} className={styles.inp} />
      </div>
      <div className={styles.field}>
        <label htmlFor="website">Sitio web</label>
        <input
          id="website"
          name="website"
          type="url"
          defaultValue={initial.website ?? ""}
          placeholder="https://..."
          className={styles.inp}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="instagram_handle">Instagram</label>
        <input
          id="instagram_handle"
          name="instagram_handle"
          defaultValue={initial.instagram_handle ?? ""}
          placeholder="@tu_negocio"
          className={styles.inp}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="description">Descripción</label>
        <textarea
          id="description"
          name="description"
          defaultValue={initial.description ?? ""}
          rows={4}
          className={styles.inp}
        />
      </div>

      {state?.error && (
        <div style={{ marginBottom: "12px", fontSize: "13px", color: "var(--risk)" }}>{state.error}</div>
      )}

      <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
