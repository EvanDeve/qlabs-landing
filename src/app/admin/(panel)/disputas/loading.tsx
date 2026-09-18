import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w={120} h={24} style={{ marginBottom: 10 }} />
      <Skel w="55%" h={11} style={{ marginBottom: 22 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className={`${styles.card} ${styles.cardPad}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skel w={220} h={15} />
                <Skel w={160} h={10} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <Skel w={130} h={10} />
                <Skel w={110} h={10} />
              </div>
            </div>
            <SkelLineas n={2} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Skel w={120} h={32} r={9} />
              <Skel w={120} h={32} r={9} />
            </div>
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
