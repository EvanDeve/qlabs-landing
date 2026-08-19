"use client";

import { useState } from "react";
import CuponesGrid, { type CuponVista } from "./CuponesGrid";
import MisCupones, { type MiCupon } from "./MisCupones";
import styles from "@/styles/qos.module.css";

/**
 * Dos vistas del mismo módulo: lo que puedo conseguir y lo que ya tengo.
 *
 * Van como pestañas y no como dos rutas porque el creador salta de una a la
 * otra todo el tiempo —reclama algo y quiere verlo en su lista—, y una
 * navegación completa por ese salto se siente lento para lo poco que cambia.
 */
export default function RecompensasTabs({
  disponibles,
  mios,
  nivelActual,
}: {
  disponibles: CuponVista[];
  mios: MiCupon[];
  nivelActual: number;
}) {
  const [tab, setTab] = useState<"disponibles" | "mios">("disponibles");

  const porUsar = mios.filter((m) => m.estado === "por_usar").length;

  return (
    <div>
      <div className={styles.subtabs}>
        <button
          type="button"
          className={`${styles.subtab} ${tab === "disponibles" ? styles.subtabOn : ""}`}
          onClick={() => setTab("disponibles")}
        >
          Disponibles {disponibles.length > 0 && `(${disponibles.length})`}
        </button>
        <button
          type="button"
          className={`${styles.subtab} ${tab === "mios" ? styles.subtabOn : ""}`}
          onClick={() => setTab("mios")}
        >
          Mis cupones {porUsar > 0 && `(${porUsar})`}
        </button>
      </div>

      {tab === "disponibles" ? (
        disponibles.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>
            Todavía no hay cupones publicados. Cuando una marca publique el primero, te va a
            aparecer acá.
          </div>
        ) : (
          <CuponesGrid cupones={disponibles} nivelActual={nivelActual} />
        )
      ) : (
        <MisCupones cupones={mios} />
      )}
    </div>
  );
}
