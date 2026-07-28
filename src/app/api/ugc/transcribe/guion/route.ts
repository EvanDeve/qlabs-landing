import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { construirPromptDeGuion, mensajeDeErrorDeGuion } from "@/lib/ugc/script-coach";

// Ruta y no server action por la misma razón que la transcripción: es una
// llamada a un modelo y tarda más que cualquier interacción normal de la app.
export const maxDuration = 300;

// Se dispara SOLO cuando el creador aprieta el botón del panel de guion. No se
// encadena al final de la transcripción a propósito: cada generación cuesta, y
// la mayoría de las transcripciones se usan para otra cosa (subtítulos, citas)
// sin necesitar un guion nuevo.
type Body = { id?: string };

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

  // Igual que la transcripción: el equipo trabaja sobre su propio material. La
  // fila se sigue filtrando por `creator_id = auth.uid()` más abajo, así que un
  // admin no puede generar un guion sobre la transcripción de un creador.
  if (profile?.role !== "creator" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Solo para cuentas de creador o del equipo." }, { status: 403 });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("[guion] falta GEMINI_API_KEY");
    return NextResponse.json(
      { error: "La generación de guiones no está configurada todavía. Avisale al equipo de Q Labs." },
      { status: 503 }
    );
  }

  const { id } = (await request.json()) as Body;
  if (!id) {
    return NextResponse.json({ error: "Falta la transcripción." }, { status: 400 });
  }

  // El filtro por creator_id es redundante con RLS y va igual: si algún día
  // alguien afloja la policy, la ruta no se convierte en el agujero.
  const { data: fila } = await supabase
    .from("creator_transcriptions")
    .select("id, segments, status")
    .eq("id", id)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!fila) {
    return NextResponse.json({ error: "No se encontró esa transcripción." }, { status: 404 });
  }
  if (fila.status !== "done" || !fila.segments?.length) {
    return NextResponse.json(
      { error: "Esa transcripción no se completó, así que no hay texto para trabajar." },
      { status: 400 }
    );
  }

  const arranque = Date.now();

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(construirPromptDeGuion(fila.segments));
    const texto = result.response.text().trim();

    if (!texto) {
      throw new Error("El modelo devolvió un guion vacío");
    }

    const improvedScriptAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("creator_transcriptions")
      .update({ improved_script: texto, improved_script_at: improvedScriptAt })
      .eq("id", fila.id)
      .eq("creator_id", user.id);

    // Si no se pudo guardar igual se devuelve el guion: el creador ya pagó la
    // generación y perderla por un fallo de escritura sería lo peor de ambos
    // mundos. Lo tiene en pantalla y puede copiarlo.
    if (updateError) {
      console.error("[guion] no se pudo guardar:", updateError.message);
    }

    console.log(`[guion] ok en ${((Date.now() - arranque) / 1000).toFixed(1)}s`);

    return NextResponse.json({ improvedScript: texto, improvedScriptAt, saved: !updateError });
  } catch (err) {
    console.error(
      `[guion] falló tras ${((Date.now() - arranque) / 1000).toFixed(1)}s:`,
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: mensajeDeErrorDeGuion(err) }, { status: 500 });
  }
}
