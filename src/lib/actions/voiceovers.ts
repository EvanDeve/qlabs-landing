"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VOICEOVER_BUCKET } from "@/lib/ugc/voz";

export async function deleteVoiceoverAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ugc/login");
  if (!id) return;

  // Hay que leer la fila antes de borrarla: sin `storage_path` el mp3 queda
  // huérfano en el bucket, ocupando lugar para siempre sin ninguna fila que lo
  // nombre. El `.eq("owner_id")` es redundante con la RLS y va explícito igual.
  const { data: fila } = await supabase
    .from("voiceovers")
    .select("storage_path")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!fila) return;

  if (fila.storage_path) {
    await supabase.storage.from(VOICEOVER_BUCKET).remove([fila.storage_path]);
  }

  await supabase.from("voiceovers").delete().eq("id", id).eq("owner_id", user.id);

  revalidatePath("/ugc/admin/voz");
}
