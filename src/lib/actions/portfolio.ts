"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PORTFOLIO_BUCKET,
  PORTFOLIO_CATEGORIES,
  MAX_PORTFOLIO_FILE_BYTES,
} from "@/lib/ugc/portfolio";

export type UploadPortfolioItemState = { error: string } | null;

export async function uploadPortfolioItemAction(
  _prevState: UploadPortfolioItemState,
  formData: FormData
): Promise<UploadPortfolioItemState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const file = formData.get("file");
  const category = String(formData.get("category") ?? "ugc");
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const viewsRaw = formData.get("views");
  const views = viewsRaw && Number(viewsRaw) > 0 ? Number(viewsRaw) : null;

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo para subir." };
  }

  if (file.size > MAX_PORTFOLIO_FILE_BYTES) {
    return { error: "El archivo pesa más de 25MB." };
  }

  const mediaType = file.type.startsWith("video/")
    ? "video"
    : file.type.startsWith("image/")
      ? "image"
      : null;

  if (!mediaType) {
    return { error: "Solo se aceptan imágenes o videos." };
  }

  if (!(PORTFOLIO_CATEGORIES as readonly string[]).includes(category)) {
    return { error: "Categoría inválida." };
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : mediaType === "video" ? "mp4" : "jpg";
  const storagePath = `${user.id}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    return { error: "No se pudo subir el archivo. Intentá de nuevo." };
  }

  const { data: existing } = await supabase
    .from("portfolio_items")
    .select("position")
    .eq("creator_id", user.id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { error: insertError } = await supabase.from("portfolio_items").insert({
    creator_id: user.id,
    storage_path: storagePath,
    media_type: mediaType,
    category,
    caption,
    position: nextPosition,
    views,
  });

  if (insertError) {
    await supabase.storage.from(PORTFOLIO_BUCKET).remove([storagePath]);
    return { error: "No se pudo guardar la pieza. Intentá de nuevo." };
  }

  revalidatePath("/ugc/creador/book");
  return null;
}

export async function deletePortfolioItemAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const itemId = String(formData.get("item_id") ?? "");
  if (!itemId) return;

  const { data: item } = await supabase
    .from("portfolio_items")
    .select("storage_path, creator_id")
    .eq("id", itemId)
    .single();

  if (!item || item.creator_id !== user.id) return;

  await supabase.from("portfolio_items").delete().eq("id", itemId);
  await supabase.storage.from(PORTFOLIO_BUCKET).remove([item.storage_path]);

  revalidatePath("/ugc/creador/book");
}

export async function movePortfolioItemAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const itemId = String(formData.get("item_id") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!itemId) return;

  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, position")
    .eq("creator_id", user.id)
    .order("position", { ascending: true });

  if (!items) return;

  const index = items.findIndex((i) => i.id === itemId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || swapIndex < 0 || swapIndex >= items.length) return;

  const current = items[index];
  const swap = items[swapIndex];

  await Promise.all([
    supabase
      .from("portfolio_items")
      .update({ position: swap.position })
      .eq("id", current.id)
      .eq("creator_id", user.id),
    supabase
      .from("portfolio_items")
      .update({ position: current.position })
      .eq("id", swap.id)
      .eq("creator_id", user.id),
  ]);

  revalidatePath("/ugc/creador/book");
}
