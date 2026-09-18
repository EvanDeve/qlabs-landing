import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w={90} h={30} r={15} style={{ marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <Skel w="55%" h={20} style={{ marginBottom: 20 }} />
          {[36, 36, 120, 36].map((h, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <Skel w={80} h={9} style={{ marginBottom: 7 }} />
              <Skel h={h} r={9} />
            </div>
          ))}
        </div>
        <div className={`${styles.card} ${styles.cardPad}`}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <Skel w={70} h={9} style={{ marginBottom: 7 }} />
              <Skel h={36} r={9} />
            </div>
          ))}
        </div>
      </div>
    </SkelPantalla>
  );
}
