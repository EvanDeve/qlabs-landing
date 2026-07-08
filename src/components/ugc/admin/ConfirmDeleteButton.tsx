"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export default function ConfirmDeleteButton({
  action,
  confirmMessage,
  className,
  style,
  children,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        {children}
      </button>

      {open &&
        createPortal(
          <div className={styles.modalOverlay} onClick={() => !isPending && setOpen(false)}>
            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: "16px", marginBottom: "10px" }}>¿Eliminar?</h2>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", marginBottom: "20px" }}>{confirmMessage}</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setOpen(false)}
                  className={`${styles.btn} ${styles.btnGhost}`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await action();
                      setOpen(false);
                    });
                  }}
                  className={`${styles.btn} ${styles.btnDanger}`}
                >
                  {isPending ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            </div>
          </div>,
          document.getElementById("qos-root") ?? document.body
        )}
    </>
  );
}
