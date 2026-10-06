"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { soyDirector } from "@/lib/auth/require-director";
import type { PipelineBoardKind } from "@/lib/database.types";

export type BoardState = { error?: string; ok?: string } | null;

// Los cuatro de antes alimentan cuentas que preguntan por su id ('video' para
// publicados y atrasadas, 'guion' para los cronogramas). Se pueden renombrar y
// cambiarles la gente, pero no borrar.
const BOARDS_FIJOS = new Set(["video", "guion", "it", "admin"]);

/** Con las que arranca un board nuevo: las mismas que el equipo terminó usando en IT y Admin. */
const COLUMNAS_INICIALES = [
  { name: "Sin Empezar", color: "#df4650" },
  { name: "En Progreso", color: "#c07414" },
  { name: "Terminado", color: "#14a06a" },
];

/**
 * El tipo viaja en el id (`v_…` / `t_…`): así `esCarrilDeTareas` no tiene que
 * ir a buscar el board. La base lo exige con `pipeline_boards_kind_en_id`.
 */
function nuevoId(kind: PipelineBoardKind): string {
  const azar = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${kind === "tareas" ? "t" : "v"}_${azar}`;
}

function miembrosDelForm(formData: FormData): string[] {
  return [...new Set(formData.getAll("members").map(String).filter(Boolean))];
}

/**
 * Todo esto escribe con la sesión, así que la RLS (solo directores) ya lo
 * protege. El chequeo de acá es para devolver un error que se pueda leer en
 * vez de un "violates row-level security policy".
 */
export async function crearBoardAction(_prev: BoardState, formData: FormData): Promise<BoardState> {
  if (!(await soyDirector())) return { error: "Solo un director puede crear boards." };

  const name = String(formData.get("name") ?? "").trim();
  const kind: PipelineBoardKind = formData.get("kind") === "tareas" ? "tareas" : "videos";
  if (!name) return { error: "Ponele un nombre al board." };
  if (name.length > 40) return { error: "El nombre puede tener hasta 40 letras." };

  const supabase = await createClient();
  const { data: ultimo } = await supabase
    .from("pipeline_boards")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const id = nuevoId(kind);
  const { error } = await supabase
    .from("pipeline_boards")
    .insert({ id, name, kind, position: (ultimo?.position ?? 0) + 1 });
  if (error) return { error: "No se pudo crear el board." };

  // Las columnas van a continuación de las que ya existen: el orden de "Todo"
  // es por posición, y un board nuevo va al final.
  const { data: ultimaColumna } = await supabase
    .from("content_columns")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = (ultimaColumna?.position ?? 0) + 1;

  const [{ error: errorColumnas }, { error: errorMiembros }] = await Promise.all([
    supabase
      .from("content_columns")
      .insert(COLUMNAS_INICIALES.map((c, i) => ({ ...c, position: base + i, section: id }))),
    (async () => {
      const miembros = miembrosDelForm(formData);
      return miembros.length
        ? supabase.from("pipeline_board_members").insert(miembros.map((profile_id) => ({ board_id: id, profile_id })))
        : { error: null };
    })(),
  ]);

  revalidatePath("/admin/pipeline", "layout");
  if (errorColumnas || errorMiembros) {
    return { error: "El board se creó, pero no se pudo terminar de armar. Revisalo abajo." };
  }
  return { ok: `Listo, "${name}" ya está en el Pipeline.` };
}

export async function guardarBoardAction(_prev: BoardState, formData: FormData): Promise<BoardState> {
  if (!(await soyDirector())) return { error: "Solo un director puede editar boards." };

  const boardId = String(formData.get("board_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!boardId) return { error: "No encontré ese board." };
  if (!name) return { error: "El board necesita un nombre." };
  if (name.length > 40) return { error: "El nombre puede tener hasta 40 letras." };

  const supabase = await createClient();
  const miembros = miembrosDelForm(formData);

  const [{ error: errorNombre }, { data: actuales }] = await Promise.all([
    supabase.from("pipeline_boards").update({ name }).eq("id", boardId),
    supabase.from("pipeline_board_members").select("profile_id").eq("board_id", boardId),
  ]);
  if (errorNombre) return { error: "No se pudo guardar el nombre." };

  // Solo la diferencia: borrar y volver a insertar a todos le cambiaría el
  // `created_at` a gente que no se tocó.
  const antes = new Set((actuales ?? []).map((m) => m.profile_id));
  const ahora = new Set(miembros);
  const salen = [...antes].filter((id) => !ahora.has(id));
  const entran = [...ahora].filter((id) => !antes.has(id));

  const [{ error: errorSalen }, { error: errorEntran }] = await Promise.all([
    salen.length
      ? supabase.from("pipeline_board_members").delete().eq("board_id", boardId).in("profile_id", salen)
      : Promise.resolve({ error: null }),
    entran.length
      ? supabase.from("pipeline_board_members").insert(entran.map((profile_id) => ({ board_id: boardId, profile_id })))
      : Promise.resolve({ error: null }),
  ]);

  revalidatePath("/admin/pipeline", "layout");
  if (errorSalen || errorEntran) return { error: "No se pudo actualizar quién entra." };
  return { ok: "Guardado." };
}

/**
 * Solo un board vacío: las tarjetas son trabajo del equipo y no se van con un
 * clic. Si tiene, primero se mueven o se borran desde el tablero.
 */
export async function borrarBoardAction(boardId: string): Promise<void> {
  if (!(await soyDirector())) return;
  if (BOARDS_FIJOS.has(boardId)) return;

  const supabase = await createClient();
  const { data: columnas } = await supabase.from("content_columns").select("id").eq("section", boardId);
  const columnIds = (columnas ?? []).map((c) => c.id);

  if (columnIds.length) {
    const { count } = await supabase
      .from("content_pieces")
      .select("id", { count: "exact", head: true })
      .in("column_id", columnIds);
    if ((count ?? 0) > 0) return;

    const { error } = await supabase.from("content_columns").delete().in("id", columnIds);
    if (error) return;
  }

  await supabase.from("pipeline_boards").delete().eq("id", boardId);
  revalidatePath("/admin/pipeline", "layout");
}
