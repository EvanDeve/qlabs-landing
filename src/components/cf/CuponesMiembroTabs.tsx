"use client";

import { useState } from "react";
import CuponesGrid, { type CuponVista } from "@/components/ugc/creador/CuponesGrid";
import MisCupones, { type MiCupon } from "@/components/ugc/creador/MisCupones";
import styles from "@/styles/qos.module.css";

/**
 * Las dos vistas de los cupones del miembro, con las mismas tarjetas que
 * Recompensas del creador. Arranca en "Mis cupones" si tiene alguno por usar:
 * lo más común al abrir esta pantalla es ir a mostrar uno en caja.
 */
export default function CuponesMiembroTabs({ disponibles, mios }: { disponibles: CuponVista[]; mios: MiCupon[] }) {
  const [tab, setTab] = useState<"disponibles" | "mios">(
    mios.some((m) => m.estado === "por_usar") ? "mios" : "disponibles"
  );

  const TABS = [
    { valor: "mios" as const, label: "Mis cupones" },
    { valor: "disponibles" as const, label: "Disponibles" },
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

      {tab === "mios" ? (
        <MisCupones cupones={mios} />
      ) : disponibles.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          No hay cupones nuevos por ahora. Cuando uno de tus negocios publique uno, te va a aparecer acá.
        </div>
      ) : (
        <CuponesGrid cupones={disponibles} nivelActual={1} para="miembro" />
      )}
    </div>
  );
}
