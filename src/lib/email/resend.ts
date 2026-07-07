import { createAdminClient } from "@/lib/supabase/admin";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "UGC·CRC <onboarding@resend.dev>";

// Best-effort: notificaciones in-app (triggers de DB) son la fuente de verdad.
// Si falta RESEND_API_KEY o el envío falla, no rompemos el flujo del usuario.
export async function sendTransactionalEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[resend] RESEND_API_KEY no configurada — email no enviado: "${subject}"`);
    return;
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
    }
  } catch (err) {
    console.error("[resend] error de red al enviar email:", err);
  }
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}
