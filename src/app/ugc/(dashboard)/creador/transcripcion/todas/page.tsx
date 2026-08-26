import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TranscripcionLista from "@/components/ugc/creador/TranscripcionLista";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/**
 * El historial completo.
 *
 * El tope de 200 no es paginación: es un freno. Una transcripción se genera de
 * a una y a mano, así que llegar a 200 pide meses de uso diario; si alguien
 * llega, la paginación se agrega ese día y no antes.
 */
export default async function TodasLasTranscripcionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("creator_transcriptions")
    .select("*")
    .eq("creator_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const filas = data ?? [];

  return (
    <div className={styles.trCol}>
      <div className={styles.trDetBar}>
        <Link href="/ugc/creador/transcripcion" className={styles.trAtras}>
          <QosIcon name="chevL" size={17} />
          Atrás
        </Link>
        <span className={styles.trDetTit}>Todas</span>
        {/* El hueco iguala al botón de la izquierda para que el título quede
            centrado de verdad: `justify-content: space-between` no centra al
            del medio cuando los costados miden distinto. */}
        <span style={{ width: 62 }} aria-hidden />
      </div>

      {filas.length > 0 ? (
        <TranscripcionLista filas={filas} />
      ) : (
        <div className={styles.trVacio}>
          <QosIcon name="doc" size={26} className={styles.trVacioIc} />
          <p className={styles.trVacioTxt}>Todavía no hay ninguna transcripción.</p>
        </div>
      )}
    </div>
  );
}
