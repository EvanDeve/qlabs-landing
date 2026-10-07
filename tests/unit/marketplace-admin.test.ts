import { describe, it, expect } from "vitest";
import { coincide, leerEstado, leerPestana } from "@/lib/ugc/marketplace-admin";

describe("leerPestana", () => {
  it("abre en Creadores si no viene nada o viene basura", () => {
    expect(leerPestana(undefined)).toBe("creadores");
    expect(leerPestana("admin")).toBe("creadores");
  });
  it("respeta una pestaña válida", () => {
    expect(leerPestana("aplicaciones")).toBe("aplicaciones");
  });
});

describe("leerEstado", () => {
  const validos = ["pendiente", "verificada", "rechazada"] as const;
  it("ignora un estado de otra pestaña", () => {
    expect(leerEstado("published", validos)).toBeNull();
    expect(leerEstado(undefined, validos)).toBeNull();
  });
  it("acepta uno de los suyos", () => {
    expect(leerEstado("rechazada", validos)).toBe("rechazada");
  });
});

describe("coincide", () => {
  it("sin búsqueda, todo coincide", () => {
    expect(coincide("  ", ["algo"])).toBe(true);
  });
  it("no le importan tildes ni mayúsculas", () => {
    expect(coincide("heredia", ["Heredia"])).toBe(true);
    expect(coincide("CAMPAÑA asiatica", ["Campana", "Kosta Asiática"])).toBe(true);
  });
  it("el @ del handle no cuenta, de ningún lado", () => {
    expect(coincide("@vale", ["vale.creates"])).toBe(true);
    expect(coincide("vale", ["@vale.creates"])).toBe(true);
  });
  it("cada palabra puede caer en un campo distinto, pero tienen que estar todas", () => {
    expect(coincide("zonna reel", ["Reel de brunch de domingo", "Zonna"])).toBe(true);
    expect(coincide("zonna ramen", ["Reel de brunch de domingo", "Zonna"])).toBe(false);
  });
  it("los campos vacíos no rompen", () => {
    expect(coincide("escazu", [null, undefined, "Escazú"])).toBe(true);
  });
});
