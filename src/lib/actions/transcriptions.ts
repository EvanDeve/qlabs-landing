"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
