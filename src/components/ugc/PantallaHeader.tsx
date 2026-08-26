import type { ReactNode } from "react";
import CampanaDePantalla from "@/components/ugc/CampanaDePantalla";
import styles from "@/styles/qos.module.css";

/**
 * El encabezado de una pantalla del panel, en tres piezas:
 *
 *   ┌ contenedor ─────────────────────────────────────────┐
 *   │ ┌ fila ─────────────────────────────────────────┐   │
 *   │ │ Título              [acción] [campana]        │   │
 *   │ └───────────────────────────────────────────────┘   │
 *   │ Descripción, a lo ancho del teléfono                 │
 *   └─────────────────────────────────────────────────────┘
 *
 * La campana va DENTRO de la fila, junto al botón de la pantalla. Antes flotaba
 * en la esquina y cada encabezado le reservaba 52px de padding a la derecha —
 * pero ese padding se lo comía el bloque entero, así que la descripción también
 * quedaba cortada a 52px del borde aunque nada la tapara. Con la fila aparte,
 * la descripción usa el ancho completo y la campana la centra el flexbox.
 */
export default function PantallaHeader({
  titulo,
  rotulo,
  descripcion,
  accion,
}: {
  /** Texto del título, o el bloque entero cuando la pantalla no abre con uno. */
  titulo: ReactNode;
  /** La línea chica de arriba del título (hoy, el nombre del negocio). */
  rotulo?: ReactNode;
  descripcion?: ReactNode;
  /** El botón propio de la pantalla: Subir, Nueva tarea, Nueva campaña. */
  accion?: ReactNode;
}) {
  return (
    <header className={styles.pantallaHead}>
      <div className={styles.pantallaFila}>
        <div className={styles.pantallaTit}>
          {rotulo && <div className={styles.pantallaRotulo}>{rotulo}</div>}
          {typeof titulo === "string" ? <h1 className={styles.pantallaTitulo}>{titulo}</h1> : titulo}
        </div>
        <div className={styles.pantallaActs}>
          {accion}
          <CampanaDePantalla />
        </div>
      </div>
      {descripcion && <p className={styles.pantallaDesc}>{descripcion}</p>}
    </header>
  );
}
