import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla className={styles.workspace}>
      <section className={`${styles.wsPanel} ${styles.wsPanelSide} ${styles.chatList}`}>
        <div className={styles.wsHead}>
          <Skel w={110} h={12} />
          <Skel w={12} h={12} r={6} />
        </div>
        <div style={{ padding: "10px 12px" }}>
          <Skel h={32} r={16} style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <Skel w={60} h={24} r={12} />
            <Skel w={60} h={24} r={12} />
            <Skel w={70} h={24} r={12} />
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 4px" }}>
              <Skel w={34} h={34} circle />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                <Skel w="55%" h={11} />
                <Skel w="85%" h={9} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className={`${styles.wsPanel} ${styles.wsPanelMain}`}>
        <div className={styles.wsEmpty}>
          <Skel w={22} h={22} circle />
          <Skel w={200} h={10} />
        </div>
      </section>
    </SkelPantalla>
  );
}
