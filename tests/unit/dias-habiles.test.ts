import { describe, it, expect } from "vitest";
import {
  diaDeLaSemana,
  diasEntre,
  diasHabilesEntre,
  esDiaHabil,
  inicioDeMes,
  inicioDeSemana,
  rangoUtcDelDia,
  sumarDiasAlDia,
  ultimosDiasHabiles,
} from "@/lib/ugc/dias-habiles";

// Semana de referencia: 2026-11-16 es lunes, 2026-11-21 sábado, 2026-11-22 domingo.

describe("diaDeLaSemana y esDiaHabil", () => {
  it("sábado, domingo y lunes", () => {
    expect(diaDeLaSemana("2026-11-21")).toBe(6);
    expect(diaDeLaSemana("2026-11-22")).toBe(0);
    expect(diaDeLaSemana("2026-11-23")).toBe(1);
    expect(esDiaHabil("2026-11-21")).toBe(false);
    expect(esDiaHabil("2026-11-22")).toBe(false);
    expect(esDiaHabil("2026-11-23")).toBe(true);
    expect(esDiaHabil("2026-11-20")).toBe(true); // viernes
  });
});

describe("sumarDiasAlDia y diasEntre", () => {
  it("cruza mes, año y 29 de febrero", () => {
    expect(sumarDiasAlDia("2026-11-30", 1)).toBe("2026-12-01");
    expect(sumarDiasAlDia("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDiasAlDia("2028-02-28", 1)).toBe("2028-02-29");
    expect(sumarDiasAlDia("2028-03-01", -1)).toBe("2028-02-29");
    expect(diasEntre("2026-11-19", "2026-11-23")).toBe(4);
    expect(diasEntre("2026-11-23", "2026-11-19")).toBe(-4);
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2);
  });
});

describe("diasHabilesEntre", () => {
  it("inclusive y salteando el fin de semana", () => {
    expect(diasHabilesEntre("2026-11-20", "2026-11-23")).toEqual(["2026-11-20", "2026-11-23"]);
  });
  it("cruza fin de mes", () => {
    expect(diasHabilesEntre("2026-11-27", "2026-12-02")).toEqual([
      "2026-11-27",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
  });
  it("cruza fin de año", () => {
    // 2026-12-31 jueves, 2027-01-01 viernes, 2027-01-04 lunes
    expect(diasHabilesEntre("2026-12-31", "2027-01-04")).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-04",
    ]);
  });
  it("incluye el 29 de febrero", () => {
    // 2028-02-29 es martes
    expect(diasHabilesEntre("2028-02-28", "2028-03-01")).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });
  it("[] si desde > hasta, y un fin de semana solo da []", () => {
    expect(diasHabilesEntre("2026-11-23", "2026-11-20")).toEqual([]);
    expect(diasHabilesEntre("2026-11-21", "2026-11-22")).toEqual([]);
  });
});

describe("ultimosDiasHabiles", () => {
  it("un lunes incluye hoy y salta el fin de semana", () => {
    expect(ultimosDiasHabiles("2026-11-23", 3)).toEqual(["2026-11-23", "2026-11-20", "2026-11-19"]);
  });
  it("un sábado no incluye hoy", () => {
    expect(ultimosDiasHabiles("2026-11-21", 2)).toEqual(["2026-11-20", "2026-11-19"]);
  });
  it("n = 0 da []", () => {
    expect(ultimosDiasHabiles("2026-11-23", 0)).toEqual([]);
  });
});

describe("inicioDeSemana e inicioDeMes", () => {
  it("el lunes de la semana", () => {
    expect(inicioDeSemana("2026-11-22")).toBe("2026-11-16"); // domingo → lunes anterior
    expect(inicioDeSemana("2026-11-16")).toBe("2026-11-16"); // lunes → sí mismo
    expect(inicioDeSemana("2026-11-21")).toBe("2026-11-16"); // sábado
    expect(inicioDeSemana("2027-01-01")).toBe("2026-12-28"); // cruza el año
  });
  it("el primero del mes", () => {
    expect(inicioDeMes("2026-11-19")).toBe("2026-11-01");
    expect(inicioDeMes("2028-02-29")).toBe("2028-02-01");
  });
});

describe("rangoUtcDelDia", () => {
  it("medianoche CR a medianoche CR (UTC−6)", () => {
    expect(rangoUtcDelDia("2026-11-19")).toEqual({
      desde: "2026-11-19T06:00:00.000Z",
      hasta: "2026-11-20T06:00:00.000Z",
    });
  });
  it("el último del año termina en el año siguiente", () => {
    expect(rangoUtcDelDia("2026-12-31").hasta).toBe("2027-01-01T06:00:00.000Z");
  });
});
