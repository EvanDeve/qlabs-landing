import { createClient } from "@/lib/supabase/server";
import { getColumns } from "@/lib/actions/creator-tasks";
import CreatorTaskBoard from "@/components/ugc/creador/CreatorTaskBoard";
import TableroVacio from "@/components/ugc/creador/TableroVacio";
import styles from "@/styles/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CreadorPipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const columns = await getColumns(supabase, user!.id);

  // Sin columnas no hay tablero que mostrar, y tampoco hace falta pedir las
  // tareas: no puede haber ninguna, porque toda tarea cuelga de una columna.
  if (columns.length === 0) {
    return (
      <div>
        <div className={styles.feedHead}>
          <h1 className={styles.feedTitle}>Mi pipeline</h1>
        </div>
        <TableroVacio />
      </div>
    );
  }

  // El filtro por creator_id es redundante con la RLS, pero deja explícito en
  // el código que esto es privado de cada creador.
  const { data: tasks } = await supabase
    .from("creator_tasks")
    .select("*")
    .eq("creator_id", user!.id)
    .order("position", { ascending: true });

  return <CreatorTaskBoard tasks={tasks ?? []} columns={columns} />;
}
