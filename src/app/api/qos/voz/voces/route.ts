import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarVoz, hayApiKey, listarVoces } from "@/lib/ugc/elevenlabs";
import { mensajeDeErrorDeVoz } from "@/lib/ugc/voz";

// Existe para que la API key nunca llegue al navegador: la pantalla necesita
// la lista de voces de la cuenta, pero pedirla desde el cliente significaría
// exponer la key a cualquiera que abra las herramientas de desarrollo.
//
// Con `?id=<voice_id>` devuelve una sola voz en vez de la lista: es cómo se
// usa una voz que no está en la cuenta (la Voice Library, una clonada ajena).
export async function GET(request: Request) {
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

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Solo para cuentas del equipo." }, { status: 403 });
  }

  if (!hayApiKey()) {
    return NextResponse.json(
      { error: "Falta la API key de ElevenLabs. Avisale a quien administre el proyecto." },
      { status: 503 }
    );
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();

  try {
    if (id) return NextResponse.json({ voz: await buscarVoz(id) });
    return NextResponse.json({ voces: await listarVoces() });
  } catch (err) {
    console.error("[voz/voces] falló:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: mensajeDeErrorDeVoz(err) }, { status: 500 });
  }
}
