import { describe, it, expect } from "vitest";
import { extrasPorHero, metaDelMes, riesgoDeHero } from "@/lib/ugc/reporte";

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

describe("metaDelMes con videos extra (tarjetas sueltas)", () => {
  // Evan, 2026-11-20: lo ideal es hacer solo lo del cronograma, pero a veces se
  // hacen videos de más como tarjeta suelta, y esos también son trabajo del mes.
  it("aprobado + extras", () => {
    expect(metaDelMes({ status: "aprobado", target: 54 }, 50, 11)).toBe(65);
  });
  it("sin cronograma, las sueltas solas son la meta", () => {
    expect(metaDelMes(undefined, 0, 15)).toBe(15);
  });
  it("pendiente: sus videos planificados no cuentan, las sueltas sí", () => {
    expect(metaDelMes({ status: "pendiente", target: null }, 122, 0)).toBe(null);
    expect(metaDelMes({ status: "pendiente", target: null }, 30, 17)).toBe(17);
  });
  it("aprobado viejo sin target ni videos + extras: cuentan los extras", () => {
    expect(metaDelMes({ status: "aprobado", target: null }, 0, 3)).toBe(3);
  });
  it("sin extras se comporta como antes", () => {
    expect(metaDelMes({ status: "aprobado", target: 10 }, 7, 0)).toBe(10);
    expect(metaDelMes(undefined, 0, 0)).toBe(null);
  });
});

describe("extrasPorHero", () => {
  const p = (brand_id: string | null, calendar_month: string | null, publish_date: string | null) => ({ brand_id, calendar_month, publish_date });
  it("cuenta solo tarjetas sueltas con fecha en el mes, por Hero", () => {
    const extras = extrasPorHero(
      [
        p("dulce", null, "2026-11-03"),
        p("dulce", null, "2026-11-30"),
        p("dulce", "2026-11-01", "2026-11-05"), // del cronograma: no es extra
        p("dulce", null, "2026-12-01"), // otro mes
        p("dulce", null, null), // sin fecha: no cae en ningún mes
        p("henrys", null, "2026-11-10"),
        p(null, null, "2026-11-10"), // sin Hero: interna
      ],
      "2026-11"
    );
    expect(Object.fromEntries(extras)).toEqual({ dulce: 2, henrys: 1 });
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
