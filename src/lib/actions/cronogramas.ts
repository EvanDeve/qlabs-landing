"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ContentPlatform } from "@/lib/database.types";
import { parseMes, nombreDeMes } from "@/lib/ugc/cronograma";

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
  revalidatePath("/ugc/admin/cronogramas");
  revalidatePath(`/ugc/admin/cronogramas/${heroId}/${mes}`);
  revalidatePath("/ugc/admin/pipeline");
  revalidatePath("/ugc/admin");
  revalidatePath(`/ugc/admin/heroes/${heroId}`);
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
  const mes = parseMes(String(formData.get("month") ?? "").trim());
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
  redirect(`/ugc/admin/cronogramas/${heroId}/${mes}`);
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

  await supabase
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
    .eq("id", id);

  revalidar(heroId, mes);
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
  redirect("/ugc/admin/cronogramas");
}

export async function borrarVideoAction(id: string, heroId: string, mesRaw: string) {
  const supabase = await admin();
  const mes = parseMes(mesRaw);
  if (!supabase || !mes) return;

  // Un video ya aprobado no se borra desde acá: su tarjeta ya está en el
  // tablero y alguien puede estar trabajándola. Borrar la fila dejaría la
  // tarjeta huérfana y el cronograma diciendo que se prometió una cosa
  // distinta de la que se prometió.
  const { data: item } = await supabase.from("calendar_month_items").select("piece_id").eq("id", id).maybeSingle();
  if (item?.piece_id) return;

  await supabase.from("calendar_month_items").delete().eq("id", id);

  revalidar(heroId, mes);
}
