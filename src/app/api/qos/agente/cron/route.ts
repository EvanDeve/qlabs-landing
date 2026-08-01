import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { getMiembrosNotificables, enviarRecordatorioDiario } from "@/lib/ugc/recordatorios";

// Corre cada hora y le manda el resumen a los miembros cuya `reminder_hour`
// coincide con la hora local de Costa Rica en este momento.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Sin esto la URL es un botón público para spamearle WhatsApps al equipo.
  // Va primero que todo, antes de tocar la base.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[agente/cron] falta CRON_SECRET — el endpoint queda cerrado");
    return NextResponse.json({ error: "no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const now = new Date();
  const horaCR = Number(formatInTimeZone(now, COSTA_RICA_TZ, "H"));

  // No hay sesión en un cron: va con service-role.
  const admin = createAdminClient();
  const miembros = (await getMiembrosNotificables(admin)).filter((m) => m.reminderHour === horaCR);

  const resumen = { horaCR, evaluados: miembros.length, enviados: 0, salteados: 0, fallidos: 0 };

  // En serie y no en paralelo: son menos de diez personas, y así un fallo de
  // Twilio con una no arrastra a las demás ni satura el rate limit.
  for (const miembro of miembros) {
    const resultado = await enviarRecordatorioDiario(admin, miembro, now);
    if (resultado.estado === "enviado") resumen.enviados++;
    else if (resultado.estado === "salteado") resumen.salteados++;
    else resumen.fallidos++;
  }

  return NextResponse.json(resumen);
}
