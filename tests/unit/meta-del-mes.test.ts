import { describe, it, expect } from "vitest";
import { metaDelMes, riesgoDeHero } from "@/lib/ugc/reporte";

describe("metaDelMes", () => {
  it("sin cronograma no hay meta, y eso NO es meta cero", () => {
    // La diferencia importa: con 0, un Hero sin planificar aparecería
    // cumpliendo perfecto (0 de 0). Con null, el Dashboard dice "—".
    expect(metaDelMes(undefined, 0)).toBe(null);
    expect(metaDelMes(undefined, 5)).toBe(null);
  });

  it("pendiente: la meta es el conteo vivo de sus videos", () => {
    expect(metaDelMes({ status: "pendiente", target: null }, 8)).toBe(8);
    expect(metaDelMes({ status: "pendiente", target: null }, 1)).toBe(1);
  });

  it("pendiente y vacío todavía no es una meta", () => {
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
