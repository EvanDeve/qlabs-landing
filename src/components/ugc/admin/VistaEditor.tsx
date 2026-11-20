import Link from "next/link";
import { diaCorto } from "@/lib/ugc/calendar";
import { CONTENT_PLATFORM_LABEL } from "@/lib/ugc/content-meta";
import {
  armarFila,
  avanceDelDia,
  diasDeAdelanto,
  textoAdelanto,
  textoFilaVacia,
  type VideoEnFila,
} from "@/lib/ugc/edicion";
import type { DatosVistaEditor } from "@/lib/ugc/edicion-datos";
import styles from "@/styles/qos.module.css";

/**
 * El Dashboard del editor (spec 003). Server component: recibe todo armado de
 * getVistaEditor y solo pinta. Versión funcional con las clases de Q·OS; sin
 * mockups todavía (P-09).
 */
export function VistaEditor({ datos }: { datos: DatosVistaEditor }) {
  const { hoy, fila: videos, terminadosHoy, disponibles } = datos;
  const avance = avanceDelDia(terminadosHoy.length, hoy);
  const adelanto = diasDeAdelanto(videos, hoy);
  const textoDeAdelanto = textoAdelanto(adelanto);
  const fila = armarFila(videos, hoy);

  return (
    <div className={styles.stack}>
      <div className={styles.statCard}>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Hoy</div>
            <div className={styles.statNum}>{avance.texto}</div>
            <div className={styles.statSub} data-tone={avance.cumplida === null ? undefined : avance.cumplida ? "ok" : "warn"}>
              {avance.meta === null
                ? "Sábado y domingo no cuentan para la meta"
                : avance.cumplida
                  ? "Llegaste a la meta del día"
                  : `Te faltan ${avance.meta - avance.terminados} para la meta`}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>Adelanto</div>
            <div className={styles.statNum}>{textoDeAdelanto ?? "—"}</div>
            <div className={styles.statSub} data-tone={adelanto === null ? undefined : adelanto < 0 ? "risk" : adelanto === 0 ? "warn" : "ok"}>
              {textoDeAdelanto === null
                ? "Ningún video de tu fila tiene fecha"
                : adelanto < 0
                  ? "lo que lleva el más atrasado de tu fila"
                  : "hasta que se publique el próximo de tu fila"}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>En tu fila</div>
            <div className={styles.statNum}>{videos.length}</div>
            <div className={styles.statSub} data-tone={fila.atrasados.length > 0 ? "risk" : undefined}>
              {fila.atrasados.length > 0
                ? `${fila.atrasados.length} ${fila.atrasados.length === 1 ? "atrasado" : "atrasados"}`
                : videos.length === 1
                  ? "video por editar"
                  : "videos por editar"}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.dashGrid}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.sectionHead}>
            <h2>Tu fila</h2>
            {videos.length > 0 && (
              <div className={styles.sectionHeadAct}>
                <span className={styles.chip}>en orden de entrega</span>
              </div>
            )}
          </div>

          {videos.length === 0 ? (
            <div className={styles.empty}>{textoFilaVacia(disponibles)}</div>
          ) : (
            <>
              {/* RF-17: los atrasados van arriba y aparte, para que no se pierdan
                  entre el resto aunque ya salgan primeros por fecha. */}
              {fila.atrasados.length > 0 && (
                <div className={styles.filaAtrasados}>
                  <div className={styles.filaAtrasadosTitulo}>Atrasados</div>
                  {fila.atrasados.map((v) => (
                    <FilaVideo key={v.id} video={v} />
                  ))}
                </div>
              )}
              {fila.resto.map((v) => (
                <FilaVideo key={v.id} video={v} />
              ))}
            </>
          )}
        </div>

        <div className={`${styles.card} ${styles.cardPad}`}>
          <div className={styles.sectionHead}>
            <h2>Terminados hoy</h2>
            {terminadosHoy.length > 0 && (
              <div className={styles.sectionHeadAct}>
                <span className={styles.chip}>{terminadosHoy.length}</span>
              </div>
            )}
          </div>
          {terminadosHoy.length === 0 ? (
            <div className={styles.empty}>Todavía no terminaste ninguno hoy.</div>
          ) : (
            terminadosHoy.map((t) => (
              <Link key={t.id} href={`/admin/pipeline/${t.id}`} className={`${styles.weekRow} ${styles.filaVideo}`}>
                <span className={`${styles.riskPill} ${styles.riskOk}`}>Listo</span>
                <div className={styles.weekBody}>
                  {t.titulo}
                  <small>{[t.cliente, CONTENT_PLATFORM_LABEL[t.plataforma]].filter(Boolean).join(" · ")}</small>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function textoDePlazo(dias: number | null): string {
  if (dias === null) return "Sin fecha";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias > 0) return `En ${dias} días`;
  return dias === -1 ? "1 día de atraso" : `${-dias} días de atraso`;
}

/** RF-16: cliente, título, fecha, plataforma, grabado y días para publicarse. Abre la ficha. */
function FilaVideo({ video: v }: { video: VideoEnFila }) {
  const tono =
    v.diasParaPublicar === null
      ? styles.riskMuted
      : v.diasParaPublicar < 0
        ? styles.riskRisk
        : v.diasParaPublicar <= 1
          ? styles.riskWarn
          : styles.riskOk;
  return (
    <Link href={`/admin/pipeline/${v.id}`} className={`${styles.weekRow} ${styles.filaVideo}`}>
      <div className={styles.weekWhen}>{v.publishDate ? diaCorto(v.publishDate) : "—"}</div>
      <div className={styles.weekBody}>
        {v.titulo}
        <small>
          {[v.cliente, CONTENT_PLATFORM_LABEL[v.plataforma], v.grabado ? "Grabado" : "Sin grabar"]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </div>
      <span className={`${styles.riskPill} ${tono}`}>{textoDePlazo(v.diasParaPublicar)}</span>
    </Link>
  );
}
