"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PORTFOLIO_BUCKET, PORTFOLIO_CATEGORIES } from "@/lib/ugc/portfolio";

export type UploadPortfolioItemState = { error: string } | null;

/**
 * El archivo NO viaja por acá: el navegador lo sube directo a Supabase Storage
 * (ver `@/lib/ugc/uploads`) y este action recibe solo `storage_path`. Mandarlo
 * por el Server Action chocaba con el tope de body de ~4.5 MB de Vercel, así
 * que el book andaba en local y fallaba en producción.
 */
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

  const storagePath = String(formData.get("storage_path") ?? "").trim();
  const mediaType = String(formData.get("media_type") ?? "");
  const category = String(formData.get("category") ?? "ugc");
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const viewsRaw = formData.get("views");
  const views = viewsRaw && Number(viewsRaw) > 0 ? Number(viewsRaw) : null;

  if (!storagePath) {
    return { error: "Elegí un archivo para subir." };
  }

  if (mediaType !== "video" && mediaType !== "image") {
    return { error: "Solo se aceptan imágenes o videos." };
  }

  if (!(PORTFOLIO_CATEGORIES as readonly string[]).includes(category)) {
    return { error: "Categoría inválida." };
  }

  // La ruta la arma el navegador. La policy de storage ya impide escribir
  // fuera de la carpeta propia, pero el chequeo acá evita que se registre una
  // pieza apuntando a la carpeta de otro creador.
  if (!storagePath.startsWith(`${user.id}/`) || storagePath.includes("..")) {
    return { error: "El archivo subido no es válido." };
  }

  // Que el objeto exista: si la subida se cortó, sin esto quedaría una pieza
  // en el book con la imagen rota.
  const nombre = storagePath.slice(user.id.length + 1);
  const { data: encontrados } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .list(user.id, { search: nombre });

  if (!encontrados?.some((o) => o.name === nombre)) {
    return { error: "No se encontró el archivo subido. Probá de nuevo." };
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
