import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla className={styles.workspace}>
      <section className={`${styles.wsPanel} ${styles.wsPanelSide}`}>
        <div className={styles.wsHead}>
          <Skel w={60} h={12} />
        </div>
        <div className={`${styles.wsBody} ${styles.wsBodyPad}`}>
          <Skel w={80} h={9} style={{ marginBottom: 7 }} />
          <Skel h={36} r={9} style={{ marginBottom: 10 }} />
          <Skel h={36} r={9} style={{ marginBottom: 24 }} />
          <Skel h={36} r={9} style={{ marginBottom: 18 }} />
          <SkelLineas n={4} h={9} gap={7} />
        </div>
      </section>
      <section className={`${styles.wsPanel} ${styles.wsPanelMain}`}>
        <div className={styles.wsHead}>
          <Skel w={100} h={12} />
          <Skel w={70} h={9} />
        </div>
        <div className={styles.wsEmpty}>
          <Skel w={28} h={34} r={6} />
          <Skel w={220} h={10} />
        </div>
      </section>
      <section className={`${styles.wsPanel} ${styles.wsPanelScript}`}>
        <div className={styles.wsHead}>
          <Skel w={110} h={12} />
        </div>
        <div className={styles.wsEmpty}>
          <Skel w={28} h={34} r={6} />
          <Skel w={260} h={10} />
        </div>
      </section>
    </SkelPantalla>
  );
}
