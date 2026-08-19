"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarComentarioDeHero, notificarAprobacionDeHero } from "@/lib/ugc/aviso-cronograma";

/**
 * Lo que el Hero puede hacer desde su link, sin cuenta y sin sesión.
 *
 * ────────────────────────────────────────────────────────────────────
 * La frontera, porque es la única del proyecto de este tipo
 * ────────────────────────────────────────────────────────────────────
 * Un Hero no tiene usuario: `agency_clients` es una tabla plana. Lo único que
 * lo identifica es conocer el token de SU cronograma. Eso obliga a tres reglas,
 * y las tres están puestas acá abajo y no en la UI:
 *
 * 1. **RLS sigue cerrada.** Estas acciones usan el cliente service-role, que
 *    salta RLS, en vez de abrirle escritura a `anon`. Si se hiciera con
 *    policies, cualquiera con la anon key —que viaja en el bundle de todo
 *    navegador— podría escribir sobre estas tablas desde afuera de la app.
 *
 * 2. **El token se resuelve a un cronograma ANTES de tocar nada**, y todo lo
 *    que sigue se acota a ese `(hero_id, month)`. Un id de video que venga del
 *    formulario no se usa nunca solo: siempre con el `and` del cronograma. Sin
 *    eso, quien tenga UN token válido podría comentar los videos de cualquier
 *    otro Hero mandando ids ajenos.
 *
 * 3. **La superficie es mínima**: comentar y aprobar. No hay acción pública que
 *    edite fechas, guion ni cantidad de videos — lo decidió el equipo, y de
 *    paso significa que ni un token filtrado puede alterar lo que se prometió.
 */

/** El cronograma al que apunta un token, o null. Nada corre sin pasar por acá. */
async function cronogramaDelToken(token: string) {
  // Se valida la forma antes de consultar: `share_token` es uuid, así que un
  // token con cualquier otra cosa hace fallar la consulta entera en Postgres en
  // vez de devolver vacío, y eso sale como error 500 en lugar de "no existe".
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("hero_calendar_months")
    .select("hero_id, month, status")
    .eq("share_token", token)
    .maybeSingle();

  return data ? { supabase, ...data } : null;
}

/** Deja el comentario del Hero en un video. Reemplaza el anterior. */
export async function comentarVideoAction(token: string, itemId: string, comentarioRaw: string) {
  const crono = await cronogramaDelToken(token);
  if (!crono) return { ok: false as const, error: "Este link ya no es válido." };

  if (crono.status === "aprobado") {
    return { ok: false as const, error: "Ya aprobaste este cronograma, no se puede comentar." };
  }

  const comentario = comentarioRaw.trim().slice(0, 2000);

  const { data, error } = await crono.supabase
    .from("calendar_month_items")
    .update({
      client_comment: comentario || null,
      client_comment_at: comentario ? new Date().toISOString() : null,
    })
    .eq("id", itemId)
    // El candado: el id del video viaja en el formulario, así que solo se acepta
    // si además pertenece al cronograma de ESTE token.
    .eq("hero_id", crono.hero_id)
    .eq("month", crono.month)
    .select("id, title")
    .maybeSingle();

  if (error || !data) return { ok: false as const, error: "No se pudo guardar el comentario." };

  if (comentario) {
    await notificarComentarioDeHero({
      heroId: crono.hero_id,
      mes: crono.month,
      tituloDelVideo: data.title,
      comentario,
    });
  }

  revalidarTodo(token, crono.hero_id, crono.month);
  return { ok: true as const };
}

/**
 * El Hero aprueba: los videos del cronograma nacen como tarjetas del pipeline.
 *
 * Es el único momento en que este archivo escribe sobre el tablero del equipo,
 * y por eso es el que más candados tiene.
 */
export async function aprobarCronogramaAction(token: string) {
  const crono = await cronogramaDelToken(token);
  if (!crono) return { ok: false as const, error: "Este link ya no es válido." };

  // Aprobar dos veces (doble clic, o volver atrás y reenviar) crearía el mes
  // entero duplicado en el tablero. Se corta acá y otra vez por video, abajo.
  if (crono.status === "aprobado") return { ok: true as const, yaEstaba: true };

  const { supabase, hero_id: heroId, month: mes } = crono;

  const { data: items } = await supabase
    .from("calendar_month_items")
    .select("*")
    .eq("hero_id", heroId)
    .eq("month", mes)
    // El cronograma se lee como un calendario y no como la bitácora de carga:
    // el orden lo manda la fecha de publicación, con la hora de desempate y
    // la posición de creación al final para que dos videos del mismo momento
    // no se intercambien entre recargas. Los que todavía no tienen fecha van
    // últimos: son justo los que faltan por definir.
    .order("publish_date", { ascending: true, nullsFirst: false })
    .order("publish_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true });

  const pendientes = (items ?? []).filter((i) => !i.piece_id);
  if (pendientes.length === 0 && (items ?? []).length === 0) {
    return { ok: false as const, error: "Este cronograma todavía no tiene videos." };
  }

  // La primera columna del carril de videos: ahí es donde el equipo empieza a
  // trabajar. Cuál es lo dice la posición, no el nombre — el equipo las
  // renombra y esto tiene que seguir cayendo en la misma.
  const { data: columna } = await supabase
    .from("content_columns")
    .select("id")
    .eq("section", "video")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!columna) return { ok: false as const, error: "No se pudo crear los videos." };

  for (const item of pendientes) {
    const { data: pieza } = await supabase
      .from("content_pieces")
      .insert({
        brand_id: heroId,
        // Un video sin título igual tiene que poder nacer: el cronograma pudo
        // aprobarse con alguno a medio llenar, y `title` es NOT NULL.
        title: item.title.trim() || "Video sin título",
        column_id: columna.id,
        platform: item.platform,
        publish_date: item.publish_date,
        publish_time: item.publish_time,
        calendar_month: mes,
        script_hook: item.script_hook,
        script_idea: item.script_idea,
        script_desarrollo: item.script_desarrollo,
        script_cta: item.script_cta,
        notes: item.notes,
      })
      .select("id")
      .single();

    // Se enlaza de inmediato, video por video, y no en un update al final: si
    // esto se cae a mitad de camino, los que ya nacieron quedan marcados y un
    // segundo intento no los vuelve a crear.
    if (pieza) {
      await supabase.from("calendar_month_items").update({ piece_id: pieza.id }).eq("id", item.id);
    }
  }

  // El estado va AL FINAL: el trigger que sella la meta cuenta los videos del
  // cronograma, y marcarlo aprobado antes de crearlos dejaría la meta bien pero
  // con las tarjetas a medio nacer si algo falla en el medio.
  await supabase
    .from("hero_calendar_months")
    .update({ status: "aprobado", approved_at: new Date().toISOString(), approved_by: "cliente" })
    .eq("hero_id", heroId)
    .eq("month", mes);

  await moverTarjetaDelCronograma(supabase, heroId, mes);
  await notificarAprobacionDeHero({ heroId, mes, cantidad: pendientes.length });

  revalidarTodo(token, heroId, mes);
  return { ok: true as const, creados: pendientes.length };
}

/** La tarjeta del cronograma pasa a la columna final de su carril. */
async function moverTarjetaDelCronograma(
  supabase: ReturnType<typeof createAdminClient>,
  heroId: string,
  mes: string
) {
  const { data: columna } = await supabase
    .from("content_columns")
    .select("id")
    .eq("section", "guion")
    .eq("is_done", true)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!columna) return;

  // Solo la tarjeta del cronograma, que es la que tiene calendar_month y vive
  // en el carril de cronogramas. Los videos recién creados también tienen
  // calendar_month, pero están en el carril de videos y no se tocan.
  const { data: delCarril } = await supabase.from("content_columns").select("id").eq("section", "guion");
  const ids = (delCarril ?? []).map((c) => c.id);
  if (ids.length === 0) return;

  await supabase
    .from("content_pieces")
    .update({ column_id: columna.id })
    .eq("brand_id", heroId)
    .eq("calendar_month", mes)
    .in("column_id", ids);
}

/** Deja constancia de que el Hero abrió el link. */
export async function marcarVistoAction(token: string) {
  const crono = await cronogramaDelToken(token);
  if (!crono) return;

  await crono.supabase
    .from("hero_calendar_months")
    .update({ client_seen_at: new Date().toISOString() })
    .eq("hero_id", crono.hero_id)
    .eq("month", crono.month);
}

function revalidarTodo(token: string, heroId: string, mes: string) {
  revalidatePath(`/cronograma/${token}`);
  revalidatePath(`/admin/cronogramas/${heroId}/${mes}`);
  revalidatePath("/admin/cronogramas");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin");
}
