import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { getMiembrosNotificables, enviarRecordatorioDiario } from "@/lib/ugc/recordatorios";
import { limpiarVoiceoversVencidos } from "@/lib/ugc/limpieza";

// Le manda el resumen del día a los miembros del equipo, y de paso hace la
// limpieza diaria.
//
// Dos modos, según cada cuánto lo pueda disparar el plan:
//   - por defecto: solo a quienes tienen `reminder_hour` == la hora actual en
//     Costa Rica. Requiere una corrida por hora (Vercel Pro o pg_cron).
//   - ?todos=1: a todos los pendientes, sin mirar la hora. Es lo correcto
//     cuando hay UN solo disparo diario (plan Hobby): filtrar por hora ahí
//     dejaría sin recordatorio a todo el que no coincida, en silencio.
// El dedupe diario de wa_messages garantiza una sola entrega por día en los dos.
//
// Hoy `vercel.json` lo dispara una vez, 13:00 UTC = 7:00 CR, con ?todos=1.
// ⚠️ Ese archivo NO admite comentarios: el schema de Vercel rechaza cualquier
// propiedad de más y el deploy entero falla. Por eso la explicación vive acá.
// Para volver a la hora por persona: pasar a Pro y usar '0 * * * *' sin el
// ?todos=1, o mover el disparo a pg_cron en Supabase.
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
  const todos = new URL(request.url).searchParams.get("todos") === "1";

  // No hay sesión en un cron: va con service-role.
  const admin = createAdminClient();
  const candidatos = await getMiembrosNotificables(admin);
  const miembros = todos ? candidatos : candidatos.filter((m) => m.reminderHour === horaCR);

  const resumen = { horaCR, todos, evaluados: miembros.length, enviados: 0, salteados: 0, fallidos: 0 };

  // En serie y no en paralelo: son menos de diez personas, y así un fallo de
  // Twilio con una no arrastra a las demás ni satura el rate limit.
  for (const miembro of miembros) {
    const resultado = await enviarRecordatorioDiario(admin, miembro, now);
    if (resultado.estado === "enviado") resumen.enviados++;
    else if (resultado.estado === "salteado") resumen.salteados++;
    else resumen.fallidos++;
  }

  // La limpieza viaja colgada de este cron y no en una entrada propia de
  // `vercel.json` por una razón concreta: el plan Hobby da 2 slots de cron, uno
  // ya está usado por esto mismo, y gastar el último en borrar archivos sería
  // quedarse sin margen para algo que de verdad lo necesite. Va después de los
  // recordatorios —lo importante primero— y su fallo no afecta al resumen.
  // Si algún día aparecen más barridos, se mueven todos a un /api/qos/cron.
  const limpieza = await limpiarVoiceoversVencidos(admin);

  return NextResponse.json({ ...resumen, limpieza });
}
