"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { avisarResultadoVerificacion } from "@/lib/ugc/verificacion-avisos";

// Verificar deja limpio el rechazo anterior: son el mismo interruptor visto
// desde los dos lados, y una fila con `verified` y `rejected_at` a la vez no
// tendría un estado legible.
export async function setCreatorVerifiedAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profileId = String(formData.get("profile_id") ?? "");
  const verified = formData.get("verified") === "true";
  if (!profileId) return;

  // El trigger protect_verified rechaza esto si la sesión no es admin.
  await supabase
    .from("creator_profiles")
    .update({ verified, rejected_at: null, rejection_reason: null })
    .eq("profile_id", profileId);

  if (verified) {
    await avisarResultadoVerificacion({ profileId, role: "creator", aprobada: true });
  }

  revalidatePath("/ugc/admin/marketplace");
}

export async function setBrandVerifiedAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profileId = String(formData.get("profile_id") ?? "");
  const verified = formData.get("verified") === "true";
  if (!profileId) return;

  // El trigger protect_brand_verified rechaza esto si la sesión no es admin.
  await supabase
    .from("brand_profiles")
    .update({ verified, rejected_at: null, rejection_reason: null })
    .eq("profile_id", profileId);

  if (verified) {
    await avisarResultadoVerificacion({ profileId, role: "brand", aprobada: true });
  }

  // El sello aparece en el feed, la vitrina y el perfil público de la marca.
  revalidatePath("/ugc/admin/marketplace");
  revalidatePath("/ugc/creador");
  revalidatePath("/ugc");
}

/**
 * Rechaza una cuenta, o le levanta el rechazo para devolverla a la cola.
 *
 * Rechazar cierra la puerta de verdad: la persona no puede reeditar sus datos
 * ni volver a la cola por su cuenta (ver la pantalla /ugc/pendiente y el gate
 * del onboarding). Solo un admin puede revertirlo desde acá.
 */
async function setRechazo(
  tabla: "creator_profiles" | "brand_profiles",
  formData: FormData
): Promise<{ profileId: string; rechazada: boolean; motivo: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profileId = String(formData.get("profile_id") ?? "");
  const rechazada = formData.get("rechazada") === "true";
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!profileId) return null;

  await supabase
    .from(tabla)
    .update(
      rechazada
        ? { verified: false, rejected_at: new Date().toISOString(), rejection_reason: motivo }
        : { rejected_at: null, rejection_reason: null }
    )
    .eq("profile_id", profileId);

  return { profileId, rechazada, motivo };
}

export async function setCreatorRejectedAction(formData: FormData) {
  const res = await setRechazo("creator_profiles", formData);
  if (res?.rechazada) {
    await avisarResultadoVerificacion({
      profileId: res.profileId,
      role: "creator",
      aprobada: false,
      motivo: res.motivo,
    });
  }
  revalidatePath("/ugc/admin/marketplace");
}

export async function setBrandRejectedAction(formData: FormData) {
  const res = await setRechazo("brand_profiles", formData);
  if (res?.rechazada) {
    await avisarResultadoVerificacion({
      profileId: res.profileId,
      role: "brand",
      aprobada: false,
      motivo: res.motivo,
    });
  }
  revalidatePath("/ugc/admin/marketplace");
  revalidatePath("/ugc/creador");
  revalidatePath("/ugc");
}

export async function markCampaignCompletedAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!campaignId) return;

  await supabase.from("campaigns").update({ status: "completed" }).eq("id", campaignId);

  revalidatePath("/ugc/admin/marketplace");
}
