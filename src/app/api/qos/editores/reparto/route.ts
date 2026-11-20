import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ejecutarReparto } from "@/lib/ugc/edicion-datos";

// El reparto de la mañana de los editores (spec 003): le completa a cada
// editor activo hasta 8 videos en su fila, sacando de Por editar los que no
// tienen responsable.
//
// Horario: `vercel.json` lo dispara con '0 12 * * 1-5' = 12:00 UTC, que es
// 6:00 en Costa Rica (CR no tiene horario de verano), de lunes a viernes. El
// plan Hobby dispara dentro de la hora, así que corre entre las 6:00 y las
// 6:59. Es el segundo y último cron que permite Hobby; si hiciera falta el
// slot, la alternativa es llamar a ejecutarReparto al principio de
// /api/qos/agente/cron (7:00) sin cambiar nada más.
// ⚠️ `vercel.json` NO admite comentarios: la explicación vive acá.
//
// Se puede llamar más de una vez el mismo día: la rpc es idempotente por día
// y la segunda devuelve "ya-repartido". Un sábado o domingo devuelve
// "no-habil" sin tocar la base.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Va primero que todo: sin esto la URL le reparte tarjetas a cualquiera que la llame.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[editores/reparto] falta CRON_SECRET — el endpoint queda cerrado");
    return NextResponse.json({ error: "no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  try {
    const resultado = await ejecutarReparto(createAdminClient());
    console.log("[editores/reparto]", JSON.stringify(resultado));
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[editores/reparto] falló:", error);
    return NextResponse.json({ error: "falló el reparto" }, { status: 500 });
  }
}
