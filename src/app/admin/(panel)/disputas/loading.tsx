import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w="40%" h={12} style={{ marginBottom: 18 }} />
      <div className={styles.barraAdmin}>
        <Skel w={200} h={34} r={11} />
        <Skel w={220} h={35} r={9} />
      </div>
      <div className={styles.dispGrid}>
        <div className={styles.dispLista}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={`${styles.card} ${styles.dispItem}`}>
              <Skel w={90} h={18} r={9} style={{ marginBottom: 10 }} />
              <Skel w="80%" h={12} style={{ marginBottom: 6 }} />
              <Skel w="60%" h={9} />
            </div>
          ))}
        </div>
        <div className={`${styles.card} ${styles.dispDetalle}`}>
          <Skel w={260} h={18} style={{ marginBottom: 10 }} />
          <Skel w="45%" h={10} style={{ marginBottom: 20 }} />
          <SkelLineas n={5} />
        </div>
      </div>
    </SkelPantalla>
  );
}
