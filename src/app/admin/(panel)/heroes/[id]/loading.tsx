import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w={90} h={30} r={15} style={{ marginBottom: 14 }} />
      {/* El encabezado del expediente es el degradado de marca: la silueta
          conserva el bloque para que el alto no cambie al llegar. */}
      <div className={styles.dossierHd} style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Skel w={64} h={64} r={16} style={{ background: "rgba(255,255,255,0.18)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skel w={120} h={9} style={{ background: "rgba(255,255,255,0.18)" }} />
          <Skel w={220} h={22} style={{ background: "rgba(255,255,255,0.18)" }} />
          <Skel w={160} h={10} style={{ background: "rgba(255,255,255,0.18)" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <Skel w={120} h={13} style={{ marginBottom: 18 }} />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <Skel w={70} h={9} style={{ marginBottom: 7 }} />
              <Skel h={36} r={9} />
            </div>
          ))}
        </div>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <Skel w={100} h={13} style={{ marginBottom: 18 }} />
          <SkelLineas n={5} />
        </div>
      </div>
    </SkelPantalla>
  );
}
