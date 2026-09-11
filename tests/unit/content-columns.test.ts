import { describe, it, expect } from "vitest";
import {
  SECCIONES_PIPELINE,
  esCarrilDeTareas,
  parseSeccion,
  parseSeccionColumna,
} from "@/lib/ugc/content-columns";
import { NOMBRE_DE_CARRIL } from "@/lib/ugc/tablero";

// Las secciones del pipeline están enumeradas en el check de la base y en
// SECCIONES_PIPELINE; lo que sigue fija que las de código se mantengan
// coherentes entre sí y que "Admin" —el segundo carril de tareas— se comporte
// como IT donde importa.

describe("secciones del pipeline", () => {
  it("las cuatro pestañas, en el orden en que se pintan", () => {
    expect(SECCIONES_PIPELINE.map((s) => s.id)).toEqual(["video", "guion", "it", "admin"]);
  });

  it("cada sección tiene cómo llamarse en una frase", () => {
    for (const { id } of SECCIONES_PIPELINE) {
      expect(NOMBRE_DE_CARRIL[id], id).toBeTruthy();
    }
  });

  it("?seccion=admin abre Admin; un valor inventado cae al default y 'todo' es la vista completa", () => {
    expect(parseSeccion("admin")).toBe("admin");
    expect(parseSeccion("todo")).toBeNull();
    expect(parseSeccion("finanzas")).toBe("video");
    expect(parseSeccionColumna("admin")).toBe("admin");
    expect(parseSeccionColumna("todo")).toBe("video");
  });
});

describe("esCarrilDeTareas", () => {
  it("IT y Admin son tareas; video y guiones no", () => {
    expect(esCarrilDeTareas("it")).toBe(true);
    expect(esCarrilDeTareas("admin")).toBe(true);
    expect(esCarrilDeTareas("video")).toBe(false);
    expect(esCarrilDeTareas("guion")).toBe(false);
  });

  it("sin columna no es tarea: una pieza huérfana sigue pidiendo Hero", () => {
    expect(esCarrilDeTareas(null)).toBe(false);
    expect(esCarrilDeTareas(undefined)).toBe(false);
  });
});
