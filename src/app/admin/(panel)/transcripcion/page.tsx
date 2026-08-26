import { createClient } from "@/lib/supabase/server";
import TranscriptionTool from "@/components/ugc/admin/TranscriptionTool";

export const dynamic = "force-dynamic";

/**
 * La misma herramienta que usa el creador, para el material propio del equipo.
 *
 * ⚠️ Esto NO le da al admin acceso a las transcripciones de los creadores. La
 * consulta filtra por `creator_id = user.id` y la policy `creator_transcriptions_own`
 * hace lo mismo del lado de la base: cada cuenta ve solo lo suyo, sea admin o
 * creador. La decisión de que el equipo no lea el material de trabajo ajeno
 * sigue en pie —está anotada en la migración `20260727300000`— y esta pantalla
 * no la toca.
 *
 * Se reusa el componente del creador en vez de duplicarlo: es la misma
 * herramienta, y una copia significaría arreglar cada bug dos veces.
 */
export default async function AdminTranscripcionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: previas } = await supabase
    .from("creator_transcriptions")
    .select("*")
    .eq("creator_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return <TranscriptionTool previas={previas ?? []} />;
}
