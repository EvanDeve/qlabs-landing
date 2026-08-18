import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { leerBusqueda, buscarEnElTablero, vale, TOPE_RESULTADOS } from "@/lib/ugc/busqueda";

/**
 * La búsqueda contra el tablero REAL.
 *
 * Los tests unitarios prueban qué palabras salen de un mensaje; esto prueba que
 * con esas palabras vuelva lo que uno espera de las 141 tarjetas que hay. Es lo
 * que encontró que "¿en qué anda lo de Zonna?" contestaba con cuatro tarjetas
 * publicadas del 6 de agosto — cierto, inútil, y llenaba el cupo.
 *
 * Solo lee. Las afirmaciones son sobre la FORMA del resultado y no sobre datos
 * concretos, así que no se rompen cuando el equipo mueve el tablero.
 */
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function contexto() {
  const [{ data: heroes }, { data: columnas }] = await Promise.all([
    admin.from("agency_clients").select("id, name"),
    admin.from("content_columns").select("id, name, is_done"),
  ]);
  return {
    heroes: heroes ?? [],
    columnas: columnas ?? [],
    ctx: {
      yaEnAgenda: new Set<string>(),
      heroePorId: new Map((heroes ?? []).map((h) => [h.id, h.name])),
      columnaPorId: new Map((columnas ?? []).map((c) => [c.id, c.name])),
      columnasFinales: new Set((columnas ?? []).filter((c) => c.is_done).map((c) => c.id)),
    },
  };
}

describe("buscar en el tablero real", () => {
  it("nombrar un Hero trae sus tarjetas y solo las suyas", async () => {
    const { heroes, columnas, ctx } = await contexto();
    const hero = heroes[0];

    const busqueda = leerBusqueda(`en qué anda lo de ${hero.name}?`, heroes, columnas);
    expect(busqueda.heroIds).toContain(hero.id);

    const encontradas = await buscarEnElTablero(admin, busqueda, ctx);
    for (const item of encontradas) expect(item.heroe).toBe(hero.name);
  });

  // El bug que este archivo vino a cazar: el cupo se llenaba con lo ya publicado
  // y lo que se estaba haciendo quedaba afuera.
  it("lo que sigue abierto va antes que lo ya cerrado", async () => {
    const { heroes, columnas, ctx } = await contexto();

    const busqueda = leerBusqueda(`qué hay de ${heroes[0].name}`, heroes, columnas);
    const encontradas = await buscarEnElTablero(admin, busqueda, ctx);

    // Se resuelve por el ID de la columna y NUNCA por su nombre. La primera
    // versión de este test miraba el nombre y falló: hay dos columnas llamadas
    // "Terminado" —la de IT cierra el carril, la de video no— así que daba por
    // cerradas un montón de tarjetas que estaban en curso. Es exactamente la
    // trampa contra la que existen las banderas (ver 20260727200000).
    const ids = encontradas.map((i) => (i.ref.kind === "piece" ? i.ref.pieceId : "")).filter(Boolean);
    const { data: piezas } = await admin.from("content_pieces").select("id, column_id").in("id", ids);
    const columnaDePieza = new Map((piezas ?? []).map((p) => [p.id, p.column_id]));

    const estados = encontradas.map((i) => {
      const columnId = i.ref.kind === "piece" ? columnaDePieza.get(i.ref.pieceId) : undefined;
      return columnId && ctx.columnasFinales.has(columnId) ? "cerrada" : "abierta";
    });

    // Dicho como se piensa: desde la primera cerrada, todo lo que sigue está
    // cerrado. Ninguna abierta puede quedar detrás de una cerrada.
    const primeraCerrada = estados.indexOf("cerrada");
    if (primeraCerrada !== -1) {
      expect(estados.slice(primeraCerrada)).toEqual(estados.slice(primeraCerrada).map(() => "cerrada"));
    }
  });

  it("nombrar una columna trae lo que está parado ahí", async () => {
    const { heroes, columnas, ctx } = await contexto();
    const columna = columnas.find((c) => !c.is_done)!;

    const busqueda = leerBusqueda(`qué hay en ${columna.name}`, heroes, columnas);
    expect(busqueda.columnaIds).toContain(columna.id);

    const encontradas = await buscarEnElTablero(admin, busqueda, ctx);
    for (const item of encontradas) expect(item.columna).toBe(columna.name);
  });

  it("nunca devuelve más que el tope, por más que calce medio tablero", async () => {
    const { heroes, columnas, ctx } = await contexto();
    const busqueda = leerBusqueda(
      `${heroes.map((h) => h.name).join(" ")} ${columnas.map((c) => c.name).join(" ")}`,
      heroes,
      columnas
    );
    const encontradas = await buscarEnElTablero(admin, busqueda, ctx);
    expect(encontradas.length).toBeLessThanOrEqual(TOPE_RESULTADOS);
  });

  it("un mensaje sin nada que buscar no toca la base", async () => {
    const { heroes, columnas } = await contexto();
    expect(vale(leerBusqueda("dale, gracias mae", heroes, columnas))).toBe(false);
  });
});
