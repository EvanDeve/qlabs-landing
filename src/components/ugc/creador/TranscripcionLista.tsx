import Link from "next/link";
import type { Database } from "@/lib/database.types";
import {
  duracionLegible,
  fuenteLegible,
  nombreDeTranscripcion,
} from "@/lib/ugc/transcription";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export type FilaTranscripcion = Database["public"]["Tables"]["creator_transcriptions"]["Row"];

/**
 * La lista de transcripciones. La comparten la pantalla de inicio —donde
 * muestra las últimas— y "Ver todas", que es la misma lista sin recortar.
 *
 * Es un componente de servidor: la fila entera es un `<Link>` y no hay nada
 * que manejar del lado del cliente. Borrar y renombrar viven en el menú del
 * detalle, no acá: el mockup muestra la fila con un chevrón y nada más, y los
 * botoncitos por fila ya habían dado problemas en el book —el dedo los tocaba
 * al hacer scroll.
 */
export default function TranscripcionLista({ filas }: { filas: FilaTranscripcion[] }) {
  return (
    <div className={styles.trLista}>
      {filas.map((t) => {
        const fallo = t.status === "error";
        const enCurso = t.status === "processing" || t.status === "pending";
        const duracion = duracionLegible(t.duration_seconds);

        // La fecha corta alcanza: la lista está ordenada por fecha y el año
        // solo agregaría ruido en el 99% de las filas.
        const fecha = new Date(t.created_at).toLocaleDateString("es-CR", {
          day: "numeric",
          month: "short",
        });

        const meta = [
          fuenteLegible(t.source_type),
          fecha,
          duracion,
          // El estado se dice solo cuando NO es el normal: una fila que salió
          // bien no necesita decir "listo".
          fallo ? "falló" : enCurso ? "en proceso" : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <Link key={t.id} href={`/ugc/creador/transcripcion/${t.id}`} className={styles.trFila}>
            <span className={`${styles.trFilaIc} ${fallo ? styles.trFilaIcMal : ""}`}>
              <QosIcon
                name={fallo ? "alert" : t.file_name ? "film" : "link"}
                size={19}
              />
            </span>
            <span className={styles.trFilaTxt}>
              <span className={styles.trFilaTit}>{nombreDeTranscripcion(t)}</span>
              <span className={styles.trFilaMeta}>{meta}</span>
            </span>
            <QosIcon name="chevR" size={17} className={styles.trFilaChev} />
          </Link>
        );
      })}
    </div>
  );
}
