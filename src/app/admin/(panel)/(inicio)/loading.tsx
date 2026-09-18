import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

/* El Dashboard vive en su propio grupo de ruta `(inicio)` solo por este
   archivo: si el loading quedara en `(panel)/`, Next lo usaría como fallback
   de TODAS las secciones y al ir al Pipeline parpadearía esta silueta. */
export default function Loading() {
  return (
    <SkelPantalla className={styles.dashFull}>
      {/* Las dos tarjetas de cuatro stats, con los mismos divisores. */}
      {Array.from({ length: 2 }, (_, fila) => (
        <div key={fila} className={styles.statCard}>
          <div className={styles.statRow}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.stat}>
                <Skel w={120} h={12} style={{ marginBottom: 12 }} />
                <Skel w={44} h={30} />
                <Skel w="64%" h={10} style={{ marginTop: 12 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className={styles.dashGrid}>
        <div className={`${styles.card} ${styles.cardScroll}`} style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 22 }}>
            <Skel w={150} h={13} />
            <Skel w={60} h={11} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Skel w={32} h={32} r={8} />
                <Skel w="24%" h={11} />
                <Skel w={86} h={22} r={11} style={{ marginLeft: "auto" }} />
                <Skel w={40} h={11} />
                <Skel w={52} h={22} r={11} />
                <Skel w={58} h={28} r={9} />
              </div>
            ))}
          </div>
        </div>
        <div className={`${styles.card} ${styles.cardScroll}`} style={{ padding: 18 }}>
          <Skel w={100} h={13} style={{ marginBottom: 22 }} />
          <SkelLineas n={4} />
        </div>
      </div>
    </SkelPantalla>
  );
}
