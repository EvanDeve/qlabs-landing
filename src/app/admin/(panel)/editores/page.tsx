import { requireDirector } from "@/lib/auth/require-director";
import { nombreDeMes } from "@/lib/ugc/cronograma";
import { diaCorto } from "@/lib/ugc/calendar";
import { textoAdelanto } from "@/lib/ugc/edicion";
import { getPanelEditores } from "@/lib/ugc/edicion-datos";
import { resumenDelPanel, textoInicioMedicion, type PeriodoDelPanel } from "@/lib/ugc/panel-editores";
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
  // Los días son los mismos para todos los editores: el encabezado sale del primero.
  const diasHistorial = filas[0]?.historial.map((h) => h.dia) ?? [];

  return (
    <div className={styles.stack}>
      {/* RF-32: lo de antes de la primera mañana con reparto no cuenta, y se dice. */}
      <p className={styles.formNote}>{textoInicioMedicion(datos.inicioMedicion)}</p>

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

      {filas.length > 0 && (
        <>
          {/* RF-26: los últimos 10 días hábiles, el más nuevo a la izquierda. */}
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2>Últimos días hábiles</h2>
            </div>
            {diasHistorial.length === 0 ? (
              <div className={styles.empty}>El historial arranca con el primer reparto.</div>
            ) : (
              <div className={styles.panelEditoresTabla}>
                <table className={styles.acctTable}>
                  <thead>
                    <tr>
                      <th>Editor</th>
                      {diasHistorial.map((d) => (
                        <th key={d}>{diaCorto(d)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.profileId}>
                        <td>{f.nombre}</td>
                        {f.historial.map((h) => (
                          <td key={h.dia}>
                            <span
                              className={`${styles.riskPill} ${h.llego ? styles.riskOk : styles.riskMuted}`}
                              title={h.llego ? "Llegó a 8" : "No llegó a 8"}
                            >
                              {h.terminados}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RF-27, RF-28: la meta del período en curso cuenta solo los hábiles hasta hoy. */}
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2>Cumplimiento</h2>
            </div>
            <div className={styles.panelEditoresTabla}>
              <table className={styles.acctTable}>
                <thead>
                  <tr>
                    <th>Editor</th>
                    <th>Esta semana</th>
                    <th>Semana pasada</th>
                    <th>Este mes</th>
                    <th>Mes pasado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.profileId}>
                      <td>{f.nombre}</td>
                      {[...f.semanas, ...f.meses].map((p) => (
                        <td key={p.desde}>
                          <Periodo periodo={p} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** "12 de 24 · 50%"; sin días medidos todavía, una raya: no se inventa un porcentaje. */
function Periodo({ periodo: p }: { periodo: PeriodoDelPanel }) {
  if (p.porcentaje === null) return <span className={`${styles.riskPill} ${styles.riskMuted}`}>—</span>;
  const tono = p.porcentaje >= 100 ? styles.riskOk : p.porcentaje >= 75 ? styles.riskWarn : styles.riskRisk;
  return (
    <>
      {p.total} de {p.meta} <span className={`${styles.riskPill} ${tono}`}>{p.porcentaje}%</span>
    </>
  );
}
