import { requireDirector } from "@/lib/auth/require-director";
import { nombreDeMes } from "@/lib/ugc/cronograma";
import { textoAdelanto } from "@/lib/ugc/edicion";
import { getPanelEditores } from "@/lib/ugc/edicion-datos";
import { resumenDelPanel } from "@/lib/ugc/panel-editores";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * Panel de editores (spec 003). Solo directores: requireDirector rebota al
 * resto, y la RLS de staff_members y de repartos_de_edicion es la que de
 * verdad cierra los datos. Versión funcional sin mockups (P-09).
 */
export default async function EditoresPage() {
  const { supabase } = await requireDirector();
  const datos = await getPanelEditores(supabase);
  const filas = resumenDelPanel(datos);

  return (
    <div className={styles.stack}>
      {/* RF-30: lo de todo el equipo, antes que lo de cada uno. */}
      <div className={styles.statCard}>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Sin repartir</div>
            <div className={styles.statNum}>{datos.disponibles}</div>
            <div className={styles.statSub}>en Por editar sin responsable</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Atrasados sin repartir</div>
            <div className={styles.statNum}>{datos.atrasadosDisponibles}</div>
            <div className={styles.statSub} data-tone={datos.atrasadosDisponibles > 0 ? "risk" : "ok"}>
              {datos.atrasadosDisponibles > 0 ? "ya pasó su fecha de publicación" : "ninguno pasó su fecha"}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Esperando aprobación</div>
            <div className={styles.statNum}>{datos.esperandoAprobacion.reduce((t, e) => t + e.videos, 0)}</div>
            <div className={styles.statSub}>
              {datos.esperandoAprobacion.length === 0
                ? "no hay cronogramas sin aprobar"
                : datos.esperandoAprobacion.map((e) => `${nombreDeMes(e.mes)}: ${e.videos}`).join(" · ")}
            </div>
          </div>
        </div>
      </div>

      {/* RF-25, RF-31: todos los editores activos, también los que van en cero. */}
      <div className={`${styles.card} ${styles.cardPad}`}>
        <div className={styles.sectionHead}>
          <h2>Hoy</h2>
        </div>
        {filas.length === 0 ? (
          <div className={styles.empty}>No hay editores activos. Se agregan desde Equipo, con el rol Editor.</div>
        ) : (
          <div className={styles.panelEditoresTabla}>
            <table className={styles.acctTable}>
              <thead>
                <tr>
                  <th>Editor</th>
                  <th>Terminados hoy</th>
                  <th>En su fila</th>
                  <th>Atrasados</th>
                  <th>Adelanto</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.profileId}>
                    <td>{f.nombre}</td>
                    <td className={styles.paceCell}>
                      {f.hoy.meta === null ? f.hoy.terminados : `${f.hoy.terminados} de ${f.hoy.meta}`}
                    </td>
                    <td>{f.pendientes}</td>
                    <td>
                      {f.atrasados > 0 ? (
                        <span className={`${styles.riskPill} ${styles.riskRisk}`}>{f.atrasados}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td>{textoAdelanto(f.diasDeAdelanto) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
