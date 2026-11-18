"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ContentPlatform } from "@/lib/database.types";
import { parseMes, mesDeFormulario, nombreDeMes } from "@/lib/ugc/cronograma";

/**
 * El cronograma mensual de un Hero.
 *
 * Los videos viven en `calendar_month_items` y NO en el tablero hasta que el
 * cliente aprueba. Ver la migración 20260812100000 para el porqué.
 *
 * Todas estas acciones son de admin. El Hero no pasa por acá: su link público
 * tiene sus propias acciones, que validan el token en vez de la sesión.
 */

async function admin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return perfil?.role === "admin" ? supabase : null;
}

function revalidar(heroId: string, mes: string) {
  revalidatePath("/admin/cronogramas");
  revalidatePath(`/admin/cronogramas/${heroId}/${mes}`);
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/calendario");
  revalidatePath("/admin");
  revalidatePath(`/admin/heroes/${heroId}`);
}

/**
 * Crea el cronograma del mes y su tarjeta en el carril del pipeline.
 *
 * La tarjeta es lo que el equipo ya venía usando a mano (las `GUION-AGOSTO` del
 * tablero): una por Hero y mes, que se mueve de "en curso" a "aprobado". Acá
 * nace sola, para que armar el cronograma y verlo en el tablero sean el mismo
 * acto y no dos que alguien tiene que acordarse de sincronizar.
 */
export async function crearCronogramaAction(formData: FormData) {
  const supabase = await admin();
  if (!supabase) return;

  const heroId = String(formData.get("hero_id") ?? "").trim();
  // El campo manda 'yyyy-MM'; la tabla guarda el día 1. mesDeFormulario acepta
  // las dos formas para que un formulario viejo tampoco se rompa.
  const mes = mesDeFormulario(String(formData.get("month") ?? "").trim());
  if (!heroId || !mes) return;

  // upsert y no insert: si el mes ya existe —lo pudo crear el botón de aprobar
  // del Dashboard, que viene de antes— se entra a editarlo en vez de reventar
  // con un choque de clave primaria.
  const { error } = await supabase.from("hero_calendar_months").upsert(
    { hero_id: heroId, month: mes },
    { onConflict: "hero_id,month", ignoreDuplicates: true }
  );
  if (error) return;

  await crearTarjetaDelCronograma(supabase, heroId, mes);

  revalidar(heroId, mes);
  redirect(`/admin/cronogramas/${heroId}/${mes}`);
}

/**
 * La tarjeta del cronograma en el carril, si todavía no existe.
 *
 * Se busca por título antes de insertar porque el equipo ya tiene 9 tarjetas
 * `GUION-AGOSTO` puestas a mano: sin esta comprobación, abrir el cronograma de
 * agosto de un Hero le duplicaría la tarjeta que ya venía usando.
 */
async function crearTarjetaDelCronograma(
  supabase: NonNullable<Awaited<ReturnType<typeof admin>>>,
  heroId: string,
  mes: string
) {
  const { data: columna } = await supabase
    .from("content_columns")
    .select("id")
    .eq("section", "guion")
    .eq("is_done", false)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!columna) return;

  const titulo = `CRONOGRAMA ${nombreDeMes(mes).toUpperCase()}`;

  const { data: yaEsta } = await supabase
    .from("content_pieces")
    .select("id")
    .eq("brand_id", heroId)
    .eq("title", titulo)
    .maybeSingle();
  if (yaEsta) return;

  await supabase.from("content_pieces").insert({
    brand_id: heroId,
    title: titulo,
    column_id: columna.id,
    calendar_month: mes,
  });
}

/** Una fila nueva, al final de la lista. */
export async function agregarVideoAction(heroId: string, mesRaw: string) {
  const supabase = await admin();
  const mes = parseMes(mesRaw);
  if (!supabase || !mes) return;

  // La posición se calcula sobre la última fila y no con un count: si alguien
  // borró un video del medio, el count repetiría una posición existente y las
  // dos filas quedarían empatadas, ordenándose al azar entre recargas.
  const { data: ultima } = await supabase
    .from("calendar_month_items")
    .select("position")
    .eq("hero_id", heroId)
    .eq("month", mes)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("calendar_month_items").insert({
    hero_id: heroId,
    month: mes,
    position: (ultima?.position ?? -1) + 1,
  });

  revalidar(heroId, mes);
}

export async function guardarVideoAction(formData: FormData) {
  const supabase = await admin();
  if (!supabase) return;

  const id = String(formData.get("id") ?? "");
  const heroId = String(formData.get("hero_id") ?? "");
  const mes = parseMes(String(formData.get("month") ?? ""));
  if (!id || !heroId || !mes) return;

  const texto = (campo: string) => String(formData.get(campo) ?? "").trim() || null;

  const { data: item } = await supabase
    .from("calendar_month_items")
    .update({
      title: String(formData.get("title") ?? "").trim(),
      publish_date: texto("publish_date"),
      publish_time: texto("publish_time"),
      platform: String(formData.get("platform") ?? "instagram") as ContentPlatform,
      script_hook: texto("script_hook"),
      script_idea: texto("script_idea"),
      script_desarrollo: texto("script_desarrollo"),
      script_cta: texto("script_cta"),
      notes: texto("notes"),
    })
    .eq("id", id)
    .select(
      "piece_id, title, publish_date, publish_time, platform, script_hook, script_idea, script_desarrollo, script_cta"
    )
    .maybeSingle();

  if (item?.piece_id) await sincronizarConLaTarjeta(supabase, item);

  revalidar(heroId, mes);
}

/**
 * Lo que se edita en el cronograma baja a la tarjeta que ya nació, guion incluido.
 *
 * Sin esto, editar un video después de aprobado dejaba dos verdades: pasó de
 * verdad el 2026-08-13 —el cronograma decía septiembre y la tarjeta seguía
 * diciendo agosto, así que "no aparecía" en el mes donde se la buscaba— y de
 * paso descuadraba la meta sellada del mes, que cuenta videos del cronograma.
 *
 * **El cronograma manda**, que es el modelo de todo este módulo: la fila es lo
 * que se le prometió al Hero, así que la tarjeta la sigue. Evan lo decidió el
 * 2026-08-13, con el costo sobre la mesa: si alguien reescribió el guion en la
 * tarjeta y después se toca esa fila, lo del cronograma gana. Se copia tal cual
 * —vacío incluido—: dejar un campo en blanco en el cronograma es decir que va
 * en blanco, y respetarlo a medias daría una tercera verdad.
 *
 * **Los apuntes quedan afuera**, y es lo único. En la tarjeta son notas de
 * producción que se escriben en el set (locación, utilería, quién sale), no lo
 * que se planificó; son el único campo que nace en el pipeline y no acá.
 *
 * Un título vacío no pisa el que había: `content_pieces.title` es NOT NULL y la
 * fila del cronograma admite vacío (default '').
 */
async function sincronizarConLaTarjeta(
  supabase: NonNullable<Awaited<ReturnType<typeof admin>>>,
  item: {
    piece_id: string | null;
    title: string;
    publish_date: string | null;
    publish_time: string | null;
    platform: ContentPlatform;
    script_hook: string | null;
    script_idea: string | null;
    script_desarrollo: string | null;
    script_cta: string | null;
  }
) {
  if (!item.piece_id) return;

  const titulo = item.title.trim();

  await supabase
    .from("content_pieces")
    .update({
      ...(titulo ? { title: titulo } : {}),
      publish_date: item.publish_date,
      publish_time: item.publish_time,
      platform: item.platform,
      script_hook: item.script_hook,
      script_idea: item.script_idea,
      script_desarrollo: item.script_desarrollo,
      script_cta: item.script_cta,
    })
    .eq("id", item.piece_id);
}

/**
 * Borra el cronograma de un mes.
 *
 * Qué se lleva y qué no, que es lo único importante acá:
 *
 * - **Sus videos planificados se van con él** (`on delete cascade`). Sin el mes
 *   al que pertenecen no significan nada.
 * - **Las tarjetas que ya nacieron en el pipeline SE QUEDAN.** Son trabajo, y
 *   posiblemente trabajo empezado. La FK es `on delete set null`, así que se
 *   sueltan del cronograma y siguen su vida en el tablero.
 * - **La tarjeta del cronograma sí se borra**, pero SOLO si la creó el sistema.
 *   Se reconoce porque tiene `calendar_month` y vive en el carril de
 *   cronogramas. Las `GUION-AGOSTO` que el equipo puso a mano tienen
 *   `calendar_month` en null y no se tocan — son suyas, no nuestras.
 */
export async function borrarCronogramaAction(heroId: string, mesRaw: string) {
  const supabase = await admin();
  const mes = parseMes(mesRaw);
  if (!supabase || !mes) return;

  const { data: delCarril } = await supabase.from("content_columns").select("id").eq("section", "guion");
  const ids = (delCarril ?? []).map((c) => c.id);

  if (ids.length > 0) {
    await supabase
      .from("content_pieces")
      .delete()
      .eq("brand_id", heroId)
      .eq("calendar_month", mes)
      .in("column_id", ids);
  }

  await supabase.from("hero_calendar_months").delete().eq("hero_id", heroId).eq("month", mes);

  revalidar(heroId, mes);
  redirect("/admin/cronogramas");
}

/**
 * Quita un video del cronograma, esté aprobado o no.
 *
 * Hasta el 2026-11-06 un video con tarjeta no se podía quitar: la idea era
 * proteger el trabajo del tablero. Evan lo dio vuelta porque en el mes surgen
 * cambios —se cae un video, se reemplaza otro— y el cronograma tiene que poder
 * reflejarlos, si no el Hero ve en su link cosas que ya no van.
 *
 * Si el video ya es tarjeta se borra LA TARJETA, y el trigger
 * `borrar_video_del_cronograma_con_la_tarjeta` se lleva la fila del
 * cronograma. El cronograma manda: un video que se saca de lo prometido no
 * sigue como trabajo en el tablero. Se entra por la tarjeta y no por la fila a
 * propósito, para que las dos salidas pasen por el mismo camino y no haya forma
 * de que quede una sin la otra. El delete de la fila que sigue es para el video
 * que nunca tuvo tarjeta; si el trigger ya la borró, no encuentra nada.
 *
 * La meta sellada del mes (`target`) no se toca: sigue diciendo lo que el
 * cliente aprobó, y la pantalla ya muestra la diferencia.
 */
export async function borrarVideoAction(id: string, heroId: string, mesRaw: string) {
  const supabase = await admin();
  const mes = parseMes(mesRaw);
  if (!supabase || !mes) return;

  // El id viaja desde el navegador: se acota al cronograma de la URL para que
  // un id ajeno no borre el video de otro Hero.
  const { data: item } = await supabase
    .from("calendar_month_items")
    .select("piece_id")
    .eq("id", id)
    .eq("hero_id", heroId)
    .eq("month", mes)
    .maybeSingle();
  if (!item) return;

  if (item.piece_id) {
    await supabase.from("content_pieces").delete().eq("id", item.piece_id);
  }
  await supabase.from("calendar_month_items").delete().eq("id", id);

  revalidar(heroId, mes);
  // La tarjeta también vivía en el calendario.
  revalidatePath("/admin/calendario");
}
