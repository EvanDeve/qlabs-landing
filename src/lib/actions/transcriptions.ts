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
