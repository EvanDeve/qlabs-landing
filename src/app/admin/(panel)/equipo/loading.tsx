import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 20 }}>
        <Skel w={120} h={13} style={{ marginBottom: 18 }} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
            <Skel w={26} h={26} r={8} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <Skel w={110} h={12} />
              <Skel w={60} h={9} />
            </div>
            <Skel w={86} h={28} r={14} style={{ marginLeft: "auto" }} />
            <Skel w={62} h={28} r={14} />
          </div>
        ))}
      </div>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 20 }}>
        <Skel w={150} h={13} style={{ marginBottom: 12 }} />
        <Skel w="92%" h={10} style={{ marginBottom: 7 }} />
        <Skel w="80%" h={10} style={{ marginBottom: 22 }} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <Skel w={90} h={30} />
          <Skel h={36} r={9} style={{ flex: 1 }} />
          <Skel w={72} h={36} r={9} />
          <Skel w={80} h={36} r={9} />
        </div>
      </div>
      <div className={`${styles.card} ${styles.cardPad}`}>
        <Skel w={140} h={13} style={{ marginBottom: 12 }} />
        <Skel w="60%" h={10} style={{ marginBottom: 22 }} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <Skel h={36} r={9} />
          <Skel h={36} r={9} />
          <Skel h={36} r={9} />
          <Skel w={44} h={36} r={9} />
          <Skel w={70} h={36} r={18} />
        </div>
      </div>
    </SkelPantalla>
  );
}
