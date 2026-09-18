import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla className={styles.workspace}>
      <section className={`${styles.wsPanel} ${styles.wsPanelSide}`}>
        <div className={styles.wsHead}>
          <Skel w={80} h={12} />
        </div>
        <div className={`${styles.wsBody} ${styles.wsBodyPad}`}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <SkelLineas n={2} h={10} gap={7} />
              <Skel w={90} h={8} style={{ marginTop: 7 }} />
            </div>
          ))}
        </div>
      </section>
      <section className={`${styles.wsPanel} ${styles.wsPanelMain}`}>
        <div className={styles.wsHead}>
          <Skel w={50} h={12} />
          <Skel w={50} h={9} />
        </div>
        <div className={`${styles.wsBody} ${styles.wsBodyPad}`}>
          <SkelLineas n={3} h={11} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: 16, borderTop: "1px solid var(--line)" }}>
          <Skel w={150} h={32} r={9} />
          <Skel w={32} h={32} r={9} />
          <Skel w={32} h={32} r={9} />
          <Skel w={130} h={32} r={9} style={{ marginLeft: 8 }} />
          <Skel w={100} h={32} r={9} style={{ marginLeft: "auto" }} />
        </div>
      </section>
      <section className={`${styles.wsPanel} ${styles.wsPanelScript}`}>
        <div className={styles.wsHead}>
          <Skel w={40} h={12} />
          <Skel w={60} h={9} />
        </div>
        <div className={styles.wsEmpty}>
          <Skel w={22} h={22} circle />
          <Skel w={240} h={10} />
        </div>
      </section>
    </SkelPantalla>
  );
}
