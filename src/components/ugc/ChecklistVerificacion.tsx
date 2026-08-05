import Link from "next/link";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export type PasoVerificacion = { texto: string; hecho: boolean; href?: string };

/**
 * "Qué falta para verificarte", con lo que ya está marcado.
 *
 * El aviso de "en revisión" ya decía qué acelera la verificación, pero en
 * prosa: había que leer un párrafo para deducir la tarea. En lista con checks
 * se ve de un vistazo lo que falta, y lo hecho da la sensación de avance que
 * un muro de espera no da.
 *
 * NO promete plazos. El "normalmente aprobamos en menos de 24 h" que pedía la
 * auditoría queda afuera a propósito hasta que el equipo acuerde quién
 * verifica y en cuánto: publicar un plazo que nadie sostiene es peor que no
 * publicarlo.
 */
export default function ChecklistVerificacion({ pasos }: { pasos: PasoVerificacion[] }) {
  const hechos = pasos.filter((p) => p.hecho).length;

  return (
    <div className={styles.checklist}>
      <div className={styles.checklistHead}>
        Mientras tanto, adelantá esto
        <span className={styles.checklistCount}>
          {hechos}/{pasos.length}
        </span>
      </div>
      <ul className={styles.checklistLista}>
        {pasos.map((paso) => {
          const contenido = (
            <>
              <span className={paso.hecho ? styles.checkOk : styles.checkPend} aria-hidden>
                {paso.hecho && <QosIcon name="check" size={11} />}
              </span>
              <span className={paso.hecho ? styles.checklistHecho : undefined}>{paso.texto}</span>
            </>
          );

          return (
            <li key={paso.texto} className={styles.checklistItem}>
              {/* Lo pendiente lleva al lugar donde se resuelve; lo hecho no es
                  link — mandar a "arreglar" algo que ya está listo confunde. */}
              {paso.href && !paso.hecho ? (
                <Link href={paso.href} className={styles.checklistLink}>
                  {contenido}
                  <QosIcon name="chevR" size={12} />
                </Link>
              ) : (
                contenido
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
