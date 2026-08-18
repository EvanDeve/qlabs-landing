import { describe, it, expect } from "vitest";
import {
  carrilDe,
  columnasDelCarril,
  columnaDestino,
  columnaFinalDe,
  columnaDeEntrada,
  type ColumnaDelTablero,
} from "@/lib/ugc/tablero";

/**
 * El tablero REAL, leído de la base el 2026-08-18 y en el mismo orden en que lo
 * devuelve la consulta del webhook (`order("position")`).
 *
 * Está copiado tal cual a propósito, con sus nombres repetidos y sus huecos: los
 * tres bugs que estas pruebas fijan solo aparecen con esta forma exacta. Un
 * tablero inventado de tres columnas prolijas los deja pasar a todos.
 */
const TABLERO: ColumnaDelTablero[] = [
  { id: "g0", name: "Cronogramas", section: "guion", is_done: false },
  { id: "g1", name: "Cronogramas aprobados", section: "guion", is_done: true },
  { id: "v3", name: "Por editar", section: "video", is_done: false },
  { id: "v4", name: "EN CURSO/Revision", section: "video", is_done: false },
  { id: "v5", name: "Terminado", section: "video", is_done: false },
  { id: "v6", name: "Publicado", section: "video", is_done: true },
  { id: "i7", name: "Sin Empezar", section: "it", is_done: false },
  { id: "i8", name: "En Progreso", section: "it", is_done: false },
  { id: "i9", name: "Terminado", section: "it", is_done: false },
];

describe("carrilDe", () => {
  it("dice el carril por la columna donde está parada la tarjeta", () => {
    expect(carrilDe(TABLERO, "v4")).toBe("video");
    expect(carrilDe(TABLERO, "i8")).toBe("it");
    expect(carrilDe(TABLERO, "g0")).toBe("guion");
  });

  it("devuelve null si la columna no existe, en vez de adivinar una", () => {
    expect(carrilDe(TABLERO, "no-existe")).toBeNull();
  });

  it("no mezcla carriles al listarlos", () => {
    expect(columnasDelCarril(TABLERO, "v5").map((c) => c.name)).toEqual([
      "Por editar",
      "EN CURSO/Revision",
      "Terminado",
      "Publicado",
    ]);
    expect(columnasDelCarril(TABLERO, "i9")).toHaveLength(3);
  });
});

// El bug concreto: hay DOS columnas llamadas "Terminado". Buscar por nombre en
// todo el tablero siempre encontraba la de video, así que una tarjeta de IT
// terminaba cruzada de carril con un mensaje de una línea.
describe("columnaDestino", () => {
  it("mueve dentro del mismo carril", () => {
    const destino = columnaDestino(TABLERO, "v3", "EN CURSO/Revision");
    expect(destino).toEqual({ ok: true, columna: TABLERO[3] });
  });

  it("resuelve el nombre repetido contra el carril de la tarjeta, no contra el primero que aparece", () => {
    // La misma palabra, dos tarjetas, dos columnas distintas.
    expect(columnaDestino(TABLERO, "v3", "Terminado")).toEqual({ ok: true, columna: TABLERO[4] });
    expect(columnaDestino(TABLERO, "i8", "Terminado")).toEqual({ ok: true, columna: TABLERO[8] });
  });

  it("no deja cruzar de carril, y dice cuáles son las columnas válidas", () => {
    const destino = columnaDestino(TABLERO, "v3", "En Progreso");
    expect(destino.ok).toBe(false);
    if (!destino.ok) {
      expect(destino.nota).toContain("En Progreso");
      expect(destino.nota).toContain("Por editar");
      // Nombrar las que sí valen es la diferencia entre "no pude" y que la
      // persona sepa qué pedir la próxima vez.
      expect(destino.nota).toContain("Publicado");
    }
  });

  it("acepta la columna sin importar mayúsculas, que es como la escribe el modelo", () => {
    expect(columnaDestino(TABLERO, "v3", "publicado")).toEqual({ ok: true, columna: TABLERO[5] });
  });

  it("rechaza una columna que no existe en ningún lado", () => {
    expect(columnaDestino(TABLERO, "v3", "Inventada").ok).toBe(false);
  });
});

describe("columnaFinalDe", () => {
  it("cierra en la columna terminada de SU carril", () => {
    expect(columnaFinalDe(TABLERO, "v3")).toEqual({ ok: true, columna: TABLERO[5] });
    expect(columnaFinalDe(TABLERO, "g0")).toEqual({ ok: true, columna: TABLERO[1] });
  });

  // Antes se buscaba en todo el tablero desde la posición actual en adelante, y
  // como último recurso la última is_done de cualquier carril: una tarjeta de IT
  // se iba a "Publicado", que es del carril de video.
  it("no cierra una tarjeta de un carril que no tiene columna terminada", () => {
    const final = columnaFinalDe(TABLERO, "i8");
    expect(final.ok).toBe(false);
    if (!final.ok) expect(final.nota).toContain("it");
  });

  // Dar por hecho algo que ya está en "Terminado" (video) no puede mandarlo para
  // atrás, a la columna de cierre del carril de guiones.
  it("no manda para atrás una tarjeta que ya está avanzada", () => {
    expect(columnaFinalDe(TABLERO, "v5")).toEqual({ ok: true, columna: TABLERO[5] });
  });
});

describe("columnaDeEntrada", () => {
  // Un video anotado por chat nacía en "Cronogramas": la primera del tablero por
  // posición es del carril de guiones, y ahí no lo iba a buscar nadie.
  it("una tarjeta nueva nace en la primera columna del carril de video", () => {
    expect(columnaDeEntrada(TABLERO)).toEqual(TABLERO[2]);
  });

  it("devuelve null si no hay carril de video, en vez de caer en otro", () => {
    expect(columnaDeEntrada(TABLERO.filter((c) => c.section !== "video"))).toBeNull();
  });
});
