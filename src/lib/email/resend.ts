import { createAdminClient } from "@/lib/supabase/admin";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "UGC·CRC <onboarding@resend.dev>";

// Best-effort para los avisos: las notificaciones in-app (triggers de DB) son la
// fuente de verdad, así que si falta RESEND_API_KEY o el envío falla no rompemos
// el flujo del usuario.
//
// Devuelve si el correo salió. Casi ningún llamador mira el resultado —a
// propósito—, pero el reset de contraseña sí: ahí el correo ES el flujo, no un
// aviso al costado, y fallar en silencio deja a la persona esperando para
// siempre un mail que nunca se mandó.
export async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[resend] RESEND_API_KEY no configurada — email no enviado: "${subject}"`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      console.error("[resend] fallo al enviar email:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[resend] error de red al enviar email:", err);
    return false;
  }
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}
