import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { nombreDeMes, horaCorta } from "@/lib/ugc/cronograma";
import { diaCorto } from "@/lib/ugc/calendar";
import CronogramaPublico from "@/components/ugc/CronogramaPublico";

export const dynamic = "force-dynamic";

/**
 * El cronograma del mes, como lo ve el Hero.
 *
 * Es la única ruta del proyecto que existe sin sesión y puede escribir. Lo que
 * la sostiene:
 *
 * - **El token es la credencial.** El Hero no tiene cuenta (`agency_clients` es
 *   una tabla plana), así que lo que autoriza es conocer la URL. Por eso desde
 *   acá solo se puede leer, comentar y aprobar — nunca editar.
 * - **Lee con service-role y no con la sesión anónima.** La RLS de estas tablas
 *   sigue siendo admin-only y así se queda: abrirlas a `anon` expondría TODOS
 *   los cronogramas de TODOS los Heroes a cualquiera con la anon key, que viaja
 *   en el bundle de cualquier navegador. Acá el filtro por token lo hace este
 *   archivo, del lado del servidor.
 * - **El middleware no la toca**: `PROTECTED_PREFIXES` no incluye
 *   `/ugc/cronograma`, y compara por segmento.
 */

async function cargar(token: string) {
  // Forma antes que consulta: `share_token` es uuid, y un token con cualquier
  // otra cosa hace fallar la consulta en Postgres —error 500— en vez de
  // devolver vacío, que es lo que corresponde a "este link no existe".
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;

  const supabase = createAdminClient();

  const { data: cronograma } = await supabase
    .from("hero_calendar_months")
    .select("hero_id, month, status, approved_at, approved_by")
    .eq("share_token", token)
    .maybeSingle();

  if (!cronograma) return null;

  const [{ data: hero }, { data: videos }] = await Promise.all([
    supabase.from("agency_clients").select("name, logo_url").eq("id", cronograma.hero_id).maybeSingle(),
    supabase
      .from("calendar_month_items")
      .select("id, position, title, publish_date, publish_time, platform, script_hook, script_idea, script_desarrollo, script_cta, client_comment")
      .eq("hero_id", cronograma.hero_id)
      .eq("month", cronograma.month)
      // El cronograma se lee como un calendario y no como la bitácora de carga:
      // el orden lo manda la fecha de publicación, con la hora de desempate y
      // la posición de creación al final para que dos videos del mismo momento
      // no se intercambien entre recargas. Los que todavía no tienen fecha van
      // últimos: son justo los que faltan por definir.
      .order("publish_date", { ascending: true, nullsFirst: false })
      .order("publish_time", { ascending: true, nullsFirst: false })
      .order("position", { ascending: true }),
  ]);

  return { cronograma, hero, videos: videos ?? [] };
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const datos = await cargar(token);

  if (!datos) return { title: "Cronograma no encontrado · Q Labs" };

  return {
    title: `Cronograma de ${nombreDeMes(datos.cronograma.month)} · ${datos.hero?.name ?? "Q Labs"}`,
    // Un link privado no se indexa: quien lo tiene lo recibió, no lo buscó.
    robots: { index: false, follow: false },
  };
}

export default async function CronogramaPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const datos = await cargar(token);

  if (!datos) notFound();

  const { cronograma, hero, videos } = datos;
  const aprobado = cronograma.status === "aprobado";

  // Las fechas se formatean acá, en el servidor, y en día de Costa Rica. Si se
  // hicieran en el navegador saldrían en la zona de quien mire — y el Hero
  // podría estar viendo su cronograma desde otro país.
  const conFecha = videos.map((v) => ({
    ...v,
    fechaLegible: v.publish_date ? diaCorto(v.publish_date) : null,
    horaLegible: horaCorta(v.publish_time),
  }));

  return (
    <CronogramaPublico
      token={token}
      heroNombre={hero?.name ?? "tu marca"}
      heroLogo={hero?.logo_url ?? null}
      mesLegible={nombreDeMes(cronograma.month)}
      aprobado={aprobado}
      aprobadoPorCliente={cronograma.approved_by === "cliente"}
      videos={conFecha}
    />
  );
}
