import { desglosePago } from "@/lib/ugc/payout";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

/**
 * Presupuesto → comisión → neto, con las mismas tres cifras para la marca y
 * para el creador.
 *
 * Es el mismo componente en las dos pantallas a propósito: si cada lado
 * armara su propio desglose, alcanzaría con que uno cambiara de redondeo para
 * que marca y creador vuelvan a ver números distintos, que es exactamente el
 * problema que esto viene a cerrar.
 */
export default function DesglosePago({
  budgetAmount,
  audiencia,
}: {
  budgetAmount: number;
  /** Cambia solo el rótulo de la última fila; los números son idénticos. */
  audiencia: "marca" | "creador";
}) {
  const { bruto, comision, neto, porcentaje } = desglosePago(budgetAmount);

  return (
    <div className={styles.desglose}>
      <div className={styles.desgloseFila}>
        <span>Presupuesto de la campaña</span>
        <span>₡{bruto.toLocaleString("es-CR")}</span>
      </div>
      <div className={styles.desgloseFila}>
        <span>Comisión de Q Labs ({porcentaje}%)</span>
        <span>− ₡{comision.toLocaleString("es-CR")}</span>
      </div>
      <div className={`${styles.desgloseFila} ${styles.desgloseTotal}`}>
        <span>{audiencia === "creador" ? "Recibís vos" : "Recibe el creador"}</span>
        <span>₡{neto.toLocaleString("es-CR")}</span>
      </div>
    </div>
  );
}
