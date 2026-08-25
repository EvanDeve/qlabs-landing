"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatform, COLUMNAS_POR_DEFECTO } from "@/lib/ugc/creator-task";

export type CreatorTaskState = { error: string } | null;

const PIPELINE = "/ugc/creador/pipeline";

function revalidar() {
  revalidatePath(PIPELINE);
  revalidatePath("/ugc/creador");
}

async function requireCreator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ugc/login");
  return { supabase, user };
}

/**
 * Las columnas del creador, tal como están. Ya NO siembra sola.
 *
 * Antes sembraba las cinco por defecto en la primera visita, así que nadie veía
 * nunca un tablero vacío —y con eso se perdía la única oportunidad de decirle
 * al creador que las columnas son suyas y que nadie más ve ese tablero—. Ahora
 * la primera visita muestra la pantalla que ofrece las sugeridas o armar las
 * propias, y sembrar es una decisión suya: `sembrarColumnasSugeridasAction`.
 */
export async function getColumns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  creatorId: string
) {
  const { data } = await supabase
    .from("creator_task_columns")
    .select("*")
    .eq("creator_id", creatorId)
    .order("position", { ascending: true });

  return data ?? [];
}

/** El botón "Usar columnas sugeridas" del tablero vacío. */
export async function sembrarColumnasSugeridasAction(): Promise<CreatorTaskState> {
  const { supabase, user } = await requireCreator();

  // Que no siembre dos veces: dos toques seguidos, o la pestaña abierta en dos
  // lados, dejarían diez columnas y ningún índice único lo impide.
  const { count } = await supabase
    .from("creator_task_columns")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id);

  if ((count ?? 0) > 0) {
    revalidar();
    return null;
  }

  const { error } = await supabase.from("creator_task_columns").insert(
    COLUMNAS_POR_DEFECTO.map((c, i) => ({
      creator_id: user.id,
      name: c.name,
      color: c.color,
      is_done: c.is_done,
      position: i,
    }))
  );

  if (error) return { error: "No se pudieron crear las columnas. Probá de nuevo." };

  revalidar();
  return null;
}

/** Confirma que una columna es del creador antes de aceptarla como destino. */
async function columnaPropia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  creatorId: string,
  columnId: string
) {
  const { data } = await supabase
    .from("creator_task_columns")
    .select("id")
    .eq("id", columnId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  return Boolean(data);
}

// ---------------------------------------------------------------- tareas

export async function createCreatorTaskAction(
  _prev: CreatorTaskState,
  formData: FormData
): Promise<CreatorTaskState> {
  const { supabase, user } = await requireCreator();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Ponele un título a la tarea." };

  const columnId = String(formData.get("column_id") ?? "");
  if (!columnId || !(await columnaPropia(supabase, user.id, columnId))) {
    return { error: "Elegí una columna válida." };
  }

  const platformRaw = String(formData.get("platform") ?? "");
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Entra al final de su columna. Se pide solo la última posición en vez de
  // contar filas: con `count` habría que traerlas todas para nada.
  const { data: ultima } = await supabase
    .from("creator_tasks")
    .select("position")
    .eq("creator_id", user.id)
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("creator_tasks").insert({
    creator_id: user.id,
    title,
    column_id: columnId,
    platform: isPlatform(platformRaw) ? platformRaw : null,
    due_date: dueDate,
    notes,
    position: (ultima?.position ?? -1) + 1,
  });

  if (error) return { error: "No se pudo crear la tarea. Intentá de nuevo." };

  revalidar();
  return null;
}

export async function updateCreatorTaskAction(
  _prev: CreatorTaskState,
  formData: FormData
): Promise<CreatorTaskState> {
  const { supabase, user } = await requireCreator();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Tarea inválida." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Ponele un título a la tarea." };

  const columnId = String(formData.get("column_id") ?? "");
  if (!columnId || !(await columnaPropia(supabase, user.id, columnId))) {
    return { error: "Elegí una columna válida." };
  }

  const platformRaw = String(formData.get("platform") ?? "");

  // El `.eq("creator_id")` es redundante con la policy, pero deja el filtro
  // explícito en el código: quien lea esto no tiene que ir a buscar la RLS
  // para saber que una tarea ajena no se toca.
  const { error } = await supabase
    .from("creator_tasks")
    .update({
      title,
      column_id: columnId,
      platform: isPlatform(platformRaw) ? platformRaw : null,
      due_date: String(formData.get("due_date") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id)
    .eq("creator_id", user.id);

  if (error) return { error: "No se pudo guardar la tarea." };

  revalidar();
  return null;
}

/** Mover una tarjeta de columna. La llama el Kanban al soltar. */
export async function moveCreatorTaskAction(formData: FormData) {
  const { supabase, user } = await requireCreator();

  const id = String(formData.get("id") ?? "");
  const columnId = String(formData.get("column_id") ?? "");
  if (!id || !columnId || !(await columnaPropia(supabase, user.id, columnId))) return;

  const { data: ultima } = await supabase
    .from("creator_tasks")
    .select("position")
    .eq("creator_id", user.id)
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("creator_tasks")
    .update({ column_id: columnId, position: (ultima?.position ?? -1) + 1 })
    .eq("id", id)
    .eq("creator_id", user.id);

  revalidar();
}

export async function deleteCreatorTaskAction(formData: FormData) {
  const { supabase, user } = await requireCreator();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("creator_tasks").delete().eq("id", id).eq("creator_id", user.id);

  revalidar();
}

// --------------------------------------------------------------- columnas

export type ColumnState = { error: string } | null;

export async function createColumnAction(
  _prev: ColumnState,
  formData: FormData
): Promise<ColumnState> {
  const { supabase, user } = await requireCreator();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Ponele un nombre a la columna." };

  const { data: ultima } = await supabase
    .from("creator_task_columns")
    .select("position")
    .eq("creator_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("creator_task_columns").insert({
    creator_id: user.id,
    name,
    color: String(formData.get("color") ?? "#6d54f3"),
    is_done: formData.get("is_done") === "on",
    position: (ultima?.position ?? -1) + 1,
  });

  if (error) return { error: "No se pudo crear la columna." };

  revalidar();
  return null;
}

export async function updateColumnAction(
  _prev: ColumnState,
  formData: FormData
): Promise<ColumnState> {
  const { supabase, user } = await requireCreator();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: "Columna inválida." };
  if (!name) return { error: "Ponele un nombre a la columna." };

  const isDone = formData.get("is_done") === "on";

  // Desmarcar la última "terminado" rompe lo mismo que borrarla.
  if (!isDone) {
    const { data: hechas } = await supabase
      .from("creator_task_columns")
      .select("id")
      .eq("creator_id", user.id)
      .eq("is_done", true);
    if (hechas?.length === 1 && hechas[0].id === id) {
      return {
        error:
          "Tiene que haber al menos una columna de tareas terminadas. Marcá otra primero.",
      };
    }
  }

  const { error } = await supabase
    .from("creator_task_columns")
    .update({
      name,
      color: String(formData.get("color") ?? "#6d54f3"),
      is_done: isDone,
    })
    .eq("id", id)
    .eq("creator_id", user.id);

  if (error) return { error: "No se pudo guardar la columna." };

  revalidar();
  return null;
}

/**
 * Borra una columna. Las tarjetas que tenga NO se borran: se mudan a la
 * columna anterior. La FK es `on delete restrict` justamente para que un
 * descuido acá falle ruidosamente en vez de llevarse trabajo por delante.
 */
export async function deleteColumnAction(formData: FormData) {
  const { supabase, user } = await requireCreator();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: columnas } = await supabase
    .from("creator_task_columns")
    .select("id, position, is_done")
    .eq("creator_id", user.id)
    .order("position", { ascending: true });

  // Un tablero sin ninguna columna no tendría cómo volver a tener una.
  if (!columnas || columnas.length <= 1) return;

  // Tiene que quedar una que signifique "terminado": si no, las tareas ya
  // publicadas volverían a contar como pendientes y atrasadas en el Resumen.
  const objetivo = columnas.find((c) => c.id === id);
  if (objetivo?.is_done && columnas.filter((c) => c.is_done).length === 1) return;

  const i = columnas.findIndex((c) => c.id === id);
  if (i === -1) return;
  const destino = columnas[i === 0 ? 1 : i - 1];

  const { data: ultima } = await supabase
    .from("creator_tasks")
    .select("position")
    .eq("creator_id", user.id)
    .eq("column_id", destino.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: mudadas, error: errorMudanza } = await supabase
    .from("creator_tasks")
    .update({ column_id: destino.id, position: (ultima?.position ?? -1) + 1 })
    .eq("column_id", id)
    .eq("creator_id", user.id)
    .select("id");

  // Si la mudanza falla, no se borra: mejor dejar la columna que perder tareas.
  if (errorMudanza) return;
  void mudadas;

  await supabase.from("creator_task_columns").delete().eq("id", id).eq("creator_id", user.id);

  revalidar();
}

/** Reordenar columnas: recibe los ids en el orden nuevo. */
export async function reorderColumnsAction(formData: FormData) {
  const { supabase, user } = await requireCreator();

  const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
  if (!ids.length) return;

  await Promise.all(
    ids.map((id, i) =>
      supabase
        .from("creator_task_columns")
        .update({ position: i })
        .eq("id", id)
        .eq("creator_id", user.id)
    )
  );

  revalidar();
}
