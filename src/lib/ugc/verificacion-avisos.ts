import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail, getUserEmail } from "@/lib/email/resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.qlabsmethod.com";

export const VERIFICATION_APPROVED = "verification_approved";

/**
 * Le avisa a la persona cómo terminó su verificación.
 *
 * Es obligatorio desde que el bloqueo es duro: antes una cuenta sin verificar
 * entraba al panel y se enteraba sola de que le habían dado el visto bueno.
 * Ahora no entra hasta que la aprueban, así que si nadie le escribe no tiene
 * forma de saber cuándo volver — se queda esperando en una pantalla.
 *
 * Best-effort, igual que los avisos al equipo: que Resend esté caído no puede
 * hacer fallar la verificación en sí, que es lo que realmente le abre la puerta.
 *
 * El rechazo va SOLO por correo: la notificación in-app vive en la campana del
 * panel, que es justo donde una cuenta rechazada no puede entrar. El motivo lo
 * muestra la pantalla de espera.
 */
export async function avisarResultadoVerificacion(opts: {
  profileId: string;
  role: "creator" | "brand";
  aprobada: boolean;
  motivo?: string | null;
}) {
  try {
    const esMarca = opts.role === "brand";
    const panelUrl = `${SITE_URL}${esMarca ? "/ugc/marca" : "/ugc/creador"}`;

    if (opts.aprobada) {
      const admin = createAdminClient();
      // Service-role: `notifications` no tiene policy de insert para sesiones de
      // usuario, y acá el destinatario es un tercero (quien fue verificado), no
      // el admin que está haciendo la acción.
      const { error } = await admin.from("notifications").insert({
        profile_id: opts.profileId,
        type: VERIFICATION_APPROVED,
        payload: { role: opts.role },
      });
      if (error) {
        console.error("[verificacion-avisos] no se pudo crear la notificación:", error.message);
      }
    }

    const email = await getUserEmail(opts.profileId);
    if (!email) return;

    if (opts.aprobada) {
      await sendTransactionalEmail(
        email,
        "Ya podés entrar a UGC·CRC",
        `<p>Verificamos tu cuenta: ya tenés acceso completo a UGC·CRC.</p>
         <p>${
           esMarca
             ? "Podés publicar tu primera campaña y empezar a recibir aplicaciones de creadores."
             : "Podés ver las promos abiertas y aplicar a las que te calcen."
         }</p>
         <p><a href="${panelUrl}">Entrar a mi panel</a></p>`
      );
    } else {
      const motivo = opts.motivo?.trim();
      await sendTransactionalEmail(
        email,
        "Sobre tu cuenta en UGC·CRC",
        `<p>Revisamos tu registro en UGC·CRC y por ahora no vamos a poder darte acceso.</p>
         ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ""}
         <p>Si creés que es un error, respondé este correo o escribinos y lo miramos de nuevo.</p>`
      );
    }
  } catch (err) {
    console.error("[verificacion-avisos] error inesperado avisando el resultado:", err);
  }
}
