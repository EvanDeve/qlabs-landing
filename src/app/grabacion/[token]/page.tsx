import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { nombreDeMes, horaCorta } from "@/lib/ugc/cronograma";
import { diaCorto } from "@/lib/ugc/calendar";
import CronogramaGrabacion from "@/components/ugc/CronogramaGrabacion";

export const dynamic = "force-dynamic";

/**
 * El cronograma del mes, como lo ve quien graba.
 *
 * Es el hermano de `/cronograma/[token]` y existe porque son dos lecturas
 * distintas del mismo mes: el Hero abre la suya para aprobar, y quien graba
 * abre esta para trabajar. Mezclarlas obligaba a decidir, campo por campo, qué
 * se le esconde a quién.
 *
 * Lo que cambia respecto de la del Hero:
 *
 * - **Lleva los apuntes**, que son la razón de que exista: ahí es donde el
 *   equipo escribe si el video se graba o va con voice over, y sin eso quien
 *   graba no sabe qué le toca.
 * - **No lleva los comentarios del cliente, ni aprobar, ni comentar.** Es solo
 *   de lectura: acá no se decide nada sobre el mes.
 * - **Token propio** (`crew_token`). Así el link se le puede pasar a un
 *   camarógrafo externo sin darle de paso la pantalla donde se aprueba en
 *   nombre del cliente.
 *
 * Lo que NO cambia, y por las mismas razones que allá: el token es la
 * credencial, se lee con service-role —la RLS de estas tablas es admin-only y
 * así se queda—, y la ruta vive fuera de `/ugc` y `/admin`, así que el proxy
 * ni la mira.
 */

/**
 * Los apuntes de un video: los de la tarjeta del pipeline si ya es tarjeta, y
 * si no, las notas de producción del propio cronograma.
 *
 * El orden importa y no es arbitrario. Los dos campos dicen lo mismo —si va
 * grabación o voice over— pero viven en momentos distintos: la tarjeta nace
 * recién cuando el cliente aprueba, así que antes de eso lo único que hay son
 * las notas del cronograma. Medido contra producción el 2026-08-26: 93 de 104
 * videos tienen notas del cronograma y solo 32 son tarjeta. Con la tarjeta
 * primero, después de aprobado gana lo último que escribió el equipo sobre el
 * tablero, que es donde lo sigue afinando.
 */
function apuntesDe(notasDelCronograma: string | null, apuntesDeLaTarjeta: string | null | undefined): string | null {
  return apuntesDeLaTarjeta?.trim() || notasDelCronograma?.trim() || null;
}

async function cargar(token: string) {
  // Forma antes que consulta: `crew_token` es uuid, y un token con cualquier
  // otra cosa hace fallar la consulta en Postgres —error 500— en vez de
  // devolver vacío, que es lo que corresponde a "este link no existe".
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;

  const supabase = createAdminClient();

  const { data: cronograma } = await supabase
    .from("hero_calendar_months")
    .select("hero_id, month, status")
    .eq("crew_token", token)
    .maybeSingle();

  if (!cronograma) return null;

  const [{ data: hero }, { data: videos }] = await Promise.all([
    supabase.from("agency_clients").select("name, logo_url").eq("id", cronograma.hero_id).maybeSingle(),
    supabase
      .from("calendar_month_items")
      .select("id, position, title, publish_date, publish_time, platform, script_hook, script_idea, script_desarrollo, script_cta, notes, piece_id")
      .eq("hero_id", cronograma.hero_id)
      .eq("month", cronograma.month)
      // Mismo orden que en el resto del módulo: el cronograma se lee como un
      // calendario y no como la bitácora de carga. Los que no tienen fecha van
      // últimos.
      .order("publish_date", { ascending: true, nullsFirst: false })
      .order("publish_time", { ascending: true, nullsFirst: false })
      .order("position", { ascending: true }),
  ]);

  const items = videos ?? [];

  // Los apuntes de las tarjetas, en consulta aparte y NO como embed:
  // `calendar_month_items.piece_id` no tiene FK declarada contra
  // `content_pieces`, y un embed sobre una FK que no existe hace fallar la
  // consulta entera —`data` vuelve null, sin excepción— en vez de devolver la
  // fila sin el embed.
  const pieceIds = items.map((i) => i.piece_id).filter((id): id is string => id !== null);
  const { data: tarjetas } = pieceIds.length
    ? await supabase.from("content_pieces").select("id, notes").in("id", pieceIds)
    : { data: [] };
  const apuntesPorPieza = new Map((tarjetas ?? []).map((t) => [t.id, t.notes]));

  return { cronograma, hero, items, apuntesPorPieza };
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const datos = await cargar(token);

  if (!datos) return { title: "Grabación no encontrada · Q Labs" };

  return {
    title: `Grabación de ${nombreDeMes(datos.cronograma.month)} · ${datos.hero?.name ?? "Q Labs"}`,
    // Un link privado no se indexa: quien lo tiene lo recibió, no lo buscó.
    robots: { index: false, follow: false },
  };
}

export default async function GrabacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const datos = await cargar(token);

  if (!datos) notFound();

  const { cronograma, hero, items, apuntesPorPieza } = datos;

  // Las fechas se formatean acá, en el servidor, y en día de Costa Rica. Si se
  // hicieran en el navegador saldrían en la zona de quien mire.
  const videos = items.map((v) => ({
    id: v.id,
    title: v.title,
    platform: v.platform,
    fechaLegible: v.publish_date ? diaCorto(v.publish_date) : null,
    horaLegible: horaCorta(v.publish_time),
    script_hook: v.script_hook,
    script_idea: v.script_idea,
    script_desarrollo: v.script_desarrollo,
    script_cta: v.script_cta,
    apuntes: apuntesDe(v.notes, v.piece_id ? apuntesPorPieza.get(v.piece_id) : null),
  }));

  return (
    <CronogramaGrabacion
      heroNombre={hero?.name ?? "la marca"}
      heroLogo={hero?.logo_url ?? null}
      mesLegible={nombreDeMes(cronograma.month)}
      aprobado={cronograma.status === "aprobado"}
      videos={videos}
    />
  );
}
