import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w={140} h={36} r={18} style={{ marginBottom: 20 }} />
      <div className={styles.heroCards}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.hcard}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Skel w={44} h={44} r={12} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Skel w={140} h={14} />
                <Skel w={90} h={10} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Skel w={70} h={20} r={10} />
              <Skel w={90} h={20} r={10} />
            </div>
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
