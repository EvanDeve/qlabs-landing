"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail, getUserEmail } from "@/lib/email/resend";
import { APPLICATION_STATUS_LABEL } from "@/lib/ugc/application-status";
import { creatorPayout } from "@/lib/ugc/payout";

export type ApplyActionState = { error: string } | null;

export async function applyToCampaignAction(
  _prevState: ApplyActionState,
  formData: FormData
): Promise<ApplyActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "");
  const pitchMessage = String(formData.get("pitch_message") ?? "").trim() || null;

  if (!campaignId) {
    return { error: "Campaña inválida." };
  }

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("verified")
    .eq("profile_id", user.id)
    .single();

  if (!creatorProfile?.verified) {
    return { error: "Tu perfil todavía está en revisión — vas a poder aplicar apenas quede verificado." };
  }

  const { error } = await supabase.from("applications").insert({
    campaign_id: campaignId,
    creator_id: user.id,
    pitch_message: pitchMessage,
  });

  if (error) {
    return {
      error: error.code === "23505"
        ? "Ya aplicaste a esta campaña."
        : "No se pudo enviar tu aplicación. Intentá de nuevo.",
    };
  }

  revalidatePath("/ugc/creador");
  revalidatePath("/ugc/creador/aplicaciones");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("title, brand_id")
    .eq("id", campaignId)
    .single();

  if (campaign) {
    const brandEmail = await getUserEmail(campaign.brand_id);
    if (brandEmail) {
      await sendTransactionalEmail(
        brandEmail,
        `Nueva aplicación a "${campaign.title}"`,
        `<p>Un creador aplicó a tu campaña <strong>${campaign.title}</strong>. Entrá a UGC·CRC para revisar su perfil y responder.</p>`
      );
    }
  }

  return null;
}

export async function updateApplicationStatusAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const applicationId = String(formData.get("application_id") ?? "");
  const campaignId = String(formData.get("campaign_id") ?? "");
  const status = formData.get("status") === "accepted" ? "accepted" : "rejected";

  if (!applicationId || !campaignId) return;

  const { data: application } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .select("creator_id")
    .single();

  revalidatePath(`/ugc/marca/campanas/${campaignId}`);
  revalidatePath("/ugc/marca/ugc");
  revalidatePath("/ugc/marca");

  if (application) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("title, budget_amount")
      .eq("id", campaignId)
      .single();

    const creatorEmail = await getUserEmail(application.creator_id);
    if (creatorEmail && campaign) {
      const extra =
        status === "accepted"
          ? ` Vas a cobrar ₡${creatorPayout(campaign.budget_amount).toLocaleString("es-CR")} cuando la marca apruebe tu entrega.`
          : "";
      await sendTransactionalEmail(
        creatorEmail,
        `Tu aplicación a "${campaign.title}" fue ${APPLICATION_STATUS_LABEL[status].toLowerCase()}`,
        `<p>Tu aplicación a <strong>${campaign.title}</strong> está ahora <strong>${APPLICATION_STATUS_LABEL[status].toLowerCase()}</strong>. Entrá a UGC·CRC para ver el detalle.${extra}</p>`
      );
    }
  }
}

export async function approveApplicationAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const applicationId = String(formData.get("application_id") ?? "");
  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!applicationId || !campaignId) return;

  const ratingRaw = Number(formData.get("rating"));
  const rating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;

  const { data: application } = await supabase
    .from("applications")
    .update({ status: "approved", rating })
    .eq("id", applicationId)
    .select("creator_id")
    .single();

  revalidatePath(`/ugc/marca/campanas/${campaignId}`);
  revalidatePath("/ugc/marca/ugc");
  revalidatePath("/ugc/creador/book");

  if (application) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("title, budget_amount")
      .eq("id", campaignId)
      .single();

    const creatorEmail = await getUserEmail(application.creator_id);
    if (creatorEmail && campaign) {
      await sendTransactionalEmail(
        creatorEmail,
        `Tu entrega en "${campaign.title}" fue aprobada`,
        `<p>La marca aprobó tu entrega en <strong>${campaign.title}</strong>. ¡Buen trabajo!</p>
         <p>La agencia va a coordinar tu pago de ₡${creatorPayout(campaign.budget_amount).toLocaleString("es-CR")}.</p>`
      );
    }
  }
}
