import { describe, it, expect } from "vitest";
import { sanitizarVariable, normalizarTelefonoCR, MAX_VARIABLE } from "@/lib/whatsapp/twilio";

// Las dos funciones tienen la misma pinta de detalle sin importancia y las dos
// fallan igual de feo: en producción, contra números reales, y sin que se note
// probando en local con un texto corto de una línea.

describe("sanitizarVariable", () => {
  // Meta rechaza el MENSAJE (no la plantilla) si una variable trae saltos de
  // línea, tabs o 4+ espacios seguidos. O sea: la plantilla queda aprobada, el
  // código compila, y el envío falla recién el día que el texto sale con
  // formato.
  it("aplasta saltos de línea y tabs a un espacio", () => {
    expect(sanitizarVariable("Hoy:\n- Grabar\n- Publicar")).toBe("Hoy: - Grabar - Publicar");
    expect(sanitizarVariable("a\tb")).toBe("a b");
  });

  it("colapsa los espacios múltiples", () => {
    expect(sanitizarVariable("uno    dos")).toBe("uno dos");
  });

  it("recorta los extremos", () => {
    expect(sanitizarVariable("  hola  ")).toBe("hola");
  });

  it("corta lo muy largo y avisa que cortó", () => {
    const salida = sanitizarVariable("x".repeat(MAX_VARIABLE + 200));

    expect(salida).toHaveLength(MAX_VARIABLE);
    expect(salida.endsWith("…")).toBe(true);
  });

  it("deja intacto lo que ya está bien", () => {
    expect(sanitizarVariable("Atrasado (2): Publicar Reel (Zonna)")).toBe("Atrasado (2): Publicar Reel (Zonna)");
  });
});

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
