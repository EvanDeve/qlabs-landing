"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSeccionColumna } from "@/lib/ugc/content-columns";

export type ColumnState = { error: string } | null;

// Las columnas cambian los números de todo el módulo (Dashboard, Heroes,
// Pase de servicio), así que se revalida ancho.
function revalidar() {
  revalidatePath("/ugc/admin/pipeline");
  revalidatePath("/ugc/admin");
  revalidatePath("/ugc/admin/heroes", "layout");
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createContentColumnAction(
  _prev: ColumnState,
  formData: FormData
): Promise<ColumnState> {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Sesión vencida." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Ponele un nombre a la columna." };

  const { data: ultima } = await supabase
    .from("content_columns")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("content_columns").insert({
    name,
    color: String(formData.get("color") ?? "#6d54f3"),
    sop_code: String(formData.get("sop_code") ?? "").trim() || null,
    owner_role: String(formData.get("owner_role") ?? "").trim() || null,
    // is_done no se manda: lo decide la posición dentro del carril y lo
    // mantiene el trigger de 20260818140000. Una columna nueva nace al final,
    // así que es la que pasa a cerrar su carril — que es lo que uno espera al
    // agregar un paso más.
    is_pending_approval: formData.get("is_pending_approval") === "on",
    is_ready: formData.get("is_ready") === "on",
    section: parseSeccionColumna(formData.get("section")),
    position: (ultima?.position ?? -1) + 1,
  });

  if (error) return { error: "No se pudo crear la columna." };

  revalidar();
  return null;
}

export async function updateContentColumnAction(
  _prev: ColumnState,
  formData: FormData
): Promise<ColumnState> {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Sesión vencida." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: "Columna inválida." };
  if (!name) return { error: "Ponele un nombre a la columna." };

  const { error } = await supabase
    .from("content_columns")
    .update({
      name,
      color: String(formData.get("color") ?? "#6d54f3"),
      sop_code: String(formData.get("sop_code") ?? "").trim() || null,
      owner_role: String(formData.get("owner_role") ?? "").trim() || null,
      // is_done queda afuera a propósito: ver createContentColumnAction.
      is_pending_approval: formData.get("is_pending_approval") === "on",
      is_ready: formData.get("is_ready") === "on",
      section: parseSeccionColumna(formData.get("section")),
    })
    .eq("id", id);

  if (error) return { error: "No se pudo guardar la columna." };

  revalidar();
  return null;
}

/**
 * Borra una columna. Las piezas que tenga NO se borran: se mudan a la columna
 * de al lado. La FK es `on delete restrict` justamente para que un descuido
 * acá falle ruidosamente en vez de llevarse trabajo del equipo por delante.
 */
export async function deleteContentColumnAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: columnas } = await supabase
    .from("content_columns")
    .select("id, position, section")
    .order("position", { ascending: true });

  // Un tablero sin columnas no tendría desde dónde crear la primera.
  if (!columnas || columnas.length <= 1) return;

  const objetivo = columnas.find((c) => c.id === id);
  if (!objetivo) return;

  // Las piezas se mudan DENTRO del carril. Antes se mudaban a la columna de al
  // lado por posición, que con tres carriles pegados uno detrás del otro podía
  // ser de otro: borrar "Sin Empezar" —la primera de IT— mandaba sus tareas a
  // "Publicado", la última de video.
  //
  // Y si es la única de su carril no hay a dónde mudarlas: se corta acá en vez
  // de dejarlas caer en el carril de al lado. El modal ya no ofrece el botón en
  // ese caso; esto es la red por si llega igual.
  const delCarril = columnas.filter((c) => c.section === objetivo.section);
  if (delCarril.length <= 1) return;

  const i = delCarril.findIndex((c) => c.id === id);
  const destino = delCarril[i === 0 ? 1 : i - 1];

  // Ya no hace falta cuidar que quede alguna columna marcada como "publicadas":
  // la última de cada carril lo es por regla, y al borrar la última, la anterior
  // pasa a serlo sola. Ver la migración 20260818140000.

  const { error: errorMudanza } = await supabase
    .from("content_pieces")
    .update({ column_id: destino.id })
    .eq("column_id", id);

  // Si la mudanza falla, no se borra: mejor dejar la columna que perder piezas.
  if (errorMudanza) return;

  await supabase.from("content_columns").delete().eq("id", id);

  revalidar();
}

/**
 * Reordenar columnas: recibe los ids en el orden nuevo.
 *
 * ⚠️ Espera TODOS los ids del tablero, no los de una pestaña: asigna posiciones
 * 0..n por índice, así que con un subconjunto las posiciones chocarían entre
 * carriles — y desde 20260818140000 la posición es lo que decide qué columna
 * cierra cada carril. Hoy no la llama nadie.
 */
export async function reorderContentColumnsAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  if (!user) return;

  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  if (!ids.length) return;

  await Promise.all(
    ids.map((id, i) => supabase.from("content_columns").update({ position: i }).eq("id", id))
  );

  revalidar();
}
