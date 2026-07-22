"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail, getUserEmail } from "@/lib/email/resend";
import { DELIVERIES_BUCKET, MAX_DELIVERY_FILE_BYTES } from "@/lib/ugc/deliveries";

export type SubmitDeliveryState = { error: string } | null;

export async function submitDeliveryAction(
  _prevState: SubmitDeliveryState,
  formData: FormData
): Promise<SubmitDeliveryState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ugc/login");
  }

  const applicationId = String(formData.get("application_id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const file = formData.get("file");
  const externalUrl = String(formData.get("external_url") ?? "").trim() || null;

  if (!applicationId) {
    return { error: "Aplicación inválida." };
  }

  const { data: application } = await supabase
    .from("applications")
    .select("id, campaign_id, status")
    .eq("id", applicationId)
    .eq("creator_id", user.id)
    .single();

  if (!application || !["accepted", "delivered"].includes(application.status)) {
    return { error: "No podés entregar en esta aplicación." };
  }

  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !externalUrl) {
    return { error: "Subí un archivo, pegá un link, o ambos." };
  }

  if (externalUrl) {
    try {
      new URL(externalUrl);
    } catch {
      return { error: "El link no es una URL válida." };
    }
  }

  let storagePath: string | null = null;

  if (hasFile) {
    const uploadedFile = file as File;
    if (uploadedFile.size > MAX_DELIVERY_FILE_BYTES) {
      return { error: "El archivo pesa más de 200MB." };
    }
    const extension = uploadedFile.name.includes(".") ? uploadedFile.name.split(".").pop() : "bin";
    storagePath = `${applicationId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(DELIVERIES_BUCKET)
      .upload(storagePath, uploadedFile, { contentType: uploadedFile.type });

    if (uploadError) {
      return { error: "No se pudo subir el archivo. Intentá de nuevo." };
    }
  }

  // El creador puede entregar el archivo crudo y el link del post ya
  // publicado en la misma tanda — cada uno se guarda como su propia fila,
  // application_deliveries siempre soportó múltiples piezas por aplicación.
  const rows = [
    ...(storagePath
      ? [{ application_id: applicationId, creator_id: user.id, kind: "file" as const, storage_path: storagePath, external_url: null, note }]
      : []),
    ...(externalUrl
      ? [{ application_id: applicationId, creator_id: user.id, kind: "link" as const, storage_path: null, external_url: externalUrl, note }]
      : []),
  ];

  const { error: insertError } = await supabase.from("application_deliveries").insert(rows);

  if (insertError) {
    if (storagePath) {
      await supabase.storage.from(DELIVERIES_BUCKET).remove([storagePath]);
    }
    return { error: "No se pudo guardar la entrega. Intentá de nuevo." };
  }

  if (application.status !== "delivered") {
    await supabase.from("applications").update({ status: "delivered" }).eq("id", applicationId);
  }

  revalidatePath("/ugc/creador/aplicaciones");
  revalidatePath(`/ugc/marca/campanas/${application.campaign_id}`);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("title, brand_id, budget_amount")
    .eq("id", application.campaign_id)
    .single();

  if (campaign) {
    const brandEmail = await getUserEmail(campaign.brand_id);
    if (brandEmail) {
      await sendTransactionalEmail(
        brandEmail,
        `Nueva entrega en "${campaign.title}"`,
        `<p>El creador subió una pieza en <strong>${campaign.title}</strong>. Entrá a UGC·CRC para revisarla.</p>
         <p>Si todo está bien, aprobala para que sigamos con el pago de ₡${campaign.budget_amount.toLocaleString("es-CR")} a la agencia.</p>`
      );
    }
  }

  return null;
}
