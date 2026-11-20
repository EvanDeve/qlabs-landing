import { describe, it, expect } from "vitest";
import { metaDelMes, riesgoDeHero } from "@/lib/ugc/reporte";

describe("metaDelMes", () => {
  it("sin cronograma no hay meta, y eso NO es meta cero", () => {
    // La diferencia importa: con 0, un Hero sin planificar aparecería
    // cumpliendo perfecto (0 de 0). Con null, el Dashboard dice "—".
    expect(metaDelMes(undefined, 0)).toBe(null);
    expect(metaDelMes(undefined, 5)).toBe(null);
  });

  it("pendiente: todavía no es meta, por más videos que tenga cargados", () => {
    // Evan, 2026-11-20: la meta es solo lo que el cliente aprobó. El cronograma
    // de Q Labs de noviembre (122 videos, sin aprobar y que no se va a hacer
    // todavía) inflaba la meta de 104 a 256.
    expect(metaDelMes({ status: "pendiente", target: null }, 122)).toBe(null);
    expect(metaDelMes({ status: "pendiente", target: null }, 1)).toBe(null);
    expect(metaDelMes({ status: "pendiente", target: null }, 0)).toBe(null);
  });

  it("aprobado: manda el número sellado, aunque después cambien los videos", () => {
    // Es el punto de sellarlo: el cliente aceptó 10 y siguen siendo 10 aunque
    // alguien borre una tarjeta del tablero después.
    expect(metaDelMes({ status: "aprobado", target: 10 }, 7)).toBe(10);
    expect(metaDelMes({ status: "aprobado", target: 10 }, 0)).toBe(10);
  });

  it("los cronogramas viejos aprobados sin target quedan SIN meta", () => {
    // Julio y agosto de 2026 se aprobaron antes de que esto existiera: tienen
    // target en null y cero videos cargados. Si devolvieran 0, esos seis Heroes
    // aparecerían cumpliendo una meta de cero.
    expect(metaDelMes({ status: "aprobado", target: null }, 0)).toBe(null);
  });

  it("aprobado sin target pero con videos usa el conteo", () => {
    expect(metaDelMes({ status: "aprobado", target: null }, 6)).toBe(6);
  });
});

describe("riesgoDeHero no cambió de criterio", () => {
  it("no haber publicado nada es riesgo alto, con o sin cronograma", () => {
    expect(riesgoDeHero({ publicados: 0, esperado: 5, deficit: 5, cronogramaAprobado: true })).toBe("alto");
    expect(riesgoDeHero({ publicados: 0, esperado: 5, deficit: 5, cronogramaAprobado: false })).toBe("alto");
  });

  it("al día y con cronograma aprobado es riesgo bajo", () => {
    expect(riesgoDeHero({ publicados: 5, esperado: 5, deficit: 0, cronogramaAprobado: true })).toBe("bajo");
  });

  it("al día pero sin cronograma aprobado sigue siendo medio", () => {
    expect(riesgoDeHero({ publicados: 5, esperado: 5, deficit: 0, cronogramaAprobado: false })).toBe("medio");
  });
});
