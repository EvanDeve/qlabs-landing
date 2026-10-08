import styles from "@/styles/qos.module.css";
import { Skel, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <Skel w={380} h={12} style={{ marginBottom: 18, maxWidth: "100%" }} />
      <div className={styles.barraAdmin}>
        <Skel w={420} h={34} r={11} style={{ maxWidth: "100%" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skel w={240} h={35} r={9} />
          <Skel w={150} h={35} r={9} />
        </div>
      </div>
      <div className={styles.card} style={{ padding: "6px 16px" }}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
            <Skel w={30} h={30} r={15} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <Skel w={140} h={12} />
              <Skel w={90} h={9} />
            </div>
            <Skel w={80} h={11} />
            <Skel w={70} h={20} r={10} />
            <Skel w={60} h={11} />
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
