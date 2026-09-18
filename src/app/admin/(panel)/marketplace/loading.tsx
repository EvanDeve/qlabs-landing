import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      {[4, 3].map((filas, c) => (
        <div key={c} className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 20 }}>
          <Skel w={130} h={13} style={{ marginBottom: 18 }} />
          {Array.from({ length: filas }, (_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
              {c === 1 && <Skel w={32} h={32} r={9} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <Skel w={170} h={12} />
                <Skel w={120} h={9} />
              </div>
              <Skel w={76} h={28} r={9} style={{ marginLeft: "auto" }} />
              <Skel w={90} h={28} r={9} />
            </div>
          ))}
        </div>
      ))}
    </SkelPantalla>
  );
}
