import { describe, it, expect } from "vitest";
import {
  MAX_DESTACADAS,
  alternarDestacada,
  moverDestacada,
  separarDestacadas,
} from "@/lib/ugc/destacadas";

describe("alternarDestacada", () => {
  it("agrega al final una pieza que no estaba", () => {
    expect(alternarDestacada(["a"], "b")).toEqual({ ok: true, ids: ["a", "b"] });
  });

  it("saca una pieza que ya estaba y corre las de atrás", () => {
    expect(alternarDestacada(["a", "b", "c"], "a")).toEqual({ ok: true, ids: ["b", "c"] });
  });

  it("con el tope lleno no agrega una cuarta y avisa (RF-02)", () => {
    const r = alternarDestacada(["a", "b", "c"], "d");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(String(MAX_DESTACADAS));
  });

  it("con el tope lleno igual deja quitar", () => {
    expect(alternarDestacada(["a", "b", "c"], "b")).toEqual({ ok: true, ids: ["a", "c"] });
  });

  it("no modifica la lista que recibe", () => {
    const actuales = ["a"];
    alternarDestacada(actuales, "b");
    expect(actuales).toEqual(["a"]);
  });
});

describe("moverDestacada", () => {
  it("mueve una pieza un lugar antes", () => {
    expect(moverDestacada(["a", "b", "c"], "c", "antes")).toEqual(["a", "c", "b"]);
  });

  it("mueve una pieza un lugar después", () => {
    expect(moverDestacada(["a", "b", "c"], "a", "despues")).toEqual(["b", "a", "c"]);
  });

  it("en los bordes devuelve la lista igual", () => {
    expect(moverDestacada(["a", "b", "c"], "a", "antes")).toEqual(["a", "b", "c"]);
    expect(moverDestacada(["a", "b", "c"], "c", "despues")).toEqual(["a", "b", "c"]);
  });

  it("si la pieza no está destacada devuelve la lista igual", () => {
    expect(moverDestacada(["a", "b"], "z", "antes")).toEqual(["a", "b"]);
  });
});

describe("separarDestacadas", () => {
  const pieza = (id: string, position: number, orden_destacada: number | null) => ({
    id,
    position,
    orden_destacada,
  });

  it("ordena las destacadas por su lugar y el resto por position, sin repetir (RF-03)", () => {
    const { destacadas, resto } = separarDestacadas([
      pieza("a", 0, null),
      pieza("b", 1, 2),
      pieza("c", 2, null),
      pieza("d", 3, 1),
    ]);
    expect(destacadas.map((p) => p.id)).toEqual(["d", "b"]);
    expect(resto.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("sin destacadas no elige ninguna por su cuenta (RF-04)", () => {
    const { destacadas, resto } = separarDestacadas([pieza("b", 1, null), pieza("a", 0, null)]);
    expect(destacadas).toEqual([]);
    expect(resto.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("con el book vacío devuelve dos listas vacías", () => {
    expect(separarDestacadas([])).toEqual({ destacadas: [], resto: [] });
  });
});
