import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TranscripcionForm from "@/components/ugc/creador/TranscripcionForm";
import TranscripcionLista from "@/components/ugc/creador/TranscripcionLista";
import { QosIcon } from "@/lib/ugc/qos-icons";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

/** Cuántas se ven sin entrar a "Ver todas". */
const RECIENTES = 5;

export default async function TranscripcionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El `count: "exact"` viene en la misma consulta: sirve para saber si hace
  // falta el link de "Ver todas", y pedirlo aparte sería una segunda ida a la
  // base para contar lo mismo.
  const { data: previas, count } = await supabase
    .from("creator_transcriptions")
    .select("*", { count: "exact" })
    .eq("creator_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(RECIENTES);

  const filas = previas ?? [];
  const total = count ?? filas.length;

  return (
    <div className={styles.trCol}>
      <div className={styles.feedHead}>
        <h1 className={styles.feedTitle}>Transcripción</h1>
        <p className={styles.feedSub}>Pasá un video a texto y armá el guion de tu próxima pieza.</p>
      </div>

      <TranscripcionForm />

      <div className={styles.trSeccion}>
        <h2 className={styles.trSeccionTit}>Recientes</h2>
        {total > RECIENTES && (
          <Link href="/ugc/creador/transcripcion/todas" className={styles.trVerTodas}>
            Ver todas
          </Link>
        )}
      </div>

      {filas.length > 0 ? (
        <TranscripcionLista filas={filas} />
      ) : (
        <div className={styles.trVacio}>
          <QosIcon name="doc" size={26} className={styles.trVacioIc} />
          <p className={styles.trVacioTxt}>
            Todavía no transcribiste nada. Pegá el link de un video tuyo o de uno que te guste
            cómo está hecho.
          </p>
        </div>
      )}
    </div>
  );
}
