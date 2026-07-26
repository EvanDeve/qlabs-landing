"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { cancelApplicationAction, disputeApplicationAction } from "@/lib/actions/conflicts";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

// Cancelar o disputar exigen un motivo escrito: la contraparte lo recibe por
// correo y, en el caso de la disputa, es lo único con lo que Q Labs va a
// resolver. Por eso es un modal con textarea y no un botón de confirmación.
//
// El modal se portalea a #qos-root (no a document.body) por dos razones ya
// conocidas en este código: las tarjetas con :hover aplican transform y crean
// un containing block que atraparía un position:fixed, y las variables CSS
// (--surface, --ink-2) solo existen dentro de .qosRoot.

export default function ConflictActionButton({
  applicationId,
  kind,
  label,
  className,
}: {
  applicationId: string;
  kind: "cancel" | "dispute";
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Se llama la acción a mano en vez de useActionState porque hay que cerrar el
  // modal solo si salió bien, y acá el resultado se puede esperar directamente.
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const accion = kind === "cancel" ? cancelApplicationAction : disputeApplicationAction;
      const resultado = await accion(null, formData);
      if (resultado && "error" in resultado) {
        setError(resultado.error);
      } else {
        setOpen(false);
      }
    });
  }

  const esCancelar = kind === "cancel";
  const titulo = esCancelar ? "¿Cancelar la colaboración?" : "Reportar un problema";
  const bajada = esCancelar
    ? "Se le avisa a la otra parte con el motivo que escribas. Esto no se puede deshacer."
    : "Q Labs va a revisar el caso y les escribe a los dos. El pago queda en pausa hasta que se resuelva.";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>

      {open &&
        createPortal(
          <div className={styles.modalOverlay} onClick={() => !pending && setOpen(false)}>
            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>{titulo}</h2>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", marginBottom: "16px" }}>{bajada}</p>

              <form onSubmit={enviar}>
                <input type="hidden" name="application_id" value={applicationId} />
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  rows={4}
                  placeholder={
                    esCancelar
                      ? "Ej: me salió un viaje y no voy a poder grabar esta semana."
                      : "Ej: entregué el reel hace 8 días y no he tenido respuesta."
                  }
                  className={styles.inp}
                  style={{ width: "100%", resize: "vertical", marginBottom: "6px" }}
                />
                <p style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "16px" }}>
                  Mínimo una línea.
                </p>

                {error && (
                  <p style={{ fontSize: "13px", color: "var(--risk)", marginBottom: "12px" }}>{error}</p>
                )}

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setOpen(false)}
                    className={`${styles.btn} ${styles.btnGhost}`}
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className={`${styles.btn} ${styles.btnDanger}`}
                  >
                    {pending
                      ? esCancelar
                        ? "Cancelando…"
                        : "Enviando…"
                      : esCancelar
                        ? "Sí, cancelar"
                        : "Reportar a Q Labs"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.getElementById("qos-root") ?? document.body
        )}
    </>
  );
}
