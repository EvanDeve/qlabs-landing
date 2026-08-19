"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail, getUserEmail } from "@/lib/email/resend";

export type ConflictActionState = { error: string } | null;

// Cancelar y disputar los pueden disparar tanto el creador como la marca. Quién
// tiene permiso para qué transición lo decide el trigger
// enforce_application_transition en la base; acá solo se traduce la negación
// cruda de Postgres a algo legible y se avisa a la contraparte.

type Parte = "creator" | "brand";

async function cargarContexto(applicationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ugc/login");

  const { data: application } = await supabase
    .from("applications")
    .select("id, status, creator_id, campaign_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) return null;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title, brand_id")
    .eq("id", application.campaign_id)
    .maybeSingle();

  const parte: Parte | null =
    application.creator_id === user.id
      ? "creator"
      : campaign?.brand_id === user.id
        ? "brand"
        : null;

  return { supabase, user, application, campaign, parte };
}

function revalidarAmbosLados(campaignId: string) {
  revalidatePath("/ugc/creador/aplicaciones");
  revalidatePath("/ugc/marca/ugc");
  revalidatePath(`/ugc/marca/campanas/${campaignId}`);
  revalidatePath("/admin/marketplace");
}

export async function cancelApplicationAction(
  _prev: ConflictActionState,
  formData: FormData
): Promise<ConflictActionState> {
  const applicationId = String(formData.get("application_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!applicationId) return { error: "Falta la aplicación." };
  if (reason.length < 10) {
    return { error: "Contá en una línea por qué cancelás — la otra parte va a leerlo." };
  }

  const ctx = await cargarContexto(applicationId);
  if (!ctx || !ctx.parte) return { error: "No encontramos esa colaboración." };
  const { supabase, user, application, campaign, parte } = ctx;

  if (application.status !== "accepted") {
    return {
      error:
        application.status === "delivered"
          ? "Ya hay una entrega, así que esto no se cancela: reportá un problema y lo resolvemos nosotros."
          : "Esta colaboración ya no está activa.",
    };
  }

  const { error } = await supabase
    .from("applications")
    .update({
      status: "cancelled",
      conflict_reason: reason,
      conflict_by: user.id,
      conflict_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) return { error: "No se pudo cancelar. Intentá de nuevo." };

  revalidarAmbosLados(application.campaign_id);

  // Avisarle a la contraparte: es el punto de todo esto, que nadie quede
  // esperando una entrega que ya no va a llegar.
  const destinatario = parte === "creator" ? campaign?.brand_id : application.creator_id;
  if (destinatario && campaign) {
    const email = await getUserEmail(destinatario);
    if (email) {
      const quien = parte === "creator" ? "El creador" : "La marca";
      await sendTransactionalEmail(
        email,
        `Se canceló la colaboración en "${campaign.title}"`,
        `<p>${quien} canceló la colaboración en <strong>${campaign.title}</strong>.</p>
         <p><strong>Motivo:</strong> ${reason}</p>
         <p>La campaña sigue publicada, así que podés seguir adelante con otros creadores.</p>`
      );
    }
  }

  return null;
}

export async function disputeApplicationAction(
  _prev: ConflictActionState,
  formData: FormData
): Promise<ConflictActionState> {
  const applicationId = String(formData.get("application_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!applicationId) return { error: "Falta la aplicación." };
  if (reason.length < 10) {
    return { error: "Explicá qué pasó — Q Labs va a leer esto para resolver." };
  }

  const ctx = await cargarContexto(applicationId);
  if (!ctx || !ctx.parte) return { error: "No encontramos esa colaboración." };
  const { supabase, user, application, campaign } = ctx;

  if (application.status !== "delivered") {
    return { error: "Solo se puede reportar un problema sobre una entrega ya hecha." };
  }

  const { error } = await supabase
    .from("applications")
    .update({
      status: "disputed",
      conflict_reason: reason,
      conflict_by: user.id,
      conflict_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) return { error: "No se pudo reportar el problema. Intentá de nuevo." };

  revalidarAmbosLados(application.campaign_id);

  // Al admin le llega por la campana vía trigger (notify_admins_on_dispute).
  // Acá solo se le avisa a la contraparte que el caso quedó abierto.
  const destinatario =
    ctx.parte === "creator" ? campaign?.brand_id : application.creator_id;
  if (destinatario && campaign) {
    const email = await getUserEmail(destinatario);
    if (email) {
      await sendTransactionalEmail(
        email,
        `Se abrió un caso en "${campaign.title}"`,
        `<p>Se reportó un problema con la entrega de <strong>${campaign.title}</strong>.</p>
         <p><strong>Motivo:</strong> ${reason}</p>
         <p>Q Labs va a revisarlo y les escribe a los dos. El pago queda en pausa hasta que se resuelva.</p>`
      );
    }
  }

  return null;
}

/** Solo Q Labs. Cierra una disputa aprobando la entrega o cancelando la colaboración. */
export async function resolveDisputeAction(
  _prev: ConflictActionState,
  formData: FormData
): Promise<ConflictActionState> {
  const applicationId = String(formData.get("application_id") ?? "");
  const decision = formData.get("decision") === "approve" ? "approved" : "cancelled";
  const note = String(formData.get("admin_note") ?? "").trim();

  if (!applicationId) return { error: "Falta la aplicación." };
  if (note.length < 10) return { error: "Escribí cómo se resolvió: queda como registro del caso." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ugc/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Solo Q Labs puede resolver una disputa." };

  const { data: application } = await supabase
    .from("applications")
    .select("id, status, creator_id, campaign_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) return { error: "No encontramos esa colaboración." };
  if (application.status !== "disputed") return { error: "Esa colaboración no está en disputa." };

  const { error } = await supabase
    .from("applications")
    .update({ status: decision, admin_note: note })
    .eq("id", applicationId);

  if (error) return { error: "No se pudo resolver. Intentá de nuevo." };

  revalidarAmbosLados(application.campaign_id);
  revalidatePath("/admin/disputas");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("title, brand_id")
    .eq("id", application.campaign_id)
    .maybeSingle();

  // Les escribe a los dos: una resolución que solo ve una parte no cierra nada.
  for (const destinatario of [application.creator_id, campaign?.brand_id]) {
    if (!destinatario || !campaign) continue;
    const email = await getUserEmail(destinatario);
    if (!email) continue;
    await sendTransactionalEmail(
      email,
      `Se resolvió el caso de "${campaign.title}"`,
      `<p>Q Labs revisó el caso de <strong>${campaign.title}</strong>.</p>
       <p><strong>Resolución:</strong> ${decision === "approved" ? "la entrega se da por aprobada" : "la colaboración se cancela"}.</p>
       <p>${note}</p>`
    );
  }

  return null;
}
