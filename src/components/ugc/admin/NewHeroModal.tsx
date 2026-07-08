"use client";

import { useActionState, useState } from "react";
import { createHeroAction, type CreateHeroState } from "@/lib/actions/heroes";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function NewHeroModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<CreateHeroState, FormData>(createHeroAction, null);
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div
      className={styles.modalOverlay}
      onClick={() => {
        setOpen(false);
        onClose();
      }}
    >
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "18px" }}>Nuevo Hero</h2>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onClose();
            }}
            className={styles.drawerClose}
          >
            <QosIcon name="x" size={16} />
          </button>
        </div>

        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>
          Crea el negocio directo, sin pasar por el registro público del marketplace. Queda marcado como
          Hero gestionado.
        </p>

        <form action={formAction}>
          <div className={styles.field}>
            <label>Nombre de la marca</label>
            <input name="brand_name" required className={styles.inp} />
          </div>

          <div className={styles.field}>
            <label>Industria (opcional)</label>
            <input name="industry" className={styles.inp} />
          </div>

          <div className={styles.field}>
            <label>Email de contacto</label>
            <input type="email" name="contact_email" required className={styles.inp} />
          </div>

          {state?.error && <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--risk)", marginBottom: "12px" }}>{state.error}</p>}

          <button type="submit" disabled={isPending} className={`${styles.btn} ${styles.btnPrimary}`}>
            {isPending ? "Creando…" : "Crear Hero"}
          </button>
        </form>
      </div>
    </div>
  );
}
