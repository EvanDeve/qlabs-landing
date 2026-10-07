import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w={90} h={12} style={{ marginBottom: 16 }} />
      <Skel w="100%" h={150} r={20} style={{ marginBottom: 16 }} />
      {[3, 5, 4].map((filas, c) => (
        <div key={c} className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 16 }}>
          <Skel w={130} h={13} style={{ marginBottom: 18 }} />
          {Array.from({ length: filas }, (_, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0" }}>
              <Skel w="40%" h={11} />
              <Skel w="30%" h={11} style={{ marginLeft: "auto" }} />
            </div>
          ))}
        </div>
      ))}
    </SkelPantalla>
  );
}
