import { describe, it, expect } from "vitest";
import { sumarMeses, nombreDeMes, diasDelMes, parseMes, mesCR } from "@/lib/ugc/cronograma";

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
