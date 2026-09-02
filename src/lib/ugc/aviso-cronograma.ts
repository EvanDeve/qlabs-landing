import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { sendWhatsAppFreeform } from "@/lib/whatsapp/twilio";
import { getMiembrosNotificables, ventanaAbierta } from "@/lib/ugc/recordatorios";
import { nombreDeMes } from "@/lib/ugc/cronograma";

/**
 * Avisar al equipo que el Hero tocó su cronograma.
 *
 * ⚠️ **WhatsApp no siempre se puede.** Meta solo deja mandar texto libre dentro
 * de las 24 h desde el último mensaje ENTRANTE de esa persona; fuera de esa
 * ventana hacen falta plantillas aprobadas, y hoy existe una sola (la del
 * recordatorio diario). O sea que un comentario de un Hero un domingo a la
 * noche, cuando nadie le escribió a McLovin, NO puede salir por WhatsApp.
 *
 * Por eso el aviso son dos capas y no una: la notificación in-app se crea
 * SIEMPRE —es la que garantiza que el aviso no se pierda— y el WhatsApp se
 * intenta encima, para quien tenga la ventana abierta. Confiar solo en WhatsApp
 * sería tener un aviso que falla justo los fines de semana.
 *
 * Todo es best-effort: que Twilio esté caído no puede tumbar el comentario del
 * cliente, que es lo que de verdad importa guardar.
 */

export const CRONOGRAMA_COMENTADO = "cronograma_comentado";
export const CRONOGRAMA_APROBADO = "cronograma_aprobado";

async function nombreDeHero(admin: ReturnType<typeof createAdminClient>, heroId: string): Promise<string> {
  const { data } = await admin.from("agency_clients").select("name").eq("id", heroId).maybeSingle();
  return data?.name ?? "un Hero";
}

/**
 * Crea la notificación in-app para los admins y devuelve sus ids.
 *
 * Va con service-role porque `notifications` no tiene policy de insert para
 * sesiones de usuario — y acá encima no hay sesión ninguna: quien dispara esto
 * es el Hero desde su link, que no tiene cuenta.
 */
async function avisarEnLaApp(
  admin: ReturnType<typeof createAdminClient>,
  tipo: string,
  payload: Record<string, Json>
): Promise<string[]> {
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  if (!admins?.length) return [];

  const { error } = await admin
    .from("notifications")
    .insert(admins.map((a) => ({ profile_id: a.id, type: tipo, payload })));

  if (error) console.error("[aviso-cronograma] no se pudo notificar:", error.message);
  return admins.map((a) => a.id);
}

/** WhatsApp a quien tenga la ventana abierta. Los demás ya tienen la in-app. */
async function avisarPorWhatsApp(
  admin: ReturnType<typeof createAdminClient>,
  destinatarios: string[],
  texto: string
) {
  try {
    const miembros = (await getMiembrosNotificables(admin)).filter((m) => destinatarios.includes(m.profileId));

    await Promise.allSettled(
      miembros.map(async (m) => {
        if (!(await ventanaAbierta(admin, m.profileId))) return;

        const envio = await sendWhatsAppFreeform(m.telefono, texto);

        // Se registra igual que los otros dos caminos de salida (el webhook y
        // el recordatorio diario). Antes este no dejaba rastro, y eso lo hacía
        // invisible para el chequeo de salud: el 2026-09-02 los dos avisos de
        // La Bontá quedaron trabados en Twilio sin existir en ninguna tabla
        // nuestra. Lo que no se registra no se puede vigilar.
        await admin.from("wa_messages").insert({
          profile_id: m.profileId,
          direction: "out",
          body: texto,
          provider_sid: envio.ok ? envio.sid : null,
          status: envio.ok ? "sent" : "failed",
          error: envio.ok ? null : envio.error,
        });
      })
    );
  } catch (e) {
    console.error("[aviso-cronograma] WhatsApp falló:", e instanceof Error ? e.message : e);
  }
}

export async function notificarComentarioDeHero({
  heroId,
  mes,
  tituloDelVideo,
  comentario,
}: {
  heroId: string;
  mes: string;
  tituloDelVideo: string;
  comentario: string;
}) {
  try {
    const admin = createAdminClient();
    const hero = await nombreDeHero(admin, heroId);

    const destinatarios = await avisarEnLaApp(admin, CRONOGRAMA_COMENTADO, {
      hero_id: heroId,
      hero_name: hero,
      month: mes,
      video_title: tituloDelVideo,
      comment: comentario,
    });

    // El comentario va recortado: el cuerpo de WhatsApp tiene tope, y lo que
    // el mensaje tiene que lograr es que la persona ABRA el cronograma, no
    // que reemplace la pantalla donde se atiende.
    const recorte = comentario.length > 180 ? `${comentario.slice(0, 180)}…` : comentario;

    await avisarPorWhatsApp(
      admin,
      destinatarios,
      `${hero} comentó su cronograma de ${nombreDeMes(mes)}.\n\n` +
        `En "${tituloDelVideo || "un video sin título"}":\n“${recorte}”\n\n` +
        `Está en Cronogramas, sin aprobar todavía.`
    );
  } catch (e) {
    console.error("[aviso-cronograma] comentario:", e instanceof Error ? e.message : e);
  }
}

export async function notificarAprobacionDeHero({
  heroId,
  mes,
  cantidad,
}: {
  heroId: string;
  mes: string;
  cantidad: number;
}) {
  try {
    const admin = createAdminClient();
    const hero = await nombreDeHero(admin, heroId);

    const destinatarios = await avisarEnLaApp(admin, CRONOGRAMA_APROBADO, {
      hero_id: heroId,
      hero_name: hero,
      month: mes,
      created: cantidad,
    });

    await avisarPorWhatsApp(
      admin,
      destinatarios,
      `${hero} aprobó su cronograma de ${nombreDeMes(mes)}. ✅\n\n` +
        `${cantidad} ${cantidad === 1 ? "video ya está" : "videos ya están"} en el pipeline, listos para empezar.`
    );
  } catch (e) {
    console.error("[aviso-cronograma] aprobación:", e instanceof Error ? e.message : e);
  }
}
