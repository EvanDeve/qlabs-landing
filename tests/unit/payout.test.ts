import { describe, it, expect } from "vitest";
import { creatorPayout, desglosePago, AGENCY_FEE_RATE } from "@/lib/ugc/payout";

// Esta función decide qué plata ve el creador en pantalla. Si se rompe, o le
// mostramos de más (y la agencia queda debiendo) o de menos (y el creador
// rechaza promos que sí le convenían).
describe("creatorPayout", () => {
  it("le descuenta la comisión del 20% al presupuesto de la marca", () => {
    expect(creatorPayout(100_000)).toBe(80_000);
    expect(creatorPayout(150_000)).toBe(120_000);
    expect(creatorPayout(60_000)).toBe(48_000);
  });

  it("redondea a colón entero: los montos se muestran sin decimales", () => {
    // 12.345 * 0.8 = 9876 exacto; 12.346 * 0.8 = 9876.8 -> 9877
    expect(creatorPayout(12_345)).toBe(9_876);
    expect(creatorPayout(12_346)).toBe(9_877);
    expect(Number.isInteger(creatorPayout(999))).toBe(true);
  });

  it("no inventa plata en los bordes", () => {
    expect(creatorPayout(0)).toBe(0);
    expect(creatorPayout(1)).toBe(1); // 0.8 redondea a 1
  });

  it("nunca devuelve más que el bruto", () => {
    for (const bruto of [1, 999, 50_000, 1_234_567]) {
      expect(creatorPayout(bruto)).toBeLessThanOrEqual(bruto);
    }
  });

  it("la comisión sigue siendo 20% — si esto cambia hay que revisar los emails y la UI", () => {
    expect(AGENCY_FEE_RATE).toBe(0.2);
  });
});

// El desglose se le muestra a la marca y al creador con las mismas cifras. Si
// las tres líneas no suman, el bloque que existe para dar confianza hace lo
// contrario: deja pensando que alguien se quedó con un colón.
describe("desglosePago", () => {
  it("las tres cifras cierran siempre, incluso con montos que no dividen redondo", () => {
    for (const bruto of [0, 1, 999, 12_345, 12_346, 150_000, 180_001, 1_234_567]) {
      const { comision, neto } = desglosePago(bruto);
      expect(comision + neto).toBe(bruto);
    }
  });

  it("el neto es exactamente el que ya se mostraba en el feed", () => {
    // Si estos dos se separaran, la tarjeta del feed y el detalle de la promo
    // dirían números distintos para la misma campaña.
    for (const bruto of [60_000, 150_000, 180_000]) {
      expect(desglosePago(bruto).neto).toBe(creatorPayout(bruto));
    }
  });

  it("el porcentaje que se pinta coincide con la tasa real", () => {
    expect(desglosePago(100_000).porcentaje).toBe(AGENCY_FEE_RATE * 100);
    expect(desglosePago(100_000).comision).toBe(20_000);
  });

  it("no muestra comisión donde no hay plata", () => {
    expect(desglosePago(0)).toMatchObject({ bruto: 0, comision: 0, neto: 0 });
  });
});
