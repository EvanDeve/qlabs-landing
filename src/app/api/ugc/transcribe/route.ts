import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  detectSourceType,
  normalizeVideoUrl,
  isValidUrl,
  parseSegments,
  parseCabecera,
  mensajeDeError,
  mimeDeArchivo,
  TRANSCRIPTION_PROMPT,
  TRANSCRIPTION_BUCKET,
  MAX_TRANSCRIPTION_FILE_BYTES,
} from "@/lib/ugc/transcription";

// Ruta y no server action a propósito: transcribir tarda más que cualquier
// interacción normal de la app y necesita su propio límite de tiempo.
//
// ⚠️ 300s solo aplica en Vercel Pro. En el plan gratis el techo es más bajo,
// pero lo medido para el material de acá entra cómodo: 3s un video de 19
// segundos, 24s uno largo.
export const maxDuration = 300;

// El archivo NO viaja en este request: el navegador lo sube directo a Supabase
// Storage y acá llega solo su ruta. En Vercel el body de una función tiene un
// tope de ~4.5 MB, así que mandar el video por acá fallaría en producción por
// más que funcione en local.
// `durationSeconds` la mide el NAVEGADOR con el `<video>` antes de subir. No se
// puede medir acá: leer la duración de un mp4 en el servidor pide un demuxer, y
// ese es justo el binario de sistema que no existe en serverless y que llevó a
// elegir Gemini en vez de Whisper. En un link viene undefined y queda en null.
type Body = { url?: string; storagePath?: string; fileName?: string; durationSeconds?: number };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // El equipo de Q Labs también transcribe material propio. No abre nada: la
  // fila se crea con `creator_id = auth.uid()` y la policy sigue siendo
  // `creator_id = auth.uid()`, así que cada quien ve solo lo suyo y un admin
  // NO ve las transcripciones de los creadores.
  if (profile?.role !== "creator" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Solo para cuentas de creador o del equipo." }, { status: 403 });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("[transcribe] falta GEMINI_API_KEY");
    return NextResponse.json(
      { error: "La transcripción no está configurada todavía. Avisale al equipo de Q Labs." },
      { status: 503 }
    );
  }

  const { url, storagePath, fileName, durationSeconds } = (await request.json()) as Body;
  const esArchivo = Boolean(storagePath);

  if (!esArchivo && !url?.trim()) {
    return NextResponse.json({ error: "Pegá un link o subí un archivo." }, { status: 400 });
  }
  if (!esArchivo && !isValidUrl(url!)) {
    return NextResponse.json({ error: "Ese no parece un link válido." }, { status: 400 });
  }
  // La ruta siempre arranca con el uuid del creador. Sin este chequeo, un
  // usuario podría mandar la carpeta de otro y hacer que el servidor —que usa
  // su propia sesión pero igual— intente leerla.
  if (esArchivo && !storagePath!.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
  }

  const sourceType = esArchivo ? "upload" : detectSourceType(url!);
  const normalized = esArchivo ? null : normalizeVideoUrl(url!);

  // Se crea la fila antes de llamar a Gemini para que un fallo quede
  // registrado con su motivo, en vez de perderse.
  const { data: fila, error: insertError } = await supabase
    .from("creator_transcriptions")
    .insert({
      creator_id: user.id,
      source_url: normalized,
      source_type: sourceType,
      file_name: esArchivo ? (fileName ?? "archivo") : null,
      // Se guarda ya en el insert y no al final: si la transcripción falla, la
      // fila igual sabe cuánto duraba el material, que es lo que la lista
      // necesita para dibujar la fila del error.
      duration_seconds:
        typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
          ? Math.round(durationSeconds)
          : null,
      status: "processing",
    })
    .select("id")
    .single();

  if (insertError || !fila) {
    console.error("[transcribe] no se pudo crear la fila:", insertError?.message);
    return NextResponse.json({ error: "No se pudo iniciar la transcripción." }, { status: 500 });
  }

  const arranque = Date.now();

  // Se limpia el archivo pase lo que pase: es material intermedio y lo que
  // vale es el texto. Dejarlo acumulándose es lo que llena el almacenamiento.
  async function limpiarArchivo() {
    if (!storagePath) return;
    await supabase.storage.from(TRANSCRIPTION_BUCKET).remove([storagePath]);
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    let parteVideo;

    if (esArchivo) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(TRANSCRIPTION_BUCKET)
        .download(storagePath!);

      if (downloadError || !blob) {
        throw new Error(`No se pudo leer el archivo subido: ${downloadError?.message ?? "vacío"}`);
      }
      if (blob.size > MAX_TRANSCRIPTION_FILE_BYTES) {
        throw new Error("El archivo supera el tamaño permitido.");
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      parteVideo = {
        inlineData: {
          mimeType: mimeDeArchivo(fileName ?? storagePath!, blob.type),
          data: buffer.toString("base64"),
        },
      };
    } else {
      parteVideo = { fileData: { mimeType: "video/mp4", fileUri: normalized! } };
    }

    const result = await model.generateContent([parteVideo, TRANSCRIPTION_PROMPT]);

    const texto = result.response.text().trim();
    if (!texto || texto.includes("SIN_AUDIO")) {
      throw new Error("SIN_AUDIO");
    }

    // La cabecera se saca ANTES de partir en segmentos: si el video no trae
    // marcas de tiempo, `parseSegments` guarda todo el texto como un bloque
    // único y sin este paso el "TITULO: …" quedaría adentro de la
    // transcripción, a la vista del creador.
    const { title, language, cuerpo } = parseCabecera(texto);

    const segments = parseSegments(cuerpo);
    if (segments.length === 0) {
      throw new Error("Gemini devolvió una transcripción vacía");
    }

    await supabase
      .from("creator_transcriptions")
      .update({
        status: "done",
        segments,
        title,
        language,
        completed_at: new Date().toISOString(),
      })
      .eq("id", fila.id)
      .eq("creator_id", user.id);

    await limpiarArchivo();

    console.log(
      `[transcribe] ok en ${((Date.now() - arranque) / 1000).toFixed(1)}s — ${sourceType}`
    );

    return NextResponse.json({ id: fila.id, segments });
  } catch (err) {
    const mensaje = mensajeDeError(err, sourceType);
    console.error(
      `[transcribe] falló tras ${((Date.now() - arranque) / 1000).toFixed(1)}s:`,
      err instanceof Error ? err.message : err
    );

    await supabase
      .from("creator_transcriptions")
      .update({ status: "error", error_message: mensaje })
      .eq("id", fila.id)
      .eq("creator_id", user.id);

    await limpiarArchivo();

    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
