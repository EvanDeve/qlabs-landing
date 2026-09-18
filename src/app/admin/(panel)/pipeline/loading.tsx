import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

const ANCHOS_TAB = [64, 100, 34, 58, 48];

export default function Loading() {
  return (
    <SkelPantalla className={styles.pipeWide}>
      <div className={styles.kbRoot}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {ANCHOS_TAB.map((w, i) => (
            <Skel key={i} w={w} h={28} r={14} />
          ))}
          <Skel w={280} h={30} r={15} style={{ marginLeft: 8 }} />
          <Skel w={116} h={32} r={16} style={{ marginLeft: "auto" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Skel w={44} h={10} />
          {[100, 130, 110, 130].map((w, i) => (
            <Skel key={i} w={w} h={28} r={14} />
          ))}
        </div>
        <div className={styles.kanban}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={styles.kcol}>
              <div className={styles.kcolHead}>
                <Skel w={8} h={8} circle />
                <Skel w={78} h={11} style={{ marginLeft: 8 }} />
                <Skel w={18} h={14} r={7} style={{ marginLeft: 8 }} />
              </div>
              <div style={{ padding: "0 10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                {Array.from({ length: i % 2 ? 1 : 2 }, (_, j) => (
                  <Skel key={j} h={84} r={11} style={{ background: "var(--surface)" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkelPantalla>
  );
}
