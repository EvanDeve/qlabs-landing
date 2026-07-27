import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail, getUserEmail } from "@/lib/email/resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.qlabsmethod.com";
const MARKETPLACE_URL = `${SITE_URL}/ugc/admin/marketplace`;

export const VERIFICATION_PENDING = "verification_pending";

export type PendingVerification = {
  profileId: string;
  role: "creator" | "brand";
  /** Handle del creador (con @) o nombre de la marca. */
  name: string;
  /** Ciudad del creador o industria de la marca. Solo para dar contexto en el aviso. */
  detail: string | null;
};

/**
 * Avisa a todo el equipo de que alguien terminó el registro y quedó esperando
 * verificación. Sin esto un registro real cae en el vacío: la verificación es
 * un bloqueo duro (una marca sin verificar no puede publicar, un creador sin
 * verificar no puede aplicar) y nadie se enteraba de que había alguien
 * esperando del otro lado.
 *
 * Se llama desde el onboarding y es best-effort a propósito — que Resend esté
 * caído o que no haya admins cargados nunca puede tumbar el registro de un
 * usuario. Los errores se loguean, no se propagan.
 *
 * Usa el cliente service-role porque `notifications` no tiene policy de insert
 * para sesiones de usuario: las filas las crean triggers o el servidor, y acá
 * el destinatario es un tercero (el admin), no quien está haciendo la acción.
 */
export async function notifyAdminsOfPendingVerification(subject: PendingVerification) {
  try {
    const admin = createAdminClient();

    const { data: admins, error: adminsError } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminsError) {
      console.error("[admin-alerts] no se pudo listar admins:", adminsError.message);
      return;
    }
    if (!admins?.length) {
      console.warn("[admin-alerts] no hay ningún admin al que avisar");
      return;
    }

    const isBrand = subject.role === "brand";
    const roleLabel = isBrand ? "marca" : "creador";
    const blockedFrom = isBrand ? "publicar campañas" : "aplicar a campañas";

    const { error: notifyError } = await admin.from("notifications").insert(
      admins.map((a) => ({
        profile_id: a.id,
        type: VERIFICATION_PENDING,
        payload: {
          subject_profile_id: subject.profileId,
          subject_role: subject.role,
          subject_name: subject.name,
          subject_detail: subject.detail,
        },
      }))
    );

    if (notifyError) {
      console.error("[admin-alerts] no se pudieron crear las notificaciones:", notifyError.message);
    }

    const detailLine = subject.detail ? `<p>${isBrand ? "Industria" : "Ciudad"}: ${subject.detail}</p>` : "";

    await Promise.allSettled(
      admins.map(async (a) => {
        const email = await getUserEmail(a.id);
        if (!email) return;
        await sendTransactionalEmail(
          email,
          `Nueva ${roleLabel} esperando verificación: ${subject.name}`,
          `<p><strong>${subject.name}</strong> terminó su registro en UGC·CRC como ${roleLabel} y está esperando verificación.</p>
           ${detailLine}
           <p>Hasta que alguien la verifique no puede ${blockedFrom}.</p>
           <p><a href="${MARKETPLACE_URL}">Revisar y verificar</a></p>`
        );
      })
    );
  } catch (err) {
    console.error("[admin-alerts] error inesperado avisando de verificación pendiente:", err);
  }
}
