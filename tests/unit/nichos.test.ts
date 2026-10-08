import { describe, it, expect } from "vitest";
import { MAX_NICHOS, nichoLabel, parseNichos } from "@/lib/ugc/nichos";

describe("parseNichos", () => {
  it("se queda solo con ids del catálogo, sin repetidos", () => {
    expect(parseNichos("gastronomia, food, viajes,gastronomia, ")).toEqual(["gastronomia", "viajes"]);
  });
  it("corta en el tope aunque el formulario mande más", () => {
    const todos = "gastronomia,bebidas,viajes,hospedaje,aventura,lifestyle,moda";
    expect(parseNichos(todos)).toHaveLength(MAX_NICHOS);
  });
  it("vacío es vacío", () => {
    expect(parseNichos("")).toEqual([]);
  });
});

describe("nichoLabel", () => {
  it("muestra el nombre, y el id crudo si no está en la lista", () => {
    expect(nichoLabel("hospedaje")).toBe("Hoteles y hospedaje");
    expect(nichoLabel("otro")).toBe("otro");
  });
});
