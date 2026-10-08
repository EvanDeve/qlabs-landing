import { describe, it, expect } from "vitest";
import { coincide, diasDesde, iniciales, leerEstado, leerPestana, textoDias } from "@/lib/ugc/marketplace-admin";

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

describe("iniciales", () => {
  it("usa nombre y apellido si hay dos palabras", () => {
    expect(iniciales("Luna Vargas")).toBe("LV");
    expect(iniciales("Soda Doña Rosa")).toBe("SD");
  });
  it("si es una sola palabra, las dos primeras letras, sin @", () => {
    expect(iniciales("@evanmarin")).toBe("EV");
  });
  it("separa handles con punto o guion", () => {
    expect(iniciales("@aas.deluca")).toBe("AD");
  });
  it("nunca devuelve vacío", () => {
    expect(iniciales("")).toBe("?");
    expect(iniciales(null)).toBe("?");
  });
});

describe("diasDesde y textoDias", () => {
  const ahora = new Date("2026-10-07T18:00:00Z").getTime();
  it("cuenta días enteros", () => {
    expect(diasDesde("2026-10-03T19:00:00Z", ahora)).toBe(3);
    expect(diasDesde("2026-10-07T10:00:00Z", ahora)).toBe(0);
  });
  it("una fecha futura no da negativo", () => {
    expect(diasDesde("2026-10-09T10:00:00Z", ahora)).toBe(0);
  });
  it("texto", () => {
    expect(textoDias(0)).toBe("hoy");
    expect(textoDias(1)).toBe("1 día");
    expect(textoDias(8)).toBe("8 días");
  });
});
