"use client";

import { useState } from "react";
import CuponesGrid, { type CuponVista } from "./CuponesGrid";
import MisCupones, { type MiCupon } from "./MisCupones";
import HistorialPuntos, {
  type MesHistorial,
  type NivelCamino,
  type ReglaPuntos,
} from "./HistorialPuntos";
import styles from "@/styles/qos.module.css";

/**
 * Tres vistas del mismo módulo: lo que puedo conseguir, lo que ya tengo y cómo
 * llegué hasta acá.
 *
 * Control segmentado y no tres rutas porque el creador salta de una a la otra
 * todo el tiempo —reclama algo y quiere verlo en su lista— y una navegación
 * completa por ese salto se siente lenta para lo poco que cambia.
 */
export default function RecompensasTabs({
  disponibles,
  mios,
  nivelActual,
  camino,
  meses,
  reglas,
  totalEventos,
  mostrados,
}: {
  disponibles: CuponVista[];
  mios: MiCupon[];
  nivelActual: number;
  camino: NivelCamino[];
  meses: MesHistorial[];
  reglas: ReglaPuntos[];
  totalEventos: number;
  mostrados: number;
}) {
  const [tab, setTab] = useState<"disponibles" | "mios" | "historial">("disponibles");

  const TABS = [
    { valor: "disponibles" as const, label: "Disponibles" },
    { valor: "mios" as const, label: "Mis cupones" },
    { valor: "historial" as const, label: "Historial" },
  ];

  return (
    <div>
      <div className={styles.segmented} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.valor}
            type="button"
            role="tab"
            aria-selected={tab === t.valor}
            className={`${styles.segItem} ${tab === t.valor ? styles.segItemOn : ""}`}
            onClick={() => setTab(t.valor)}
          >
            {t.label}
          </button>
        ))}
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
      ) : tab === "mios" ? (
        <MisCupones cupones={mios} />
      ) : (
        <HistorialPuntos
          camino={camino}
          meses={meses}
          reglas={reglas}
          totalEventos={totalEventos}
          mostrados={mostrados}
        />
      )}
    </div>
  );
}
