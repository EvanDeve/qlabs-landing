import { describe, it, expect } from "vitest";
import {
  clasificar,
  getStaffAgenda,
  resumenDeterminista,
  contarAgenda,
  DIAS_PROXIMAS,
  type AgendaItem,
} from "@/lib/ugc/agenda";

// La agenda es lo único del agente de WhatsApp con lógica propia: el resto son
// llamadas a APIs. Y el error que más caro sale acá no se ve mirando la
// pantalla — es la zona horaria, porque en local suele coincidir con la de
// Costa Rica y todo parece andar.

function item(parcial: Partial<AgendaItem> & { fecha: string }): AgendaItem {
  return {
    key: parcial.key ?? `k-${parcial.fecha}`,
    ref: parcial.ref ?? { kind: "event", eventId: "e1" },
    titulo: parcial.titulo ?? "Algo",
    heroe: parcial.heroe ?? null,
    // Por defecto un evento, que sí tiene hora. Las piezas van con conHora:false.
    conHora: parcial.conHora ?? true,
    accion: parcial.accion ?? "Reunión",
    prioridad: parcial.prioridad ?? null,
    fecha: parcial.fecha,
  };
}

const RANGO = { hoy: "2026-08-02", desde: "2026-07-03", hasta: "2026-08-05" };

describe("clasificar", () => {
  // Costa Rica es UTC-6. Un compromiso de las 23:30 del domingo se guarda como
  // las 05:30Z del lunes: comparando en UTC se iría al recordatorio del lunes,
  // cuando ya pasó. Es el caso que justifica todo el manejo de zona horaria.
  it("las 23:30 hora tica siguen siendo HOY aunque en UTC ya sea mañana", () => {
    const agenda = clasificar([item({ fecha: "2026-08-03T05:30:00Z" })], RANGO);

    expect(agenda.hoy).toHaveLength(1);
    expect(agenda.proximas).toHaveLength(0);
  });

  it("las 00:00 hora tica del día siguiente ya son próximas", () => {
    const agenda = clasificar([item({ fecha: "2026-08-03T06:00:00Z" })], RANGO);

    expect(agenda.hoy).toHaveLength(0);
    expect(agenda.proximas).toHaveLength(1);
  });

  it("reparte en vencidas, hoy y próximas", () => {
    const agenda = clasificar(
      [
        item({ key: "vieja", fecha: "2026-07-30T15:00:00Z" }),
        item({ key: "hoy", fecha: "2026-08-02T15:00:00Z" }),
        item({ key: "pronto", fecha: "2026-08-04T15:00:00Z" }),
      ],
      RANGO
    );

    expect(agenda.vencidas.map((i) => i.key)).toEqual(["vieja"]);
    expect(agenda.hoy.map((i) => i.key)).toEqual(["hoy"]);
    expect(agenda.proximas.map((i) => i.key)).toEqual(["pronto"]);
  });

  // El corte existe para que el mensaje diario no arrastre para siempre lo que
  // se atrasó hace meses. Si esto se rompe, el recordatorio se vuelve ilegible
  // y la gente deja de leerlo — que es el único modo real de que falle.
  it("deja afuera lo que cae fuera del rango, por viejo o por lejano", () => {
    const agenda = clasificar(
      [
        item({ key: "antiquísima", fecha: "2026-05-01T15:00:00Z" }),
        item({ key: "lejana", fecha: "2026-09-01T15:00:00Z" }),
      ],
      RANGO
    );

    expect(contarAgenda(agenda)).toBe(0);
  });

  it("ordena por fecha, y a igual fecha manda la prioridad", () => {
    const agenda = clasificar(
      [
        item({ key: "media", fecha: "2026-08-02T15:00:00Z", prioridad: "media" }),
        item({ key: "alta", fecha: "2026-08-02T15:00:00Z", prioridad: "alta" }),
        item({ key: "temprano", fecha: "2026-08-02T09:00:00Z", prioridad: "baja" }),
      ],
      RANGO
    );

    expect(agenda.hoy.map((i) => i.key)).toEqual(["temprano", "alta", "media"]);
  });
});

describe("resumenDeterminista", () => {
  // Va como variable {{2}} de una plantilla de WhatsApp, y esas rechazan
  // saltos de línea. Si alguna vez alguien lo "mejora" con viñetas, el envío
  // empieza a fallar en producción y no en desarrollo.
  it("nunca devuelve saltos de línea", () => {
    const agenda = clasificar(
      [
        item({ titulo: "Reel de brunch", heroe: "Zonna", accion: "Publicar", fecha: "2026-07-31T15:00:00Z" }),
        item({ titulo: "Unboxing ramen", heroe: "Kosta Asiatika", fecha: "2026-08-02T15:00:00Z" }),
      ],
      RANGO
    );

    expect(resumenDeterminista(agenda)).not.toMatch(/[\r\n\t]/);
  });

  it("dice cuántas cosas hay atrasadas y nombra las primeras", () => {
    const agenda = clasificar(
      [
        item({ key: "a", titulo: "Reel de brunch", heroe: "Zonna", accion: "Publicar", fecha: "2026-07-30T15:00:00Z" }),
        item({ key: "b", titulo: "Unboxing", heroe: "Kosta", accion: "Grabar", fecha: "2026-07-31T15:00:00Z" }),
      ],
      RANGO
    );

    const texto = resumenDeterminista(agenda);
    expect(texto).toContain("Atrasado (2)");
    expect(texto).toContain("Publicar Reel de brunch (Zonna)");
  });

  it("resume con 'y N más' en vez de listar todo", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      item({ key: `v${i}`, titulo: `Pieza ${i}`, fecha: "2026-07-30T15:00:00Z" })
    );

    expect(resumenDeterminista(clasificar(items, RANGO))).toContain("y 3 más");
  });

  it("no inventa nada cuando no hay pendientes", () => {
    expect(resumenDeterminista({ vencidas: [], hoy: [], proximas: [] })).toBe("Sin pendientes.");
  });
});

// El stub ignora los filtros: `is_done = false` y `status = 'programado'` los
// resuelve Postgres y no hay forma de probarlos sin base. Lo que sí se prueba
// acá es el armado, que es donde está la lógica nuestra.
function stubSupabase(tablas: Record<string, unknown[]>) {
  const builder = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {};
    for (const metodo of ["select", "eq", "not", "gte", "lte", "in", "order"]) {
      chain[metodo] = () => chain;
    }
    chain.then = (resolver: (r: { data: unknown[]; error: null }) => unknown) =>
      resolver({ data: rows, error: null });
    return chain;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (tabla: string) => builder(tablas[tabla] ?? []) } as any;
}

describe("getStaffAgenda", () => {
  const AHORA = new Date("2026-08-02T15:00:00Z");

  it("parte una pieza en dos ítems: grabar y publicar son compromisos distintos", async () => {
    const agenda = await getStaffAgenda(
      stubSupabase({
        content_pieces: [
          {
            id: "p1",
            title: "Reel de brunch",
            brand_id: "h1",
            record_date: "2026-08-02",
            publish_date: "2026-08-04",
            priority: "alta",
          },
        ],
        calendar_events: [],
        agency_clients: [{ id: "h1", name: "Zonna" }],
      }),
      "staff-1",
      AHORA
    );

    expect(agenda.hoy.map((i) => i.accion)).toEqual(["Grabar"]);
    expect(agenda.proximas.map((i) => i.accion)).toEqual(["Publicar"]);
    expect(agenda.hoy[0].heroe).toBe("Zonna");
    // Cada ítem apunta a su campo: es lo que después deja reprogramar el
    // correcto de los dos desde el chat.
    expect(agenda.hoy[0].ref).toEqual({ kind: "piece", pieceId: "p1", campo: "record_date" });
  });

  // El bug del corrimiento de un día, visto desde el agente: una pieza para
  // mañana no puede aparecer como de hoy en el WhatsApp.
  it("una pieza con fecha de mañana NO cae en hoy", async () => {
    const agenda = await getStaffAgenda(
      stubSupabase({
        // Columna `date`: llega como día suelto, sin hora ni zona.
        content_pieces: [
          { id: "p1", title: "Reel", brand_id: null, record_date: null, publish_date: "2026-08-03", priority: "media" },
        ],
        calendar_events: [],
        agency_clients: [],
      }),
      "staff-1",
      new Date("2026-08-02T23:00:00Z") // 17:00 en CR del día 2
    );

    expect(agenda.hoy).toHaveLength(0);
    expect(agenda.proximas.map((i) => i.titulo)).toEqual(["Reel"]);
    // Y no se le inventa una hora que nadie cargó.
    expect(agenda.proximas[0].conHora).toBe(false);
  });

  it("ignora las piezas sin fecha: no hay nada que recordar", async () => {
    const agenda = await getStaffAgenda(
      stubSupabase({
        content_pieces: [
          { id: "p1", title: "Sin fechas", brand_id: null, record_date: null, publish_date: null, priority: "media" },
        ],
        calendar_events: [],
        agency_clients: [],
      }),
      "staff-1",
      AHORA
    );

    expect(contarAgenda(agenda)).toBe(0);
  });

  it("trae los eventos del calendario con su tipo traducido a una acción", async () => {
    const agenda = await getStaffAgenda(
      stubSupabase({
        content_pieces: [],
        calendar_events: [
          { id: "e1", title: "Kickoff", type: "reunion", brand_id: null, starts_at: "2026-08-02T16:00:00Z" },
          { id: "e2", title: "Jornada", type: "grabacion", brand_id: "h1", starts_at: "2026-08-02T18:00:00Z" },
        ],
        agency_clients: [{ id: "h1", name: "Zonna" }],
      }),
      "staff-1",
      AHORA
    );

    expect(agenda.hoy.map((i) => i.accion)).toEqual(["Reunión", "Grabar"]);
  });

  it("la ventana de próximas llega hasta donde dice DIAS_PROXIMAS", async () => {
    const dentro = new Date(AHORA.getTime() + DIAS_PROXIMAS * 24 * 3600 * 1000).toISOString();
    const fuera = new Date(AHORA.getTime() + (DIAS_PROXIMAS + 2) * 24 * 3600 * 1000).toISOString();

    const agenda = await getStaffAgenda(
      stubSupabase({
        content_pieces: [],
        calendar_events: [
          { id: "e1", title: "Justo dentro", type: "reunion", brand_id: null, starts_at: dentro },
          { id: "e2", title: "Ya no", type: "reunion", brand_id: null, starts_at: fuera },
        ],
        agency_clients: [],
      }),
      "staff-1",
      AHORA
    );

    expect(agenda.proximas.map((i) => i.titulo)).toEqual(["Justo dentro"]);
  });
});
