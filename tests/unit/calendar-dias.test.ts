import { describe, it, expect } from "vitest";
import { diaCR, diaCorto, sumarDias } from "@/lib/ugc/calendar";

// El bug que estas pruebas cuidan: una pieza puesta para el 1 de agosto se veía
// en todos lados —Kanban, Calendario y el WhatsApp del agente— como del 31 de
// julio. La causa era guardar un DÍA en una columna de INSTANTES: '2026-08-01'
// se completaba con la medianoche UTC, que en Costa Rica (UTC-6) son las 18:00
// del día anterior.
//
// Es un bug que no se ve desarrollando desde Costa Rica con datos recién
// creados, y aparece en producción o al caer la tarde. Por eso vive acá.

describe("diaCR", () => {
  // EL caso del bug. Un día suelto NO es un instante: convertirlo lo corre.
  it("devuelve un día suelto tal cual, sin correrlo", () => {
    expect(diaCR("2026-08-01")).toBe("2026-08-01");
    expect(diaCR("2026-01-01")).toBe("2026-01-01");
    expect(diaCR("2026-12-31")).toBe("2026-12-31");
  });

  it("traduce un instante a la zona de Costa Rica", () => {
    // Medianoche UTC del 1 de agosto = 18:00 del 31 de julio en CR.
    expect(diaCR("2026-08-01T00:00:00Z")).toBe("2026-07-31");
    // 06:00 UTC ya es medianoche del 1 en CR.
    expect(diaCR("2026-08-01T06:00:00Z")).toBe("2026-08-01");
    // 23:30 CR del 1 = 05:30Z del 2, y sigue siendo el día 1.
    expect(diaCR("2026-08-02T05:30:00Z")).toBe("2026-08-01");
  });

  it("acepta un Date igual que un string", () => {
    expect(diaCR(new Date("2026-08-01T00:00:00Z"))).toBe("2026-07-31");
  });

  // De esto depende que se pueda comparar con < y > como texto en todo Q·OS.
  it("el orden alfabético coincide con el cronológico", () => {
    const dias = ["2026-08-10", "2026-07-31", "2026-08-02", "2026-12-01", "2026-01-05"];

    expect([...dias].sort()).toEqual(["2026-01-05", "2026-07-31", "2026-08-02", "2026-08-10", "2026-12-01"]);
  });
});

describe("diaCorto", () => {
  it("muestra el día que se guardó, no el anterior", () => {
    expect(diaCorto("2026-08-01")).toContain("1");
    expect(diaCorto("2026-08-01")).toContain("ago");
  });

  // Antes esto usaba toLocaleDateString sin timeZone, así que dependía de la
  // zona del proceso: en la compu de alguien en CR daba una fecha y en Vercel
  // (UTC) otra. El resultado tiene que ser el mismo en cualquier servidor.
  it("no depende de la zona horaria del proceso", () => {
    const original = process.env.TZ;
    const resultados = new Set<string>();
    for (const tz of ["UTC", "America/Costa_Rica", "Asia/Tokyo", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      resultados.add(diaCorto("2026-08-01"));
    }
    process.env.TZ = original;

    expect(resultados.size).toBe(1);
  });
});

describe("sumarDias", () => {
  it("cruza el fin de mes", () => {
    expect(diaCR(sumarDias(new Date("2026-07-31T18:00:00Z"), 3))).toBe("2026-08-03");
  });

  it("resta con negativos", () => {
    expect(diaCR(sumarDias(new Date("2026-08-02T18:00:00Z"), -3))).toBe("2026-07-30");
  });
});
