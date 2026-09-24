"use client";

import { useState } from "react";
import MisCupones, { type MiCupon } from "@/components/ugc/creador/MisCupones";
import styles from "@/styles/qos.module.css";

/**
 * La wallet: lo que tiene para usar y lo que ya usó. No hay "Disponibles" a
 * propósito —un cupón entra solo escaneando su QR en el negocio
 * (20260924180000)—, así que acá no se ofrece nada que la persona no tenga.
 */
export default function CuponesMiembroTabs({ mios }: { mios: MiCupon[] }) {
  const [tab, setTab] = useState<"por_usar" | "usados">("por_usar");
  const porUsar = mios.filter((m) => m.estado === "por_usar").length;
  const usados = mios.length - porUsar;

  const TABS = [
    { valor: "por_usar" as const, label: `Por usar${porUsar ? ` · ${porUsar}` : ""}` },
    { valor: "usados" as const, label: `Historial${usados ? ` · ${usados}` : ""}` },
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

      <MisCupones
        cupones={mios}
        solo={tab}
        vacio={
          tab === "por_usar"
            ? "No tenés cupones por usar. Cuando escanees el QR de un cupón en uno de tus negocios, va a aparecer acá."
            : "Todavía no usaste ningún cupón. Los que canjees o se te venzan quedan acá."
        }
      />
    </div>
  );
}
