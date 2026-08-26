"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Borra una transcripción. Se llama desde los dos lados —la lista y el menú
 * del detalle— y por eso recibe adónde volver: borrar desde el detalle deja al
 * creador parado en una ruta que ya no existe.
 */
export async function deleteTranscriptionAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ugc/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // El `.eq("creator_id")` es redundante con la RLS, pero deja explícito en el
  // código que una transcripción ajena no se toca.
  await supabase
    .from("creator_transcriptions")
    .delete()
    .eq("id", id)
    .eq("creator_id", user.id);

  revalidatePath("/ugc/creador/transcripcion");

  if (formData.get("volverA")) redirect(String(formData.get("volverA")));
}

/**
 * Renombra una transcripción.
 *
 * El título lo propone el modelo al transcribir, pero es lo único que
 * identifica a la fila en la lista y el modelo se equivoca: "Video de comida"
 * no distingue nada cuando hay ocho. Vaciar el campo lo devuelve al nombre del
 * archivo o al host del link, que es el comportamiento de antes de que el
 * título existiera — por eso no se rechaza el vacío.
 */
export async function renombrarTranscripcionAction(
  id: string,
  titulo: string
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ugc/login");

  if (!id) return { error: "Falta la transcripción." };

  // El tope de 80 es el mismo que aplica la ruta al guardar lo que devuelve el
  // modelo. Va en los dos lados por lo de siempre: un action se puede llamar
  // con lo que sea, y `maxLength` no frena un pegado.
  const limpio = titulo.trim().slice(0, 80);

  const { error } = await supabase
    .from("creator_transcriptions")
    .update({ title: limpio || null })
    .eq("id", id)
    .eq("creator_id", user.id);

  if (error) return { error: "No se pudo guardar el nombre. Probá de nuevo." };

  revalidatePath("/ugc/creador/transcripcion");
  return null;
}

export type SaveScriptState = { error: string } | null;

/**
 * Guarda las ediciones del creador sobre el guion generado.
 *
 * El texto sí viaja por un server action —a diferencia de los archivos, que
 * suben directo a Storage— porque un guion son unos pocos KB y entra de sobra
 * en el tope de body de Vercel.
 */
export async function saveImprovedScriptAction(
  id: string,
  improvedScript: string
): Promise<SaveScriptState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ugc/login");

  if (!id) return { error: "Falta la transcripción." };

  // Se permite guardar vacío: es cómo el creador descarta un guion que no le
  // sirvió sin tener que borrar la transcripción entera.
  const texto = improvedScript.trim();

  const { error } = await supabase
    .from("creator_transcriptions")
    .update({
      improved_script: texto || null,
      improved_script_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("creator_id", user.id);

  if (error) {
    return { error: "No se pudo guardar el guion. Probá de nuevo." };
  }

  revalidatePath("/ugc/creador/transcripcion");
  return null;
}
