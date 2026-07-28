"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    is_done: formData.get("is_done") === "on",
    is_pending_approval: formData.get("is_pending_approval") === "on",
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

  const isDone = formData.get("is_done") === "on";

  // Desmarcar la última columna "publicadas" rompe el Pase de servicio igual
  // que borrarla: quedaría sin ninguna de la que contar. Se avisa en vez de
  // dejar que los números se descuadren en silencio.
  if (!isDone) {
    const { data: hechas } = await supabase
      .from("content_columns")
      .select("id")
      .eq("is_done", true);
    if (hechas?.length === 1 && hechas[0].id === id) {
      return {
        error:
          "Tiene que haber al menos una columna marcada como publicadas — de ahí salen los publicados del mes. Marcá otra primero.",
      };
    }
  }

  const { error } = await supabase
    .from("content_columns")
    .update({
      name,
      color: String(formData.get("color") ?? "#6d54f3"),
      sop_code: String(formData.get("sop_code") ?? "").trim() || null,
      owner_role: String(formData.get("owner_role") ?? "").trim() || null,
      is_done: isDone,
      is_pending_approval: formData.get("is_pending_approval") === "on",
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
    .select("id, position, is_done")
    .order("position", { ascending: true });

  // Un tablero sin columnas no tendría desde dónde crear la primera.
  if (!columnas || columnas.length <= 1) return;

  // Tiene que quedar SIEMPRE una columna que signifique "publicado". Sin ella
  // el Pase de servicio contaría 0 publicados para todos los Heroes y el ritmo
  // y el riesgo saldrían mal, sin ningún error visible. El modal ya no ofrece
  // el botón en este caso; esto es la red por si llega igual.
  const objetivo = columnas.find((c) => c.id === id);
  if (objetivo?.is_done && columnas.filter((c) => c.is_done).length === 1) return;

  const i = columnas.findIndex((c) => c.id === id);
  if (i === -1) return;
  const destino = columnas[i === 0 ? 1 : i - 1];

  const { error: errorMudanza } = await supabase
    .from("content_pieces")
    .update({ column_id: destino.id })
    .eq("column_id", id);

  // Si la mudanza falla, no se borra: mejor dejar la columna que perder piezas.
  if (errorMudanza) return;

  await supabase.from("content_columns").delete().eq("id", id);

  revalidar();
}

/** Reordenar columnas: recibe los ids en el orden nuevo. */
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
