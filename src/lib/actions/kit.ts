"use server";

import { createClient } from "@/lib/supabase/server";

export type VerTelefonoResultado = { telefono: string } | { error: string };

/**
 * Revela el teléfono de un creador a quien mira su kit (spec 002, RF-08).
 *
 * Sin service role a propósito: quién es y si puede verlo lo decide la base
 * con `auth.uid()` dentro de `ver_telefono_creador`, que en el mismo acto le
 * avisa al creador. Acá solo se traduce la respuesta.
 */
export async function verTelefonoAction(creadorId: string): Promise<VerTelefonoResultado> {
  if (!/^[0-9a-f-]{36}$/i.test(creadorId)) return { error: "Creador inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ver_telefono_creador", { p_creator: creadorId });
  if (error) return { error: "No se pudo mostrar el teléfono. Probá de nuevo." };
  if (!data) return { error: "Este teléfono no está disponible para tu cuenta." };
  return { telefono: data };
}
