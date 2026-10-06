"use client";

import { useActionState } from "react";
import {
  crearBoardAction,
  guardarBoardAction,
  borrarBoardAction,
  type BoardState,
} from "@/lib/actions/pipeline-boards";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import styles from "@/styles/qos.module.css";

export type PersonaDelEquipo = {
  id: string;
  name: string;
  role: string;
  /** El director entra a todos los boards: se muestra marcado y no se puede sacar. */
  director: boolean;
};

function Aviso({ state }: { state: BoardState }) {
  if (!state) return null;
  return (
    <p
      role="status"
      style={{ fontSize: "12.5px", marginTop: "10px", color: state.error ? "var(--risk)" : "var(--ok)" }}
    >
      {state.error ?? state.ok}
    </p>
  );
}

/**
 * La lista de casillas de quién entra. Los directores van marcados y
 * deshabilitados: entran igual, y una casilla que se puede destildar sin efecto
 * es una mentira.
 */
function Miembros({ equipo, marcados }: { equipo: PersonaDelEquipo[]; marcados: Set<string> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
      {equipo.map((p) => (
        <label
          key={p.id}
          style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", cursor: p.director ? "default" : "pointer" }}
        >
          <input
            type="checkbox"
            name={p.director ? undefined : "members"}
            value={p.id}
            defaultChecked={p.director || marcados.has(p.id)}
            disabled={p.director}
          />
          <span>
            {p.name}
            <span style={{ color: "var(--ink-3)" }}> · {p.director ? "Director, entra siempre" : p.role}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function NuevoBoardForm({ equipo }: { equipo: PersonaDelEquipo[] }) {
  const [state, formAction, pending] = useActionState<BoardState, FormData>(crearBoardAction, null);

  return (
    <form action={formAction}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", marginBottom: "16px" }}>
        <div className={styles.field} style={{ flex: 2, minWidth: "200px" }}>
          <label>Nombre</label>
          <input name="name" required maxLength={40} placeholder="Ej. UGC, Ventas, Eventos" className={styles.inp} />
        </div>
        <div className={styles.field} style={{ flex: 1, minWidth: "180px" }}>
          <label>Tipo</label>
          <select name="kind" defaultValue="tareas" className={styles.inp}>
            <option value="tareas">Tareas — con fecha de entrega</option>
            <option value="videos">Videos — con guion y publicación</option>
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label>Quién entra</label>
        <Miembros equipo={equipo} marcados={new Set()} />
      </div>

      <div style={{ marginTop: "16px" }}>
        <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary}`}>
          {pending ? "Creando…" : "Crear board"}
        </button>
      </div>
      <Aviso state={state} />
    </form>
  );
}

export function EditarBoardForm({
  board,
  equipo,
  miembros,
  tarjetas,
  fijo,
}: {
  board: { id: string; name: string; kind: "videos" | "tareas" };
  equipo: PersonaDelEquipo[];
  miembros: string[];
  /** Cuántas tarjetas tiene. Con alguna, no se ofrece borrar. */
  tarjetas: number;
  /** Uno de los cuatro de siempre: alimentan cuentas del Dashboard y no se borran. */
  fijo: boolean;
}) {
  const [state, formAction, pending] = useActionState<BoardState, FormData>(guardarBoardAction, null);

  return (
    <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: "16px" }}>
      <form action={formAction}>
        <input type="hidden" name="board_id" value={board.id} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", marginBottom: "16px" }}>
          <div className={styles.field} style={{ flex: 1, minWidth: "200px" }}>
            <label>Nombre</label>
            <input name="name" required maxLength={40} defaultValue={board.name} className={styles.inp} />
          </div>
          <p className={styles.attnMeta} style={{ paddingBottom: "12px" }}>
            {board.kind === "tareas" ? "Tareas" : "Videos"} · {tarjetas} {tarjetas === 1 ? "tarjeta" : "tarjetas"}
          </p>
        </div>

        <div className={styles.field}>
          <label>Quién entra</label>
          <Miembros equipo={equipo} marcados={new Set(miembros)} />
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "16px" }}>
          <button type="submit" disabled={pending} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
          {!fijo && tarjetas === 0 && (
            <ConfirmDeleteButton
              action={borrarBoardAction.bind(null, board.id)}
              confirmMessage={`¿Borrar el board "${board.name}"? Se borran también sus columnas. No tiene tarjetas.`}
              className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
            >
              Borrar board
            </ConfirmDeleteButton>
          )}
        </div>
        <Aviso state={state} />
      </form>
    </div>
  );
}
