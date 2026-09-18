import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <div className={styles.sectionHead} style={{ alignItems: "center" }}>
        <Skel w={38} h={38} r={10} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skel w={220} h={16} />
          <Skel w={140} h={10} />
        </div>
        <Skel w={120} h={34} r={17} style={{ marginLeft: "auto" }} />
        <Skel w={140} h={34} r={17} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${styles.card} ${styles.cardPad}`} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Skel w={22} h={11} />
            <Skel w={46} h={11} />
            <Skel w="32%" h={12} />
            <Skel w={70} h={20} r={10} style={{ marginLeft: "auto" }} />
            <Skel w={26} h={26} r={8} />
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
