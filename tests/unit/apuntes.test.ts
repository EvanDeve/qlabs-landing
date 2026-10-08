import { describe, it, expect } from "vitest";
import { apuntesDe } from "@/lib/ugc/apuntes";

describe("apuntesDe", () => {
  it("sin nada en ningún lado devuelve null", () => {
    expect(apuntesDe(null, null)).toBeNull();
    expect(apuntesDe(null, undefined)).toBeNull();
  });

  it("antes de ser tarjeta, valen las notas del cronograma", () => {
    expect(apuntesDe("Va con voice over", null)).toBe("Va con voice over");
  });

  it("si ya es tarjeta, ganan los apuntes de la tarjeta", () => {
    expect(apuntesDe("Va con voice over", "Grabación en el local")).toBe("Grabación en el local");
  });

  it("solo la tarjeta tiene apuntes", () => {
    expect(apuntesDe(null, "Grabación en el local")).toBe("Grabación en el local");
  });

  it("una tarjeta con apuntes en blanco no tapa las notas del cronograma", () => {
    expect(apuntesDe("Va con voice over", "   ")).toBe("Va con voice over");
  });

  it("recorta los espacios y lo que queda en blanco es null", () => {
    expect(apuntesDe("  Va con voice over \n", null)).toBe("Va con voice over");
    expect(apuntesDe(" ", "\n")).toBeNull();
  });
});
