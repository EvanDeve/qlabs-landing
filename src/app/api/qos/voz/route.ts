import { NextResponse } from "next/server";
import { accesoDeApi } from "@/lib/auth/acceso-api";
import { generarVoz, hayApiKey } from "@/lib/ugc/elevenlabs";
import {
  MODELO_POR_DEFECTO,
  VOICEOVER_BUCKET,
  mensajeDeErrorDeVoz,
  modeloDeVoz,
  motivoDeRechazo,
} from "@/lib/ugc/voz";

// Ruta y no server action, por lo mismo que la transcripción: es una llamada a
// un proveedor externo y tarda más que cualquier interacción normal de la app.
export const maxDuration = 300;

type Body = {
  text?: string;
  voiceId?: string;
  voiceName?: string;
  modelId?: string;
  transcriptionId?: string | null;
};

/** Una hora alcanza de sobra para escuchar y descargar; el bucket es privado,
 *  así que el link no puede ser eterno. Al recargar la página se firma de nuevo. */
const FIRMA_SEGUNDOS = 3600;

export async function POST(request: Request) {
  // Herramienta del equipo: los créditos de ElevenLabs los paga Q Labs. La RLS
  // protege el dato por dueño, pero quién puede GASTAR se decide acá.
  const acceso = await accesoDeApi(["admin"]);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  const { user, supabase } = acceso;

  if (!hayApiKey()) {
    console.error("[voz] falta ELEVENLABS_API_KEY");
    return NextResponse.json(
      { error: "La generación de voz no está configurada todavía. Falta la API key de ElevenLabs." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as Body;
  const texto = (body.text ?? "").trim();
  const voiceId = (body.voiceId ?? "").trim();

  const rechazo = motivoDeRechazo(texto);
  if (rechazo) return NextResponse.json({ error: rechazo }, { status: 400 });
  if (!voiceId) {
    return NextResponse.json({ error: "Elegí una voz." }, { status: 400 });
  }

  // Un modelo desconocido se cambia por el default en vez de rebotar: el id
  // solo elige calidad y precio, y fallar por eso sería castigar al usuario
  // por un bug de la pantalla.
  const modelId = modeloDeVoz(body.modelId ?? "")?.id ?? MODELO_POR_DEFECTO;

  // El nombre de la voz es solo la etiqueta que va a mostrar el historial; el
  // que ElevenLabs valida de verdad es el id, y si no existe responde 404 y el
  // error ya sale traducido. Se recorta por las dudas: es texto de afuera.
  const voiceName = (body.voiceName ?? "").trim().slice(0, 80) || "voz sin nombre";

  // La fila se crea ANTES de llamar al proveedor para que un fallo quede
  // registrado con su motivo, en vez de perderse. Mismo criterio que la
  // transcripción.
  const { data: fila, error: insertError } = await supabase
    .from("voiceovers")
    .insert({
      owner_id: user.id,
      text: texto,
      voice_id: voiceId,
      voice_name: voiceName,
      model_id: modelId,
      char_count: texto.length,
      source_transcription_id: body.transcriptionId || null,
      status: "processing",
    })
    .select("id, expires_at")
    .single();

  if (insertError || !fila) {
    console.error("[voz] no se pudo crear la fila:", insertError?.message);
    return NextResponse.json({ error: "No se pudo iniciar la generación." }, { status: 500 });
  }

  const arranque = Date.now();

  try {
    const audio = await generarVoz({ text: texto, voiceId, modelId });

    // El mp3 lo sube el servidor con la sesión del usuario, no con
    // service-role: la policy del bucket exige que la carpeta sea su uuid, y
    // dejar que la RLS siga siendo la que manda es lo que evita que un bug acá
    // termine escribiendo en la carpeta de otro.
    const storagePath = `${user.id}/${crypto.randomUUID()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from(VOICEOVER_BUCKET)
      .upload(storagePath, audio, { contentType: "audio/mpeg" });

    if (uploadError) {
      throw new Error(`No se pudo guardar el audio: ${uploadError.message}`);
    }

    await supabase
      .from("voiceovers")
      .update({
        status: "done",
        storage_path: storagePath,
        bytes: audio.byteLength,
      })
      .eq("id", fila.id)
      .eq("owner_id", user.id);

    const { data: firma } = await supabase.storage
      .from(VOICEOVER_BUCKET)
      .createSignedUrl(storagePath, FIRMA_SEGUNDOS);

    console.log(
      `[voz] ok en ${((Date.now() - arranque) / 1000).toFixed(1)}s — ${texto.length} caracteres, ${modelId}`
    );

    return NextResponse.json({
      id: fila.id,
      url: firma?.signedUrl ?? null,
      storagePath,
      bytes: audio.byteLength,
      expiresAt: fila.expires_at,
      voiceName,
      modelId,
      charCount: texto.length,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    const mensaje = mensajeDeErrorDeVoz(err);
    console.error(
      `[voz] falló tras ${((Date.now() - arranque) / 1000).toFixed(1)}s:`,
      err instanceof Error ? err.message : err
    );

    await supabase
      .from("voiceovers")
      .update({ status: "error", error_message: mensaje })
      .eq("id", fila.id)
      .eq("owner_id", user.id);

    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
