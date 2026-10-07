import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w="60%" h={11} style={{ marginBottom: 24 }} />
      <div className={styles.kpiRow}>
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
      <div style={{ marginTop: 26 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Skel w={240} h={34} r={999} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Skel w={260} h={35} r={9} />
        <Skel w={70} h={30} r={9} />
      </div>
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
