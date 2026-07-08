"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEventType, CalendarEventStatus } from "@/lib/database.types";

export async function createCalendarEventAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const type = String(formData.get("type") ?? "reunion") as CalendarEventType;
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const brandId = String(formData.get("brand_id") ?? "") || null;
  const responsibleId = String(formData.get("responsible_id") ?? "") || null;

  if (!title || !startsAt) return;

  await supabase.from("calendar_events").insert({
    type,
    title,
    starts_at: new Date(startsAt).toISOString(),
    brand_id: brandId,
    responsible_id: responsibleId,
  });

  revalidatePath("/ugc/admin/calendario");
  revalidatePath("/ugc/admin");
}

export async function updateCalendarEventAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const type = String(formData.get("type") ?? "reunion") as CalendarEventType;
  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const brandId = String(formData.get("brand_id") ?? "") || null;
  const responsibleId = String(formData.get("responsible_id") ?? "") || null;
  const status = String(formData.get("status") ?? "programado") as CalendarEventStatus;

  await supabase
    .from("calendar_events")
    .update({
      type,
      title,
      starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
      brand_id: brandId,
      responsible_id: responsibleId,
      status,
    })
    .eq("id", id);

  revalidatePath("/ugc/admin/calendario");
  revalidatePath("/ugc/admin");
}
