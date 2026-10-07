import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      {/* Pestañas y buscador */}
      <Skel w={420} h={34} r={999} style={{ marginBottom: 16, maxWidth: "100%" }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Skel w={260} h={35} r={9} />
        <Skel w={150} h={35} r={9} />
        <Skel w={70} h={30} r={9} />
      </div>
      <div className={`${styles.card} ${styles.cardPad}`}>
        <Skel w={130} h={13} style={{ marginBottom: 18 }} />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <Skel w={170} h={12} />
              <Skel w={120} h={9} />
            </div>
            <Skel w={76} h={28} r={9} style={{ marginLeft: "auto" }} />
            <Skel w={90} h={28} r={9} />
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
