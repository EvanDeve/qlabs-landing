"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET, MAX_AVATAR_FILE_BYTES } from "@/lib/ugc/avatars";

export type StaffProfileState = { error: string } | { ok: true } | null;

/**
 * El perfil propio de un miembro del equipo: nombre y foto.
 *
 * Solo toca `profiles`, que ya tiene la policy `profiles_update_own_or_admin`
 * — o sea que cualquiera del equipo edita lo suyo sin ser director. Lo de
 * `staff_members` (teléfono, opt-in de WhatsApp, hora del recordatorio, rol,
 * color) NO se toca desde acá a propósito: esa tabla quedó cerrada a
 * directores en la migración 20260803000000 y son decisiones de la agencia,
 * no preferencias personales.
 */
export async function updateStaffProfileAction(
  _prev: StaffProfileState,
  formData: FormData
): Promise<StaffProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Volvé a entrar." };

  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) return { error: "Poné tu nombre — es el que ve el resto del equipo." };

  const update: { display_name: string; avatar_url?: string } = { display_name: displayName };

  const avatarFile = formData.get("avatar");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    // El límite igual casi nunca se toca: el modal de recorte manda un PNG de
    // 512×512, no el original de la cámara. Está por si algún día se sube sin
    // pasar por ahí.
    if (avatarFile.size > MAX_AVATAR_FILE_BYTES) {
      return { error: "La foto supera el tamaño máximo (5 MB)." };
    }

    // La carpeta tiene que ser el uid: las policies del bucket 'avatars'
    // (migración 20260724100000) solo dejan escribir en `{uid}/...`.
    //
    // El nombre lleva timestamp en vez de pisar siempre 'avatar.png' porque el
    // bucket es público y con CDN: al reusar la ruta, la foto vieja se seguiría
    // viendo hasta que expire la caché y parecería que no se guardó.
    const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
    if (uploadError) return { error: "No se pudo subir la foto. Intentá de nuevo." };

    update.avatar_url = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { error: "No se pudo guardar. Intentá de nuevo." };

  // Ancho y de layout: la cara aparece en el pie de la sidebar (que es el
  // layout, no la página), en las tarjetas del Pipeline, en el Calendario y en
  // Equipo. Revalidar solo /admin/perfil dejaría la foto vieja en todo el
  // resto hasta la próxima navegación dura.
  revalidatePath("/admin", "layout");
  return { ok: true };
}
