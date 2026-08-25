import { describe, it, expect } from "vitest";
import { normalizarTelefonoCR } from "@/lib/whatsapp/twilio";

// Las dos funciones tienen la misma pinta de detalle sin importancia y las dos
// fallan igual de feo: en producción, contra números reales, y sin que se note
// probando en local con un texto corto de una línea.

describe("normalizarTelefonoCR", () => {
  it("acepta las formas en que la gente escribe un número tico", () => {
    for (const entrada of ["88887777", "8888-7777", "8888 7777", "+506 8888 7777", "50688887777"]) {
      expect(normalizarTelefonoCR(entrada)).toBe("+50688887777");
    }
  });

  it("respeta un código de país que no sea el de Costa Rica", () => {
    expect(normalizarTelefonoCR("+1 415 555 0123")).toBe("+14155550123");
  });

  // Devolver null es lo que deja que el panel muestre el error. Si esto
  // "arreglara" la entrada, el número roto se guardaría y el fallo aparecería
  // días después, a la hora del recordatorio, sin nadie mirando.
  it("devuelve null cuando no puede resolverlo", () => {
    for (const entrada of ["", "1234", "no es un teléfono", "+0123456789", "888877776666555544"]) {
      expect(normalizarTelefonoCR(entrada)).toBeNull();
    }
  });
});
