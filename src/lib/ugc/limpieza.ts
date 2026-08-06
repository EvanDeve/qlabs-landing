/**
 * Barridos periódicos. Corre desde el cron diario, sin sesión de usuario.
 *
 * Por qué existe: el plan gratis de Supabase da 1 GB de Storage y es el primer
 * techo contra el que va a pegar el proyecto. Todo lo que se guarde "por si
 * acaso" y nadie borre a mano, lo termina llenando.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { VOICEOVER_BUCKET } from "@/lib/ugc/voz";

/** Storage acepta varias rutas por llamada, pero no ilimitadas. Se va de a
 *  tandas para que un mes acumulado no arme un request gigante. */
const TANDA = 100;

/**
 * Borra los voiceovers vencidos (30 días por defecto, ver `expires_at`).
 *
 * Primero el archivo y después la fila: si el proceso se corta en el medio,
 * queda una fila sin audio —visible, borrable y sin ocupar Storage— en vez de
 * un mp3 huérfano que ya nadie sabe que existe.
 *
 * Necesita service-role: barre las filas de todo el equipo, no las de una
 * sesión, así que la RLS por dueño no aplica acá.
 */
export async function limpiarVoiceoversVencidos(
  admin: SupabaseClient<Database>
): Promise<{ filas: number; archivos: number }> {
  const { data: vencidos, error } = await admin
    .from("voiceovers")
    .select("id, storage_path")
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[limpieza] no se pudieron leer los voiceovers vencidos:", error.message);
    return { filas: 0, archivos: 0 };
  }
  if (!vencidos?.length) return { filas: 0, archivos: 0 };

  const rutas = vencidos.map((v) => v.storage_path).filter((r): r is string => Boolean(r));
  let archivos = 0;

  for (let i = 0; i < rutas.length; i += TANDA) {
    const tanda = rutas.slice(i, i + TANDA);
    const { error: removeError } = await admin.storage.from(VOICEOVER_BUCKET).remove(tanda);
    if (removeError) {
      // No se corta el barrido: que falle una tanda no es razón para dejar sin
      // limpiar las demás ni para no borrar las filas.
      console.error("[limpieza] fallo borrando audios:", removeError.message);
    } else {
      archivos += tanda.length;
    }
  }

  const { error: deleteError } = await admin
    .from("voiceovers")
    .delete()
    .in(
      "id",
      vencidos.map((v) => v.id)
    );

  if (deleteError) {
    console.error("[limpieza] fallo borrando filas:", deleteError.message);
    return { filas: 0, archivos };
  }

  console.log(`[limpieza] voiceovers vencidos: ${vencidos.length} filas, ${archivos} audios`);
  return { filas: vencidos.length, archivos };
}

/**
 * Barrido diario de Loyalty Loop: vence lo que se pasó de fecha, libera el
 * stock que quedó tomado sin usarse, y avisa a quien le vence un cupón en 3
 * días.
 *
 * Todo el trabajo pasa adentro de `expirar_loyalty()`, en una sola llamada a la
 * base. Traerse las filas para decidir acá cuáles vencieron sería el mismo
 * cálculo hecho dos veces —una en la pantalla del creador y otra acá— con la
 * chance de que no coincidan.
 *
 * Va colgado de este cron y no en una entrada propia de `vercel.json` por lo
 * mismo que la limpieza de audios: el plan Hobby da 2 slots y uno ya está en
 * uso. Su fallo no debe arrastrar al resto del cron.
 */
export async function expirarLoyalty(admin: SupabaseClient<Database>) {
  const { data, error } = await admin.rpc("expirar_loyalty");

  if (error) {
    console.error("[limpieza] falló el barrido de Loyalty Loop:", error.message);
    return null;
  }

  console.log("[limpieza] loyalty:", JSON.stringify(data));
  return data;
}
