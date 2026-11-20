import { describe, it, expect } from "vitest";
import {
  metaDelPeriodo,
  resumenDelPanel,
  textoInicioMedicion,
  type TerminadoRegistrado,
} from "@/lib/ugc/panel-editores";

// 2026-11-18 es miércoles. La semana va del lunes 16 al domingo 22.
const MIERCOLES = "2026-11-18";

/** Un terminado a las 10:00 de Costa Rica (16:00Z) de ese día. */
function terminado(ownerId: string, dia: string): TerminadoRegistrado {
  return { ownerId, terminadoAt: `${dia}T16:00:00.000Z` };
}

function varios(ownerId: string, dia: string, n: number): TerminadoRegistrado[] {
  return Array.from({ length: n }, () => terminado(ownerId, dia));
}

describe("metaDelPeriodo", () => {
  it("un miércoles la semana en curso vale 24 (hoy incluido)", () => {
    expect(metaDelPeriodo("2026-11-16", "2026-11-22", MIERCOLES, "2026-10-01")).toEqual({ diasHabiles: 3, meta: 24 });
  });
  it("una semana ya cerrada vale los 5 días", () => {
    expect(metaDelPeriodo("2026-11-09", "2026-11-15", MIERCOLES, "2026-10-01")).toEqual({ diasHabiles: 5, meta: 40 });
  });
  it("un mes en curso cuenta solo los hábiles hasta hoy", () => {
    // Noviembre 2026 hasta el 18: hábiles 2–6, 9–13, 16–18 = 13
    expect(metaDelPeriodo("2026-11-01", "2026-11-30", MIERCOLES, "2026-10-01")).toEqual({ diasHabiles: 13, meta: 104 });
  });
  it("los días antes del inicio de la medición no cuentan", () => {
    expect(metaDelPeriodo("2026-11-16", "2026-11-22", MIERCOLES, "2026-11-17")).toEqual({ diasHabiles: 2, meta: 16 });
  });
  it("sin inicio de medición, meta 0", () => {
    expect(metaDelPeriodo("2026-11-16", "2026-11-22", MIERCOLES, null)).toEqual({ diasHabiles: 0, meta: 0 });
  });
  it("un período entero antes del inicio, meta 0", () => {
    expect(metaDelPeriodo("2026-10-01", "2026-10-31", MIERCOLES, "2026-11-17")).toEqual({ diasHabiles: 0, meta: 0 });
  });
});

describe("resumenDelPanel", () => {
  const editores = [
    { profileId: "ana", nombre: "Ana" },
    { profileId: "beto", nombre: "Beto" },
  ];

  it("un editor sin nada aparece en ceros", () => {
    const [ana, beto] = resumenDelPanel({
      editores,
      fila: [],
      terminados: varios("ana", MIERCOLES, 2),
      hoy: MIERCOLES,
      inicioMedicion: "2026-11-02",
    });
    expect(ana.nombre).toBe("Ana");
    expect(beto).toMatchObject({
      profileId: "beto",
      nombre: "Beto",
      hoy: { terminados: 0, meta: 8 },
      pendientes: 0,
      atrasados: 0,
      diasDeAdelanto: null,
    });
    expect(beto.semanas.every((p) => p.total === 0)).toBe(true);
    expect(beto.meses.every((p) => p.total === 0)).toBe(true);
  });

  it("hoy, pendientes, atrasados y adelanto", () => {
    const [ana] = resumenDelPanel({
      editores,
      fila: [
        { ownerId: "ana", publishDate: "2026-11-10" },
        { ownerId: "ana", publishDate: "2026-11-25" },
        { ownerId: "ana", publishDate: null },
        { ownerId: "beto", publishDate: "2026-11-01" },
      ],
      terminados: [...varios("ana", MIERCOLES, 3), terminado("ana", "2026-11-17")],
      hoy: MIERCOLES,
      inicioMedicion: "2026-11-02",
    });
    expect(ana.hoy).toEqual({ terminados: 3, meta: 8 });
    expect(ana.pendientes).toBe(3);
    expect(ana.atrasados).toBe(1);
    expect(ana.diasDeAdelanto).toBe(-8);
  });

  it("un sábado, hoy no tiene meta", () => {
    const [ana] = resumenDelPanel({
      editores,
      fila: [],
      terminados: [],
      hoy: "2026-11-21",
      inicioMedicion: "2026-11-02",
    });
    expect(ana.hoy.meta).toBeNull();
  });

  it("el historial tiene 10 días hábiles, el más nuevo primero, y marca si llegó a 8", () => {
    const [ana] = resumenDelPanel({
      editores,
      fila: [],
      terminados: [...varios("ana", "2026-11-17", 8), ...varios("ana", "2026-11-16", 5)],
      hoy: MIERCOLES,
      inicioMedicion: "2026-10-01",
    });
    expect(ana.historial.map((h) => h.dia)).toEqual([
      "2026-11-18",
      "2026-11-17",
      "2026-11-16",
      "2026-11-13",
      "2026-11-12",
      "2026-11-11",
      "2026-11-10",
      "2026-11-09",
      "2026-11-06",
      "2026-11-05",
    ]);
    expect(ana.historial[1]).toEqual({ dia: "2026-11-17", terminados: 8, llego: true });
    expect(ana.historial[2]).toEqual({ dia: "2026-11-16", terminados: 5, llego: false });
  });

  it("los días antes del inicio no entran al historial ni a los totales", () => {
    const [ana] = resumenDelPanel({
      editores,
      fila: [],
      terminados: [...varios("ana", "2026-11-16", 4), ...varios("ana", "2026-11-17", 2)],
      hoy: MIERCOLES,
      inicioMedicion: "2026-11-17",
    });
    expect(ana.historial.map((h) => h.dia)).toEqual(["2026-11-18", "2026-11-17"]);
    const semana = ana.semanas[0];
    expect(semana).toEqual({ desde: "2026-11-16", hasta: "2026-11-22", total: 2, meta: 16, porcentaje: 13 });
  });

  it("sin inicio de medición: historial vacío, meta 0 y porcentaje null", () => {
    const [ana] = resumenDelPanel({
      editores,
      fila: [],
      terminados: varios("ana", MIERCOLES, 3),
      hoy: MIERCOLES,
      inicioMedicion: null,
    });
    expect(ana.hoy.terminados).toBe(3); // el día igual se ve
    expect(ana.historial).toEqual([]);
    expect(ana.semanas[0]).toMatchObject({ total: 0, meta: 0, porcentaje: null });
  });

  it("semanas y meses: el actual y el anterior", () => {
    const [ana] = resumenDelPanel({
      editores,
      fila: [],
      terminados: [
        ...varios("ana", "2026-11-18", 8),
        ...varios("ana", "2026-11-13", 6), // semana anterior
        ...varios("ana", "2026-10-30", 4), // mes anterior
      ],
      hoy: MIERCOLES,
      inicioMedicion: "2026-10-01",
    });
    expect(ana.semanas).toEqual([
      { desde: "2026-11-16", hasta: "2026-11-22", total: 8, meta: 24, porcentaje: 33 },
      { desde: "2026-11-09", hasta: "2026-11-15", total: 6, meta: 40, porcentaje: 15 },
    ]);
    expect(ana.meses[0]).toMatchObject({ desde: "2026-11-01", hasta: "2026-11-30", total: 14, meta: 104 });
    // Octubre 2026: 22 días hábiles
    expect(ana.meses[1]).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-31", total: 4, meta: 176 });
  });

  it("el día se cuenta en hora de Costa Rica", () => {
    const [ana] = resumenDelPanel({
      editores,
      fila: [],
      // 05:30Z del 18 = 23:30 CR del 17
      terminados: [{ ownerId: "ana", terminadoAt: "2026-11-18T05:30:00.000Z" }],
      hoy: MIERCOLES,
      inicioMedicion: "2026-10-01",
    });
    expect(ana.hoy.terminados).toBe(0);
    expect(ana.historial[1]).toMatchObject({ dia: "2026-11-17", terminados: 1 });
  });

  it("cambiar el ownerId de un terminado lo mueve de editor", () => {
    const base = { editores, fila: [], hoy: MIERCOLES, inicioMedicion: "2026-11-02" };
    const [ana1, beto1] = resumenDelPanel({ ...base, terminados: [terminado("ana", MIERCOLES)] });
    const [ana2, beto2] = resumenDelPanel({ ...base, terminados: [terminado("beto", MIERCOLES)] });
    expect([ana1.hoy.terminados, beto1.hoy.terminados]).toEqual([1, 0]);
    expect([ana2.hoy.terminados, beto2.hoy.terminados]).toEqual([0, 1]);
  });

  it("respeta el orden de los editores y la cantidad de días de historial", () => {
    const filas = resumenDelPanel({
      editores: [...editores].reverse(),
      fila: [],
      terminados: [],
      hoy: MIERCOLES,
      inicioMedicion: "2026-10-01",
      diasHistorial: 3,
    });
    expect(filas.map((f) => f.profileId)).toEqual(["beto", "ana"]);
    expect(filas[0].historial).toHaveLength(3);
  });
});

describe("textoInicioMedicion", () => {
  it("sin reparto todavía", () => {
    expect(textoInicioMedicion(null)).toBe("La medición arranca con el primer reparto. Lo terminado antes no cuenta.");
  });
  it("con fecha", () => {
    expect(textoInicioMedicion("2026-11-23")).toBe("Se mide desde el 23 nov. Lo terminado antes no cuenta.");
  });
});
