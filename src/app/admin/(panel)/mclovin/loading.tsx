import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

export default function Loading() {
  return (
    <SkelPantalla>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 20 }}>
        <Skel w={110} h={13} style={{ marginBottom: 10 }} />
        <Skel w="80%" h={10} style={{ marginBottom: 22 }} />
        <Skel w={90} h={9} style={{ marginBottom: 7 }} />
        <Skel w={260} h={36} r={9} style={{ marginBottom: 8 }} />
        <Skel w={160} h={9} style={{ marginBottom: 30 }} />
        {[220, 110].map((h, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <Skel w={130} h={9} style={{ marginBottom: 7 }} />
            <Skel h={h} r={9} />
          </div>
        ))}
        <Skel w={96} h={34} r={9} />
      </div>
      <div className={`${styles.card} ${styles.cardPad}`} style={{ marginBottom: 20 }}>
        <Skel w={150} h={13} style={{ marginBottom: 10 }} />
        <Skel w="70%" h={10} style={{ marginBottom: 18 }} />
        <Skel h={160} r={9} />
      </div>
      <div className={`${styles.card} ${styles.cardPad}`}>
        <Skel w={140} h={13} style={{ marginBottom: 10 }} />
        <Skel w="60%" h={10} style={{ marginBottom: 18 }} />
        <SkelLineas n={3} />
      </div>
    </SkelPantalla>
  );
}
