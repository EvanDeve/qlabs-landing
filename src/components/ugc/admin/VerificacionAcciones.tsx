"use client";

import { useState } from "react";
import {
  setBrandRejectedAction,
  setBrandVerifiedAction,
  setCreatorRejectedAction,
  setCreatorVerifiedAction,
} from "@/lib/actions/admin";
import type { EstadoCuenta } from "@/lib/ugc/estado-cuenta";
import styles from "@/styles/qos.module.css";

/**
 * Los botones de estado de una cuenta del marketplace, para creadores y marcas.
 *
 * Es cliente por una sola razón: el motivo del rechazo se pide en el momento,
 * desplegando un campo en la misma fila. Abrirlo con `window.confirm()` no es
 * opción — congela la automatización del navegador y además no deja escribir
 * un texto libre.
 */
export default function VerificacionAcciones({
  profileId,
  tipo,
  estado,
  variante = "completa",
}: {
  profileId: string;
  tipo: "creator" | "brand";
  estado: EstadoCuenta;
  /**
   * "fila": la versión de una fila de la lista (mockup 1b). Solo la pendiente
   * muestra botones —Rechazar y Verificar—; lo demás vive en el menú "⋯".
   */
  variante?: "completa" | "fila";
}) {
  const [rechazando, setRechazando] = useState(false);
  const esMarca = tipo === "brand";
  const verificarAction = esMarca ? setBrandVerifiedAction : setCreatorVerifiedAction;
  const rechazarAction = esMarca ? setBrandRejectedAction : setCreatorRejectedAction;

  if (rechazando) {
    return (
      <form
        action={rechazarAction}
        style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "260px" }}
      >
        <input type="hidden" name="profile_id" value={profileId} />
        <input type="hidden" name="rechazada" value="true" />
        <textarea
          name="motivo"
          rows={2}
          className={styles.inp}
          placeholder="Motivo (opcional) — lo va a leer la persona"
        />
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="submit" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}>
            Confirmar rechazo
          </button>
          <button
            type="button"
            onClick={() => setRechazando(false)}
            className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  if (variante === "fila" && estado !== "pendiente") return null;

  // En la fila, Rechazar va antes que Verificar: la acción que confirma queda
  // a la derecha, donde termina la lectura.
  if (variante === "fila") {
    return (
      <>
        <button
          type="button"
          onClick={() => setRechazando(true)}
          className={`${styles.btn} ${styles.btnSm} ${styles.btnGhostDanger}`}
        >
          Rechazar
        </button>
        <form action={verificarAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="verified" value="true" />
          <button type="submit" className={`${styles.btn} ${styles.btnSm} ${styles.btnAccent}`}>
            Verificar
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      {estado !== "verificada" && (
        <form action={verificarAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="verified" value="true" />
          <button type="submit" className={`${styles.btn} ${styles.btnSm} ${styles.btnAccent}`}>
            Verificar
          </button>
        </form>
      )}

      {estado === "verificada" && (
        <form action={verificarAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="verified" value="false" />
          <button type="submit" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhostDanger}`}>
            Quitar verificación
          </button>
        </form>
      )}

      {estado === "pendiente" && (
        <button
          type="button"
          onClick={() => setRechazando(true)}
          className={`${styles.btn} ${styles.btnSm} ${styles.btnGhostDanger}`}
        >
          Rechazar
        </button>
      )}

      {estado === "rechazada" && (
        // Levantar el rechazo la devuelve a la cola sin verificarla: es el único
        // camino de vuelta, porque la persona no puede sacarse el rechazo sola.
        <form action={rechazarAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="rechazada" value="false" />
          <button type="submit" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}>
            Devolver a revisión
          </button>
        </form>
      )}
    </>
  );
}
