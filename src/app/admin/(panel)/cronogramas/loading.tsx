import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <div className={styles.sectionHead}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skel w={380} h={11} />
          <Skel w={180} h={11} />
        </div>
        <Skel w={150} h={36} r={18} style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${styles.card} ${styles.cardPad}`} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Skel w={38} h={38} r={10} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skel w={160} h={13} />
              <Skel w={110} h={10} />
            </div>
            <Skel w={90} h={22} r={11} style={{ marginLeft: "auto" }} />
            <Skel w={60} h={11} />
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
