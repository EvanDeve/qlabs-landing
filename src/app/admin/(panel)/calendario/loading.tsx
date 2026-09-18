import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla className={styles.calWide}>
      <div className={styles.calHead}>
        <Skel w={160} h={20} />
        <Skel w={32} h={30} r={8} />
        <Skel w={44} h={30} r={8} />
        <Skel w={32} h={30} r={8} />
        <Skel w={150} h={30} r={15} style={{ marginLeft: 8 }} />
        <Skel w={100} h={30} r={15} />
        <Skel w={120} h={30} r={15} />
        <Skel w={130} h={34} r={17} style={{ marginLeft: "auto" }} />
      </div>
      <div className={styles.calLayout}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          }}
        >
          {Array.from({ length: 7 }, (_, i) => (
            <div key={`h${i}`} style={{ padding: "10px 0", display: "grid", placeItems: "center", background: "var(--surface-3)" }}>
              <Skel w={26} h={8} />
            </div>
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} style={{ height: 106, padding: 8, borderTop: "1px solid var(--line-2)", borderLeft: i % 7 ? "1px solid var(--line-2)" : "none" }}>
              <Skel w={16} h={10} style={{ marginLeft: "auto" }} />
            </div>
          ))}
        </div>
        <aside className={styles.calRail}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <Skel w={50} h={8} style={{ marginBottom: 12 }} />
            <Skel w={120} h={18} style={{ marginBottom: 12 }} />
            <Skel w={100} h={22} r={11} style={{ marginBottom: 14 }} />
            <Skel w="70%" h={11} />
          </div>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <Skel w={90} h={8} style={{ marginBottom: 14 }} />
            <Skel h={70} r={8} style={{ marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 24 }}>
              <Skel w={40} h={22} />
              <Skel w={40} h={22} />
              <Skel w={40} h={22} />
            </div>
          </div>
        </aside>
      </div>
    </SkelPantalla>
  );
}
