"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContentPriority, ContentPlatform, ContentApproval } from "@/lib/database.types";

export async function createContentPieceAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const brandId = String(formData.get("brand_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const platform = String(formData.get("platform") ?? "instagram") as ContentPlatform;
  const priority = String(formData.get("priority") ?? "media") as ContentPriority;
  const ownerId = String(formData.get("owner_id") ?? "") || null;
  const publishDateRaw = String(formData.get("publish_date") ?? "").trim();
  const recordDateRaw = String(formData.get("record_date") ?? "").trim();
  // Columna en la que nace la pieza. Viene del "+" del Kanban; si no llega,
  // cae en la primera del tablero.
  let columnId = String(formData.get("column_id") ?? "");
  if (!columnId) {
    const { data: primera } = await supabase
      .from("content_columns")
      .select("id")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    columnId = primera?.id ?? "";
  }

  if (!brandId || !title || !code || !columnId) return;

  await supabase.from("content_pieces").insert({
    brand_id: brandId,
    title,
    code,
    column_id: columnId,
    platform,
    priority,
    owner_id: ownerId,
    publish_date: publishDateRaw || null,
    record_date: recordDateRaw || null,
  });

  revalidatePath("/ugc/admin/pipeline");
  revalidatePath("/ugc/admin");
  revalidatePath(`/ugc/admin/heroes/${brandId}`);
}

export async function deleteContentPieceAction(pieceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: current } = await supabase
    .from("content_pieces")
    .select("brand_id")
    .eq("id", pieceId)
    .single();

  await supabase.from("content_pieces").delete().eq("id", pieceId);

  revalidatePath("/ugc/admin/pipeline");
  revalidatePath("/ugc/admin/calendario");
  revalidatePath("/ugc/admin");
  if (current?.brand_id) revalidatePath(`/ugc/admin/heroes/${current.brand_id}`);
}

export async function updateContentPieceColumnAction(pieceId: string, columnId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("content_pieces").update({ column_id: columnId }).eq("id", pieceId);

  revalidatePath("/ugc/admin/pipeline");
  revalidatePath("/ugc/admin");
}

export async function updateContentPieceAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const pieceId = String(formData.get("id") ?? "");
  if (!pieceId) return;

  const { data: current } = await supabase
    .from("content_pieces")
    .select("brand_id")
    .eq("id", pieceId)
    .single();

  const ownerId = String(formData.get("owner_id") ?? "") || null;
  const priority = String(formData.get("priority") ?? "media") as ContentPriority;
  const platform = String(formData.get("platform") ?? "instagram") as ContentPlatform;
  const approval = String(formData.get("approval") ?? "pendiente") as ContentApproval;
  const publishDateRaw = String(formData.get("publish_date") ?? "").trim();
  const recordDateRaw = String(formData.get("record_date") ?? "").trim();
  const driveUrl = String(formData.get("drive_url") ?? "").trim() || null;
  const scriptUrl = String(formData.get("script_url") ?? "").trim() || null;
  const finalUrl = String(formData.get("final_url") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await supabase
    .from("content_pieces")
    .update({
      owner_id: ownerId,
      priority,
      platform,
      approval,
      publish_date: publishDateRaw || null,
      record_date: recordDateRaw || null,
      drive_url: driveUrl,
      script_url: scriptUrl,
      final_url: finalUrl,
      notes,
    })
    .eq("id", pieceId);

  revalidatePath("/ugc/admin/pipeline");
  revalidatePath("/ugc/admin");
  if (current?.brand_id) revalidatePath(`/ugc/admin/heroes/${current.brand_id}`);
}
