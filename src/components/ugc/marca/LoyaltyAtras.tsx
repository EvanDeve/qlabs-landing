import Link from "next/link";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

/**
 * La barra de arriba de las pantallas colgadas de Loyalty: "‹ Loyalty" y, si
 * hace falta, un título chico al medio. Es la misma `.mcFormBar` del
 * formulario de campaña, con la flecha en vez de "Cancelar": acá se vuelve, no
 * se abandona nada.
 */
export default function LoyaltyAtras({ titulo }: { titulo?: string }) {
  return (
    <div className={styles.mcFormBar}>
      <Link href="/ugc/marca/loyalty" className={styles.mcCancelar}>
        <QosIcon name="chevL" size={18} />
        Loyalty
      </Link>
      {titulo ? <span className={styles.mcFormTitulo}>{titulo}</span> : <span />}
    </div>
  );
}
