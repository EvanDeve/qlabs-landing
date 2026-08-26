import type { Paso } from "@/lib/ugc/application-steps";
import styles from "@/styles/qos.module.css";

/**
 * El riel de 4 pasos de una campaña.
 *
 * La línea negra de lo recorrido se dibuja con un ancho en porcentaje y no con
 * un `flex` por tramo: los puntos están repartidos con `space-between`, así que
 * el paso N está siempre en N/(total-1) del ancho, y calcularlo es una cuenta
 * en vez de tres divs vacíos que hay que mantener alineados con los puntos.
 */
export default function RielCampana({ pasos }: { pasos: Paso[] }) {
  const ultimoHecho = pasos.map((p) => p.estado).lastIndexOf("hecho");
  const avance = ultimoHecho <= 0 ? 0 : (ultimoHecho / (pasos.length - 1)) * 100;

  return (
    <div className={styles.mcRiel}>
      <div className={styles.mcRielVia}>
        <span className={styles.mcRielAvance} style={{ width: `${avance}%` }} />
        {pasos.map((p) => (
          <span
            key={p.label}
            className={`${styles.mcRielPunto} ${
              p.estado === "hecho"
                ? styles.mcRielHecho
                : p.estado === "ahora"
                  ? styles.mcRielAhora
                  : ""
            }`}
          />
        ))}
      </div>
      <div className={styles.mcRielLabels}>
        {pasos.map((p) => (
          <span
            key={p.label}
            className={`${styles.mcRielLabel} ${
              p.estado === "ahora" ? styles.mcRielLabelAhora : ""
            }`}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
