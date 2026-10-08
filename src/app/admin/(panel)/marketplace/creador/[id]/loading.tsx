import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w={220} h={12} style={{ marginBottom: 14 }} />
      <div className={`${styles.card} ${styles.fichaHead}`} style={{ marginBottom: 14 }}>
        <Skel w={52} h={52} r={26} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <Skel w={200} h={20} />
          <Skel w="55%" h={10} />
        </div>
      </div>
      <div className={styles.statCard} style={{ marginBottom: 14 }}>
        <div className={styles.statRow}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.stat}>
              <Skel w="60%" h={11} style={{ marginBottom: 10 }} />
              <Skel w={50} h={26} />
            </div>
          ))}
        </div>
      </div>
      <Skel w={380} h={34} r={11} style={{ marginBottom: 14, maxWidth: "100%" }} />
      <div className={styles.fichaGrid2}>
        {[5, 5].map((n, i) => (
          <div key={i} className={`${styles.card} ${styles.cardPad}`}>
            <Skel w={130} h={13} style={{ marginBottom: 18 }} />
            <SkelLineas n={n} />
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
