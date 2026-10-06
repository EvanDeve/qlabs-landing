import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

/* Una tarjeta de cuatro stats y la tabla por negocio. */
export default function Loading() {
  return (
    <SkelPantalla>
      {Array.from({ length: 1 }, (_, fila) => (
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
      <div className={styles.card} style={{ padding: 18 }}>
        <Skel w={150} h={13} style={{ marginBottom: 22 }} />
        <SkelLineas n={6} />
      </div>
    </SkelPantalla>
  );
}
