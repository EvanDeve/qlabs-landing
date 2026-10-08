"use client";

import { useActionState, useState } from "react";
import { resolveDisputeAction, type ConflictActionState } from "@/lib/actions/conflicts";
import styles from "@/styles/qos.module.css";

const DECISIONES = [
  {
    id: "approve",
    titulo: "Dar la entrega por aprobada",
    detalle: "Se libera el pago al creador",
  },
  {
    id: "cancel",
    titulo: "Cancelar la colaboración",
    detalle: "No se paga y la aplicación se cierra",
  },
] as const;

/**
 * "Tu decisión" (mockup 1f): las dos salidas como tarjetas con lo que
 * implica cada una, la nota y a quién le llega.
 *
 * Resolver una disputa manda correo a las dos partes, así que la nota es
 * obligatoria: es el registro de por qué se decidió lo que se decidió.
 */
export default function ResolveDisputeForm({
  applicationId,
  marca,
  creador,
}: {
  applicationId: string;
  marca: string;
  creador: string;
}) {
  const [decision, setDecision] = useState<"approve" | "cancel">("approve");
  const [state, formAction, pending] = useActionState<ConflictActionState, FormData>(
    resolveDisputeAction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="application_id" value={applicationId} />
      <div className={styles.fichaK} style={{ marginBottom: 8, color: "var(--ink)", fontSize: 13 }}>
        Tu decisión
      </div>
      <div className={styles.decisionGrid} role="radiogroup" aria-label="Tu decisión">
        {DECISIONES.map((d) => (
          <label
            key={d.id}
            className={`${styles.decisionCard} ${decision === d.id ? styles.decisionOn : ""}`}
          >
            <input
              type="radio"
              name="decision"
              value={d.id}
              checked={decision === d.id}
              onChange={() => setDecision(d.id)}
            />
            <span>
              <b>{d.titulo}</b>
              <small>{d.detalle}</small>
            </span>
          </label>
        ))}
      </div>

      <textarea
        name="admin_note"
        required
        minLength={10}
        rows={3}
        placeholder="Nota para las dos partes (obligatoria)…"
        className={styles.inp}
        style={{ width: "100%", resize: "vertical", margin: "12px 0 10px" }}
      />

      {state && "error" in state && (
        <p style={{ fontSize: "13px", color: "var(--risk)", marginBottom: "10px" }}>{state.error}</p>
      )}

      <div className={styles.decisionPie}>
        <span>
          Les llega por correo a {marca} y a {creador}.
        </span>
        <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnAccent}`}>
          {pending ? "Resolviendo…" : "Resolver disputa"}
        </button>
      </div>
    </form>
  );
}
