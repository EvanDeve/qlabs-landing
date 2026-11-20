import { avanceDelDia, diasDeAdelanto, textoAdelanto } from "@/lib/ugc/edicion";
import type { DatosVistaEditor } from "@/lib/ugc/edicion-datos";
import styles from "@/styles/qos.module.css";

/**
 * El Dashboard del editor (spec 003). Server component: recibe todo armado de
 * getVistaEditor y solo pinta. Versión funcional con las clases de Q·OS; sin
 * mockups todavía (P-09).
 */
export function VistaEditor({ datos }: { datos: DatosVistaEditor }) {
  const { hoy, fila, terminadosHoy } = datos;
  const avance = avanceDelDia(terminadosHoy.length, hoy);
  const adelanto = diasDeAdelanto(fila, hoy);
  const textoDeAdelanto = textoAdelanto(adelanto);

  return (
    <div>
      <div className={styles.statCard}>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Hoy</div>
            <div className={styles.statNum}>{avance.texto}</div>
            <div className={styles.statSub} data-tone={avance.cumplida === null ? undefined : avance.cumplida ? "ok" : "warn"}>
              {avance.meta === null
                ? "Sábado y domingo no cuentan para la meta"
                : avance.cumplida
                  ? "Llegaste a la meta del día"
                  : `Te faltan ${avance.meta - avance.terminados} para la meta`}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Adelanto</div>
            <div className={styles.statNum}>{textoDeAdelanto ?? "—"}</div>
            <div className={styles.statSub} data-tone={adelanto === null ? undefined : adelanto < 0 ? "risk" : adelanto === 0 ? "warn" : "ok"}>
              {textoDeAdelanto === null
                ? "Ningún video de tu fila tiene fecha"
                : "hasta la fecha del primer video de tu fila"}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>En tu fila</div>
            <div className={styles.statNum}>{fila.length}</div>
            <div className={styles.statSub}>{fila.length === 1 ? "video por editar" : "videos por editar"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
