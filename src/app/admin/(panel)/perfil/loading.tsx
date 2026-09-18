import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <Skel w={56} h={56} circle />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skel w={80} h={28} r={14} />
            <Skel w={200} h={9} />
          </div>
        </div>
        <Skel w={60} h={9} style={{ marginBottom: 7 }} />
        <Skel h={36} r={9} style={{ marginBottom: 8 }} />
        <Skel w="75%" h={9} style={{ marginBottom: 18 }} />
        <Skel w={30} h={9} style={{ marginBottom: 7 }} />
        <Skel w="60%" h={11} style={{ marginBottom: 18 }} />
        <Skel w={80} h={32} r={9} />
      </div>
    </SkelPantalla>
  );
}
