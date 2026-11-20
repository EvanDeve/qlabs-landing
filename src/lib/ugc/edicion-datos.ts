import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPlatform, Database } from "@/lib/database.types";
import { traerTodas } from "@/lib/supabase/paginar";
import { diaCR } from "./calendar";
import { esDiaHabil, rangoUtcDelDia } from "./dias-habiles";
import type { VideoDeFila } from "./edicion";
import { repartir } from "./reparto";

/*
 * Lo que habla con la base para la spec 003. Las decisiones viven en las
 * funciones puras (edicion.ts, reparto.ts, panel-editores.ts); acá solo se
 * trae y se da forma. "Ahora" entra por parámetro para poder probar un sábado.
 */

type Cliente = SupabaseClient<Database>;

export type TerminadoDeHoy = {
  id: string;
  titulo: string;
  cliente: string | null;
  plataforma: ContentPlatform;
  terminadoAt: string;
};

export type DatosVistaEditor = {
  hoy: string;
  fila: VideoDeFila[];
  terminadosHoy: TerminadoDeHoy[];
  disponibles: number;
};

async function nombresDeHeroes(supabase: Cliente, ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unicos.length === 0) return new Map();
  const { data, error } = await supabase.from("agency_clients").select("id, name").in("id", unicos);
  if (error) throw new Error(`nombres de Heroes: ${error.message}`);
  return new Map((data ?? []).map((h) => [h.id, h.name]));
}

/** RF-14, RF-16, RF-18, RF-20: la fila del editor, lo que terminó hoy y cuántos hay disponibles. */
export async function getVistaEditor(supabase: Cliente, profileId: string, now: Date = new Date()): Promise<DatosVistaEditor> {
  const hoy = diaCR(now);
  const { desde, hasta } = rangoUtcDelDia(hoy);

  const [fila, terminados, disponibles] = await Promise.all([
    traerTodas((d, h) =>
      supabase
        .from("videos_por_editar")
        .select("id, title, brand_id, publish_date, publish_time, platform, recorded_at, created_at")
        .eq("owner_id", profileId)
        .order("id")
        .range(d, h)
    ),
    supabase
      .from("content_pieces")
      .select("id, title, brand_id, platform, terminado_at")
      .eq("owner_id", profileId)
      .gte("terminado_at", desde)
      .lt("terminado_at", hasta)
      .order("terminado_at", { ascending: false }),
    supabase.from("videos_por_editar").select("id", { count: "exact", head: true }).is("owner_id", null),
  ]);
  if (terminados.error) throw new Error(`terminados de hoy: ${terminados.error.message}`);
  if (disponibles.error) throw new Error(`disponibles: ${disponibles.error.message}`);

  const nombres = await nombresDeHeroes(supabase, [
    ...fila.map((v) => v.brand_id),
    ...(terminados.data ?? []).map((t) => t.brand_id),
  ]);
  const cliente = (id: string | null) => (id ? nombres.get(id) ?? null : null);

  return {
    hoy,
    fila: fila.map((v) => ({
      id: v.id,
      titulo: v.title,
      cliente: cliente(v.brand_id),
      publishDate: v.publish_date,
      publishTime: v.publish_time,
      createdAt: v.created_at,
      plataforma: v.platform,
      grabado: v.recorded_at !== null,
    })),
    terminadosHoy: (terminados.data ?? []).map((t) => ({
      id: t.id,
      titulo: t.title,
      cliente: cliente(t.brand_id),
      plataforma: t.platform,
      terminadoAt: t.terminado_at!,
    })),
    disponibles: disponibles.count ?? 0,
  };
}

export type ResultadoDelReparto = {
  dia: string;
  estado: "no-habil" | "ya-repartido" | "repartido";
  /** Las asignaciones que decidió repartir(). */
  pedidas: number;
  /** Las que la rpc de verdad aplicó: si alguien tomó una en el medio, se saltea. */
  asignados: number;
};

/**
 * El reparto de la mañana (RF-04..12). Lo llama el cron con service role.
 * Lee el estado, decide con repartir() y aplica con la rpc, que es atómica e
 * idempotente por día: dos crons que se pisan no reparten doble (RF-11).
 */
export async function ejecutarReparto(admin: Cliente, now: Date = new Date()): Promise<ResultadoDelReparto> {
  const dia = diaCR(now);
  // RF-12: el cron ya corre solo de lunes a viernes; esto cubre una llamada a mano.
  if (!esDiaHabil(dia)) return { dia, estado: "no-habil", pedidas: 0, asignados: 0 };

  const { data: yaHecho, error: eHecho } = await admin.from("repartos_de_edicion").select("dia").eq("dia", dia).maybeSingle();
  if (eHecho) throw new Error(`repartos_de_edicion: ${eHecho.message}`);
  if (yaHecho) return { dia, estado: "ya-repartido", pedidas: 0, asignados: 0 };

  // El orden de created_at es el orden fijo de desempate (RF-07): el que entró antes, primero.
  const { data: editores, error: eEd } = await admin
    .from("staff_members")
    .select("profile_id")
    .eq("staff_role", "editor")
    .eq("active", true)
    .order("created_at");
  if (eEd) throw new Error(`editores: ${eEd.message}`);

  const videos = await traerTodas((d, h) =>
    admin
      .from("videos_por_editar")
      .select("id, owner_id, publish_date, publish_time, created_at")
      .order("id")
      .range(d, h)
  );

  const pendientes = new Map<string, number>();
  for (const v of videos) if (v.owner_id) pendientes.set(v.owner_id, (pendientes.get(v.owner_id) ?? 0) + 1);

  const asignaciones = repartir(
    (editores ?? []).map((e) => ({ profileId: e.profile_id, pendientes: pendientes.get(e.profile_id) ?? 0 })),
    videos
      .filter((v) => v.owner_id === null)
      .map((v) => ({ id: v.id, publishDate: v.publish_date, publishTime: v.publish_time, createdAt: v.created_at }))
  );

  const { data: asignados, error: eRpc } = await admin.rpc("aplicar_reparto_de_edicion", {
    p_dia: dia,
    p_asignaciones: asignaciones.map((a) => ({ piece_id: a.pieceId, owner_id: a.ownerId })),
  });
  if (eRpc) throw new Error(`aplicar_reparto_de_edicion: ${eRpc.message}`);

  // Si otro cron ganó la carrera entre la lectura y la rpc, la rpc devuelve 0
  // sin tocar nada; en el log se ve como pedidas > 0 y asignados 0.
  return { dia, estado: "repartido", pedidas: asignaciones.length, asignados: asignados ?? 0 };
}
