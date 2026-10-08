import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w="45%" h={12} style={{ marginBottom: 18 }} />
      <div className={`${styles.statCard} ${styles.statCardGrupo}`} style={{ paddingTop: 8, marginBottom: 14 }}>
        <div className={styles.statRow}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.stat}>
              <Skel w="60%" h={11} style={{ marginBottom: 10 }} />
              <Skel w={36} h={24} />
              <Skel w="50%" h={9} style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      </div>
      <div className={`${styles.resGrid} ${styles.cfGrid}`}>
        {[3, 5].map((n, i) => (
          <div key={i} className={`${styles.card} ${styles.cardPad}`}>
            <Skel w={120} h={13} style={{ marginBottom: 18 }} />
            <SkelLineas n={n} />
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
