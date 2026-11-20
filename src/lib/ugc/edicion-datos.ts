import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPlatform, Database } from "@/lib/database.types";
import { traerTodas } from "@/lib/supabase/paginar";
import { diaCR } from "./calendar";
import { esDiaHabil, inicioDeMes, rangoUtcDelDia, sumarDiasAlDia } from "./dias-habiles";
import type { VideoDeFila } from "./edicion";
import type { EditorDelPanel, TerminadoRegistrado } from "./panel-editores";
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

export type DatosPanelEditores = {
  hoy: string;
  editores: EditorDelPanel[];
  fila: { ownerId: string; publishDate: string | null }[];
  terminados: TerminadoRegistrado[];
  disponibles: number;
  atrasadosDisponibles: number;
  /** Videos de cronogramas sin aprobar que todavía no son tarjeta, por mes (RF-30). */
  esperandoAprobacion: { mes: string; videos: number }[];
  /** El primer día con reparto; null si todavía no hubo ninguno (RF-32). */
  inicioMedicion: string | null;
};

/** RF-25..32. Lo lee un director con su sesión: la RLS de staff_members y de repartos lo exige. */
export async function getPanelEditores(supabase: Cliente, now: Date = new Date()): Promise<DatosPanelEditores> {
  const hoy = diaCR(now);
  // Desde el primero del mes anterior: es lo más viejo que muestra el panel.
  const desde = rangoUtcDelDia(inicioDeMes(sumarDiasAlDia(inicioDeMes(hoy), -1))).desde;

  const [staff, fila, terminados, disponibles, atrasados, esperando, primerReparto] = await Promise.all([
    supabase.from("staff_members").select("profile_id").eq("staff_role", "editor").eq("active", true).order("created_at"),
    traerTodas((d, h) =>
      supabase.from("videos_por_editar").select("owner_id, publish_date").not("owner_id", "is", null).order("id").range(d, h)
    ),
    traerTodas((d, h) =>
      supabase
        .from("content_pieces")
        .select("owner_id, terminado_at")
        .not("owner_id", "is", null)
        .gte("terminado_at", desde)
        .order("id")
        .range(d, h)
    ),
    supabase.from("videos_por_editar").select("id", { count: "exact", head: true }).is("owner_id", null),
    supabase.from("videos_por_editar").select("id", { count: "exact", head: true }).is("owner_id", null).lt("publish_date", hoy),
    supabase.from("videos_esperando_aprobacion").select("month, videos").order("month"),
    supabase.from("repartos_de_edicion").select("dia").order("dia").limit(1).maybeSingle(),
  ]);
  for (const [nombre, r] of [
    ["editores", staff],
    ["disponibles", disponibles],
    ["atrasados", atrasados],
    ["esperando aprobación", esperando],
    ["primer reparto", primerReparto],
  ] as const) {
    if (r.error) throw new Error(`panel de editores, ${nombre}: ${r.error.message}`);
  }

  const ids = (staff.data ?? []).map((s) => s.profile_id);
  const { data: perfiles, error: eP } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [], error: null };
  if (eP) throw new Error(`panel de editores, nombres: ${eP.message}`);
  const nombre = new Map((perfiles ?? []).map((p) => [p.id, p.display_name]));

  return {
    hoy,
    editores: ids.map((id) => ({ profileId: id, nombre: nombre.get(id) || "Sin nombre" })),
    fila: fila.map((v) => ({ ownerId: v.owner_id!, publishDate: v.publish_date })),
    terminados: terminados.map((t) => ({ ownerId: t.owner_id!, terminadoAt: t.terminado_at! })),
    disponibles: disponibles.count ?? 0,
    atrasadosDisponibles: atrasados.count ?? 0,
    esperandoAprobacion: (esperando.data ?? []).map((e) => ({ mes: e.month, videos: e.videos })),
    inicioMedicion: primerReparto.data?.dia ?? null,
  };
}
