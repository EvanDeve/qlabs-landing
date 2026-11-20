import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPlatform, Database } from "@/lib/database.types";
import { traerTodas } from "@/lib/supabase/paginar";
import { diaCR } from "./calendar";
import { rangoUtcDelDia } from "./dias-habiles";
import type { VideoDeFila } from "./edicion";

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
