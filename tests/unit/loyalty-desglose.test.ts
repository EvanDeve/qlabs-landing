import { describe, it, expect } from "vitest";
import { desglosePuntos, type EventoPuntos } from "@/lib/ugc/loyalty-desglose";

const ev = (o: Partial<EventoPuntos>): EventoPuntos => ({
  action: "application",
  points: 5,
  created_at: "2026-08-25T18:00:00Z",
  reference_type: "application",
  reference_id: "a1",
  ...o,
});

describe("desglosePuntos", () => {
  const campanas = new Map([["a2", "Brunch de fin de semana"]]);

  it("agrupa por motivo y ordena de más puntos a menos", () => {
    const g = desglosePuntos(
      [
        ev({}),
        ev({ reference_id: "a3", created_at: "2026-08-26T18:00:00Z" }),
        ev({ action: "delivery_approved", points: 150, reference_id: "a2" }),
      ],
      campanas,
    );
    expect(g.map((x) => [x.action, x.puntos])).toEqual([
      ["delivery_approved", 150],
      ["application", 10],
    ]);
  });

  it("una sola vez desde una aplicación: campaña y fecha", () => {
    const [g] = desglosePuntos(
      [ev({ action: "delivery_approved", points: 150, reference_id: "a2" })],
      campanas,
    );
    expect(g.detalle).toBe("Brunch de fin de semana · 25 ago");
  });

  it("varias veces: cuántas y la última", () => {
    const [g] = desglosePuntos(
      [ev({}), ev({ created_at: "2026-09-02T18:00:00Z" }), ev({ created_at: "2026-08-01T18:00:00Z" })],
      campanas,
    );
    expect(g.detalle).toBe("3 aplicaciones · la última el 02 sept");
  });

  it("los de prueba van aparte, marcados y al final", () => {
    const g = desglosePuntos(
      [
        ev({ action: "delivery_approved", points: 150, reference_type: "prueba" }),
        ev({ action: "delivery_approved", points: 150, reference_type: "prueba" }),
        ev({ action: "delivery_approved", points: 150, reference_id: "a2" }),
      ],
      campanas,
    );
    expect(g.map((x) => [x.label, x.puntos, x.prueba])).toEqual([
      ["Entrega aprobada", 150, false],
      ["Entrega aprobada (prueba)", 300, true],
    ]);
  });
});
