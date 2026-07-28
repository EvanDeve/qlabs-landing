import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  detectSourceType,
  normalizeVideoUrl,
  isValidUrl,
  parseSegments,
  mensajeDeError,
  TRANSCRIPTION_PROMPT,
} from "@/lib/ugc/transcription";

// Ruta y no server action a propósito: transcribir tarda más que cualquier
// interacción normal de la app y necesita su propio límite de tiempo.
//
// ⚠️ 300s solo aplica en Vercel Pro. En el plan gratis el techo es bastante
// más bajo, así que un video largo se va a cortar. Para lo que se usa acá
// —Reels y TikToks de 15 a 60 segundos— alcanza; hay que medirlo con un video
// real antes de prometerle a nadie que aguanta videos largos.
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  // La transcripción es una herramienta del creador. No alcanza con estar
  // logueado: un usuario marca no tiene por qué gastar cuota de la API.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "creator") {
    return NextResponse.json({ error: "Solo para cuentas de creador." }, { status: 403 });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("[transcribe] falta GEMINI_API_KEY");
    return NextResponse.json(
      { error: "La transcripción no está configurada todavía. Avisale al equipo de Q Labs." },
      { status: 503 }
    );
  }

  const { url } = (await request.json()) as { url?: string };
  if (!url?.trim()) {
    return NextResponse.json({ error: "Pegá el link del video." }, { status: 400 });
  }
  if (!isValidUrl(url)) {
    return NextResponse.json({ error: "Ese no parece un link válido." }, { status: 400 });
  }

  const sourceType = detectSourceType(url);
  const normalized = normalizeVideoUrl(url);

  // Se crea la fila antes de llamar a Gemini para que un fallo quede
  // registrado con su motivo, en vez de perderse.
  const { data: fila, error: insertError } = await supabase
    .from("creator_transcriptions")
    .insert({
      creator_id: user.id,
      source_url: normalized,
      source_type: sourceType,
      status: "processing",
    })
    .select("id")
    .single();

  if (insertError || !fila) {
    console.error("[transcribe] no se pudo crear la fila:", insertError?.message);
    return NextResponse.json({ error: "No se pudo iniciar la transcripción." }, { status: 500 });
  }

  const arranque = Date.now();

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      { fileData: { mimeType: "video/mp4", fileUri: normalized } },
      TRANSCRIPTION_PROMPT,
    ]);

    const texto = result.response.text().trim();
    if (!texto || texto.includes("SIN_AUDIO")) {
      throw new Error("SIN_AUDIO");
    }

    const segments = parseSegments(texto);
    if (segments.length === 0) {
      throw new Error("Gemini devolvió una transcripción vacía");
    }

    await supabase
      .from("creator_transcriptions")
      .update({ status: "done", segments, completed_at: new Date().toISOString() })
      .eq("id", fila.id)
      .eq("creator_id", user.id);

    // Se loguea el tiempo real: es el dato que decide si hace falta subir de
    // plan en Vercel o si el flujo entra cómodo como está.
    console.log(`[transcribe] ok en ${((Date.now() - arranque) / 1000).toFixed(1)}s — ${sourceType}`);

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

    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
