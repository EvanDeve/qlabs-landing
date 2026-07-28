import { createClient } from "@/lib/supabase/server";
import TranscriptionTool from "@/components/ugc/creador/TranscriptionTool";

export const dynamic = "force-dynamic";

// Sin encabezado propio: el título ya lo pone la topbar del shell, y esta
// página es un espacio de trabajo a pantalla completa —fuentes, transcripción
// y guion ocupando el alto disponible—, no una página de contenido que se
// scrollea.
export default async function TranscripcionPage() {
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
