import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w={160} h={26} style={{ marginBottom: 10 }} />
      <Skel w="60%" h={11} style={{ marginBottom: 24 }} />
      <div className={styles.kpiRow} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={styles.kpi}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Skel w={28} h={28} r={8} />
              <Skel w={110} h={11} />
            </div>
            <Skel w={36} h={30} style={{ marginTop: 14 }} />
          </div>
        ))}
      </div>
      <Skel w={180} h={16} style={{ marginTop: 30, marginBottom: 14 }} />
      <div className={`${styles.card} ${styles.cardPad}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Skel w="26%" h={11} />
              <Skel w={64} h={20} r={10} />
              <Skel w={40} h={11} style={{ marginLeft: "auto" }} />
              <Skel w={30} h={11} />
              <Skel w={30} h={11} />
              <Skel w="18%" h={11} />
            </div>
          ))}
        </div>
      </div>
    </SkelPantalla>
  );
}
