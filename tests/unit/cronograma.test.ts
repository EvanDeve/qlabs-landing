import { describe, it, expect } from "vitest";
import { sumarMeses, nombreDeMes, diasDelMes, parseMes, mesCR, parseMesCorto, rangoDelMes } from "@/lib/ugc/cronograma";

describe("meses", () => {
  it("salta de año hacia adelante y hacia atrás", () => {
    expect(sumarMeses("2026-12-01", 1)).toBe("2027-01-01");
    expect(sumarMeses("2026-01-01", -1)).toBe("2025-12-01");
    expect(sumarMeses("2026-08-01", 5)).toBe("2027-01-01");
    expect(sumarMeses("2026-08-01", -20)).toBe("2024-12-01");
    expect(sumarMeses("2026-08-01", 0)).toBe("2026-08-01");
  });
  it("nombra y mide", () => {
    expect(nombreDeMes("2026-09-01")).toBe("septiembre 2026");
    expect(diasDelMes("2026-02-01")).toBe(28);
    expect(diasDelMes("2028-02-01")).toBe(29);
    expect(diasDelMes("2026-08-01")).toBe(31);
  });
  it("rechaza meses inventados", () => {
    expect(parseMes("2026-09-15")).toBe(null);
    expect(parseMes("septiembre")).toBe(null);
    expect(parseMes("2026-13-01")).toBe(null);
    expect(parseMes("2026-09-01")).toBe("2026-09-01");
  });
  it("el 31 de agosto de noche en CR sigue siendo agosto", () => {
    // 2026-09-01T01:00Z = 31 de agosto 19:00 en Costa Rica.
    expect(mesCR(new Date("2026-09-01T01:00:00Z"))).toBe("2026-08-01");
  });
});

describe("el filtro de mes del pipeline", () => {
  it("acepta 'yyyy-MM' y rechaza lo demás", () => {
    expect(parseMesCorto("2026-09")).toBe("2026-09");
    // El formato de las rutas del cronograma NO sirve acá, y viceversa: son
    // dos validadores distintos justamente para que no se acepten entre sí.
    expect(parseMesCorto("2026-09-01")).toBe(null);
    expect(parseMesCorto("2026-13")).toBe(null);
    expect(parseMesCorto("2026-00")).toBe(null);
    expect(parseMesCorto("septiembre")).toBe(null);
    expect(parseMesCorto(undefined)).toBe(null);
  });

  it("el rango cubre el mes entero, con el último día correcto", () => {
    expect(rangoDelMes("2026-09")).toEqual({ gte: "2026-09-01", lte: "2026-09-30" });
    expect(rangoDelMes("2026-08")).toEqual({ gte: "2026-08-01", lte: "2026-08-31" });
    expect(rangoDelMes("2026-02")).toEqual({ gte: "2026-02-01", lte: "2026-02-28" });
    // Bisiesto: si el último día se calculara con un 30 fijo o con 28, el 29 de
    // febrero quedaría fuera del filtro sin que nadie lo note hasta 2028.
    expect(rangoDelMes("2028-02")).toEqual({ gte: "2028-02-01", lte: "2028-02-29" });
  });
});
