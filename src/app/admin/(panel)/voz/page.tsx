import { createClient } from "@/lib/supabase/server";
import VoiceTool from "@/components/ugc/admin/VoiceTool";
import { VOICEOVER_BUCKET } from "@/lib/ugc/voz";

export const dynamic = "force-dynamic";

/** Una hora: es lo que dura la firma del audio. Al recargar se firma de nuevo. */
const FIRMA_SEGUNDOS = 3600;

/** El guion entero no entra en la lista; alcanza con saber de qué video salió. */
function nombreDeFuente(t: { file_name: string | null; source_url: string | null }): string {
  if (t.file_name) return t.file_name;
  if (!t.source_url) return "transcripción";
  try {
    const u = new URL(t.source_url);
    const id = u.searchParams.get("v");
    if (id) return `youtube · ${id}`;
    return u.hostname.replace(/^www\./, "") + u.pathname.slice(0, 22);
  } catch {
    return t.source_url.slice(0, 34);
  }
}

// Sin encabezado propio, igual que Transcripción: el título lo pone la topbar y
// esta página es un espacio de trabajo a pantalla completa.
export default async function VozPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: previos }, { data: transcripciones }] = await Promise.all([
    supabase
      .from("voiceovers")
      .select("*")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20),
    // Los guiones que ya generó esta misma cuenta en la herramienta de
    // transcripción. La RLS filtra por dueño igual que acá, así que nadie ve
    // el material de otro.
    supabase
      .from("creator_transcriptions")
      .select("id, file_name, source_url, improved_script, improved_script_at")
      .eq("creator_id", user!.id)
      .not("improved_script", "is", null)
      .order("improved_script_at", { ascending: false })
      .limit(20),
  ]);

  // Las firmas se piden todas juntas y no una por fila: son 20 y de a una serían
  // 20 viajes contra Storage cada vez que se abre la pantalla.
  const rutas = (previos ?? [])
    .map((v) => v.storage_path)
    .filter((r): r is string => Boolean(r));

  const firmas = new Map<string, string>();
  if (rutas.length) {
    const { data } = await supabase.storage.from(VOICEOVER_BUCKET).createSignedUrls(rutas, FIRMA_SEGUNDOS);
    for (const f of data ?? []) {
      if (f.path && f.signedUrl) firmas.set(f.path, f.signedUrl);
    }
  }

  return (
    <VoiceTool
      previos={(previos ?? []).map((v) => ({
        id: v.id,
        text: v.text,
        voiceName: v.voice_name,
        modelId: v.model_id,
        charCount: v.char_count,
        status: v.status,
        errorMessage: v.error_message,
        createdAt: v.created_at,
        expiresAt: v.expires_at,
        url: v.storage_path ? firmas.get(v.storage_path) ?? null : null,
      }))}
      guiones={(transcripciones ?? [])
        .filter((t) => t.improved_script?.trim())
        .map((t) => ({
          id: t.id,
          nombre: nombreDeFuente(t),
          texto: t.improved_script!,
        }))}
    />
  );
}
