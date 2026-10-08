import styles from "@/styles/qos.module.css";
import { Skel, SkelLineas, SkelPantalla } from "@/components/ugc/Skeleton";

/* La misma silueta que el Resumen: dos tarjetas de cuatro stats lado a lado,
   y abajo "Te esperan" y Close Friends por negocio. */
export default function Loading() {
  return (
    <SkelPantalla>
      <div className={styles.resGrid} style={{ marginBottom: 14 }}>
        {Array.from({ length: 2 }, (_, g) => (
          <div key={g} className={`${styles.statCard} ${styles.statCardGrupo}`}>
            <Skel w={80} h={11} style={{ margin: "0 18px 10px" }} />
            <div className={styles.statRow}>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={styles.stat}>
                  <Skel w="70%" h={11} style={{ marginBottom: 10 }} />
                  <Skel w={30} h={24} />
                  <Skel w="60%" h={9} style={{ marginTop: 10 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={`${styles.resGrid} ${styles.resGridAncha}`}>
        {[5, 3].map((n, i) => (
          <div key={i} className={`${styles.card} ${styles.cardPad}`}>
            <Skel w={150} h={13} style={{ marginBottom: 22 }} />
            <SkelLineas n={n} />
          </div>
        ))}
      </div>
    </SkelPantalla>
  );
}
