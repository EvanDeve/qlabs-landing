import { describe, it, expect } from "vitest";
import { traerTodas } from "@/lib/supabase/paginar";

/** Un "PostgREST" de mentira: devuelve el tramo [desde, hasta] inclusive, como .range(). */
function falso(total: number) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i }));
  const llamadas: [number, number][] = [];
  const armar = (desde: number, hasta: number) => {
    llamadas.push([desde, hasta]);
    return Promise.resolve({ data: filas.slice(desde, hasta + 1), error: null });
  };
  return { armar, llamadas };
}

describe("traerTodas", () => {
  it("2.300 filas → 3 páginas, sin repetir ni perder", async () => {
    const { armar, llamadas } = falso(2300);
    const todas = await traerTodas(armar);
    expect(llamadas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(todas).toHaveLength(2300);
    expect(new Set(todas.map((f) => f.id)).size).toBe(2300);
  });

  it("justo 1000 filas → pide una página más, que viene vacía", async () => {
    const { armar, llamadas } = falso(1000);
    expect(await traerTodas(armar)).toHaveLength(1000);
    expect(llamadas).toHaveLength(2);
  });

  it("sin filas → []", async () => {
    expect(await traerTodas(falso(0).armar)).toEqual([]);
  });

  it("respeta otro tamaño de página", async () => {
    const { armar, llamadas } = falso(5);
    expect(await traerTodas(armar, 2)).toHaveLength(5);
    expect(llamadas).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("si una página falla, tira el error", async () => {
    const armar = () => Promise.resolve({ data: null, error: { message: "se cayó" } });
    await expect(traerTodas(armar)).rejects.toThrow("se cayó");
  });
});
