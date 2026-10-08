import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w="50%" h={12} style={{ marginBottom: 18 }} />
      <div className={styles.statCard}>
        <div className={styles.statRow}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.stat}>
              <Skel w="60%" h={11} style={{ marginBottom: 12 }} />
              <Skel w={44} h={28} />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.barraAdmin}>
        <Skel w={200} h={34} r={11} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skel w={220} h={35} r={9} />
          <Skel w={150} h={35} r={9} />
        </div>
      </div>
      <div className={styles.loyGrid}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <SkelLineas n={6} />
        </div>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <Skel w={160} h={14} style={{ marginBottom: 18 }} />
          <SkelLineas n={5} />
        </div>
      </div>
    </SkelPantalla>
  );
}
