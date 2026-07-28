import { createClient } from "@/lib/supabase/server";
import { getOrSeedColumns } from "@/lib/actions/creator-tasks";
import CreatorTaskBoard from "@/components/ugc/creador/CreatorTaskBoard";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

export const dynamic = "force-dynamic";

export default async function CreadorPipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Siembra las columnas por defecto si es la primera vez. Va antes de pedir
  // las tareas para que un tablero nuevo nunca se renderice sin columnas.
  const columns = await getOrSeedColumns(supabase, user!.id);

  // El filtro por creator_id es redundante con la RLS, pero deja explícito en
  // el código que esto es privado de cada creador.
  const { data: tasks } = await supabase
    .from("creator_tasks")
    .select("*")
    .eq("creator_id", user!.id)
    .order("position", { ascending: true });

  return (
    <div>
      <h1 className={styles.tbTitle} style={{ fontSize: "26px" }}>
        Mi pipeline
      </h1>
      <p style={{ color: "var(--ink-2)", marginBottom: "20px" }}>
        Tu tablero de producción. Arrastrá las tarjetas entre columnas, y armá las columnas como
        trabajás vos.
      </p>

      <CreatorTaskBoard tasks={tasks ?? []} columns={columns} />
    </div>
  );
}
