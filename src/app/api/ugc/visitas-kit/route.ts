import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { esBotDeVistaPrevia } from "@/lib/ugc/visitas-kit";

/**
 * Registra una visita al media kit de un creador (spec 002, RF-13..RF-16).
 *
 * Lo llama el navegador después de cargar el kit, y no el render de la
 * página: un Server Component no puede poner la cookie del visitante, y el
 * render también corre en los prefetch, que no son visitas.
 *
 * Qué cuenta y qué no lo decide `registrar_visita_kit` en la base (el dueño y
 * el equipo no suman, una por persona por día). Acá solo se filtran los
 * lectores de vista previa y se le da al visitante sin sesión una cookie
 * anónima, que la base guarda mezclada en una huella y nunca en claro.
 *
 * Siempre responde 204: una visita que no se pudo contar no le importa a
 * quien está mirando el kit.
 */

const COOKIE = "ugc_visitante";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const nada = new Response(null, { status: 204 });

  if (esBotDeVistaPrevia((await headers()).get("user-agent"))) return nada;

  let creador: unknown;
  try {
    ({ creador } = await request.json());
  } catch {
    return nada;
  }
  if (typeof creador !== "string" || !UUID.test(creador)) return nada;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let anonimo: string | null = null;
  if (!user) {
    const cookieStore = await cookies();
    anonimo = cookieStore.get(COOKIE)?.value ?? null;
    if (!anonimo || !UUID.test(anonimo)) {
      anonimo = randomUUID();
      cookieStore.set(COOKIE, anonimo, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  }

  const { error } = await supabase.rpc("registrar_visita_kit", {
    p_creator: creador,
    p_anonimo: anonimo,
  });
  if (error) console.error("[visitas-kit] no se registró la visita:", error.message);

  return nada;
}
