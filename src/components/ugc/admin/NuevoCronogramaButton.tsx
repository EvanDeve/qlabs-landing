"use client";

import { useState } from "react";
import { crearCronogramaAction } from "@/lib/actions/cronogramas";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

/**
 * "Crear cronograma": elegís Hero y mes, y caés en la pantalla de armado.
 *
 * El mes viene precargado con el SIGUIENTE y no con el actual: un cronograma se
 * arma antes de que el mes empiece, que es todo el punto de tener uno. Igual se
 * puede elegir otro, incluidos los pasados, para cargar meses viejos.
 */
export default function NuevoCronogramaButton({
  heroes,
  mesSugerido,
}: {
  heroes: { id: string; name: string }[];
  mesSugerido: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={`${styles.btn} ${styles.btnPrimary}`}>
        <QosIcon name="plus" size={15} /> Crear cronograma
      </button>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={() => setAbierto(false)}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sectionHead}>
          <h2>Nuevo cronograma</h2>
        </div>

        <form action={crearCronogramaAction} style={{ marginTop: "14px" }}>
          <div className={styles.field}>
            <label htmlFor="crono-hero">Hero</label>
            <select id="crono-hero" name="hero_id" required className={styles.inp} defaultValue="">
              <option value="" disabled>
                Elegí un Hero…
              </option>
              {heroes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Campo de mes y no un <select> de nombres: la lista era una ventana
              fija de meses alrededor del actual, o sea un tope arbitrario que
              impedía cargar cualquier mes fuera de él. Además es el mismo
              control que el filtro del pipeline y el selector del Dashboard. */}
          <div className={styles.field}>
            <label htmlFor="crono-mes">Mes</label>
            <input
              id="crono-mes"
              type="month"
              name="month"
              defaultValue={mesSugerido.slice(0, 7)}
              required
              className={styles.inp}
            />
          </div>

          <p className={styles.formNote} style={{ marginBottom: "14px" }}>
            Se crea vacío y su tarjeta aparece en el pipeline. Los videos se agregan en la pantalla siguiente.
          </p>

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Crear y armar
            </button>
            <button type="button" onClick={() => setAbierto(false)} className={`${styles.btn} ${styles.btnGhost}`}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
