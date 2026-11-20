import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <div className={styles.stack}>
        <div className={styles.statCard}>
          <div className={styles.statRow}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={styles.stat}>
                <Skel w={110} h={12} />
                <Skel w={60} h={30} style={{ marginTop: 10 }} />
                <Skel w={150} h={10} style={{ marginTop: 10 }} />
              </div>
            ))}
          </div>
        </div>
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className={`${styles.card} ${styles.cardPad}`}>
            <Skel w={120} h={16} style={{ marginBottom: 18 }} />
            {Array.from({ length: 3 }, (_, j) => (
              <Skel key={j} h={14} style={{ marginBottom: 14 }} />
            ))}
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
