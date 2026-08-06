"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CouponStatus, CouponType } from "@/lib/database.types";

export type CuponState = { error: string } | { ok: string } | null;

const TIPOS: CouponType[] = ["producto", "servicio", "evento"];

/**
 * Crear un cupón. La marca elige si lo deja en borrador o lo publica; si no
 * está verificada, la RLS rechaza el publicado — acá se traduce ese rechazo a
 * un mensaje que se entiende, en vez de dejar salir el error crudo de Postgres.
 */
export async function crearCuponAction(
  _prevState: CuponState,
  formData: FormData
): Promise<CuponState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "producto") as CouponType;
  const minLevel = Number(formData.get("min_level") ?? 1);
  const stockTotal = Number(formData.get("stock_total") ?? 0);
  const conditions = String(formData.get("conditions") ?? "").trim() || null;
  const eventLocation = String(formData.get("event_location") ?? "").trim() || null;
  const eventDateRaw = String(formData.get("event_date") ?? "").trim();
  const vigencia = String(formData.get("claim_validity_days") ?? "").trim();
  const publicar = formData.get("publicar") === "1";

  if (!title) return { error: "Ponele un título al cupón." };
  if (!description) return { error: "Contá qué recibe el creador al canjearlo." };
  if (!TIPOS.includes(type)) return { error: "Tipo de cupón inválido." };
  if (!Number.isInteger(stockTotal) || stockTotal < 1) {
    return { error: "El stock tiene que ser al menos 1." };
  }

  // Un evento vence cuando pasa el evento: la vigencia relativa no aplica, y
  // sin fecha la base lo rechaza igual (constraint coupons_evento_con_fecha).
  let eventDate: string | null = null;
  if (type === "evento") {
    if (!eventDateRaw) return { error: "Un cupón de evento necesita la fecha del evento." };
    const fecha = new Date(`${eventDateRaw}T19:00:00-06:00`);
    if (Number.isNaN(fecha.getTime())) return { error: "La fecha del evento no es válida." };
    eventDate = fecha.toISOString();
  }

  const claimValidityDays = type === "evento" ? null : Number(vigencia || 14);
  if (type !== "evento" && (!Number.isInteger(claimValidityDays) || claimValidityDays! < 1)) {
    return { error: "La vigencia tiene que ser de al menos un día." };
  }

  const { error } = await supabase.from("coupons").insert({
    brand_id: user.id,
    title,
    description,
    type,
    min_level: minLevel,
    stock_total: stockTotal,
    conditions,
    event_date: eventDate,
    event_location: type === "evento" ? eventLocation : null,
    // El evento cierra con el evento; el resto vence por vigencia relativa.
    expires_at: eventDate,
    claim_validity_days: claimValidityDays,
    status: publicar ? "publicado" : "borrador",
  });

  if (error) {
    // 42501 = la RLS lo frenó. En esta tabla eso solo pasa por una razón.
    if (error.code === "42501") {
      return {
        error: "Tu negocio todavía está en revisión — podés dejarlo en borrador y publicarlo cuando quede verificado.",
      };
    }
    return { error: "No se pudo guardar el cupón. Intentá de nuevo." };
  }

  revalidatePath("/ugc/marca/loyalty");
  return { ok: publicar ? "Cupón publicado." : "Borrador guardado." };
}

/** Publicar, pausar o volver a borrador desde la lista. */
export async function cambiarEstadoCuponAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const id = String(formData.get("coupon_id") ?? "");
  const status = String(formData.get("status") ?? "") as CouponStatus;
  if (!id || !["borrador", "publicado", "pausado"].includes(status)) return;

  await supabase.from("coupons").update({ status }).eq("id", id).eq("brand_id", user.id);
  revalidatePath("/ugc/marca/loyalty");
}

export async function borrarCuponAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const id = String(formData.get("coupon_id") ?? "");
  if (!id) return;

  await supabase.from("coupons").delete().eq("id", id).eq("brand_id", user.id);
  revalidatePath("/ugc/marca/loyalty");
}

export type CanjeState = { error: string } | { ok: string; code: string } | null;

/**
 * Confirmar el canje. Toda la validación vive en `redeem_coupon`: que el código
 * exista, que sea de un cupón de esta marca, que no esté ya quemado y que no
 * haya vencido. Los mensajes vienen de ahí y se muestran tal cual.
 */
export async function canjearAction(
  _prevState: CanjeState,
  formData: FormData
): Promise<CanjeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Escribí el código del cupón." };

  const { data, error } = await supabase.rpc("redeem_coupon", { p_code: code });

  if (error) {
    const mensaje = error.message?.trim();
    return {
      error: mensaje && mensaje.length < 120 ? mensaje : "No se pudo confirmar el canje.",
    };
  }

  revalidatePath("/ugc/marca/loyalty");
  revalidatePath(`/ugc/marca/validar/${code.toUpperCase()}`);

  return { ok: "Canje confirmado. El código quedó quemado.", code: data!.code };
}
