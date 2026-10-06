import { describe, it, expect } from "vitest";
import {
  esCarrilDeTareas,
  parseSeccion,
  parseSeccionColumna,
  type PipelineBoard,
} from "@/lib/ugc/content-columns";
import { columnaFinalDe, nombreDeCarril } from "@/lib/ugc/tablero";

// Desde 20261006120000 los boards son filas de pipeline_boards y cada persona
// ve solo los suyos. Lo que sigue fija cómo se resuelve la pestaña de la URL
// contra ESOS boards, y que el tipo de board se lea del id sin ir a la base.

const TODOS: PipelineBoard[] = [
  { id: "video", name: "Videos", kind: "videos" },
  { id: "guion", name: "Cronogramas", kind: "videos" },
  { id: "it", name: "IT", kind: "tareas" },
  { id: "admin", name: "Admin", kind: "tareas" },
];

describe("parseSeccion", () => {
  it("?seccion=admin abre Admin y 'todo' es la vista completa", () => {
    expect(parseSeccion("admin", TODOS)).toBe("admin");
    expect(parseSeccion("todo", TODOS)).toBeNull();
  });

  it("un valor inventado cae al primer board visible", () => {
    expect(parseSeccion("finanzas", TODOS)).toBe("video");
    expect(parseSeccion(undefined, TODOS)).toBe("video");
  });

  it("un board donde no estás no se abre aunque venga en la URL: cae al primero tuyo", () => {
    const soloIt: PipelineBoard[] = [{ id: "it", name: "IT", kind: "tareas" }];
    expect(parseSeccion("video", soloIt)).toBe("it");
    expect(parseSeccion(undefined, soloIt)).toBe("it");
  });

  it("la columna nueva no puede vivir en 'todo'", () => {
    expect(parseSeccionColumna("admin")).toBe("admin");
    expect(parseSeccionColumna("t_ab12cd34")).toBe("t_ab12cd34");
    expect(parseSeccionColumna("todo")).toBe("video");
    expect(parseSeccionColumna(null)).toBe("video");
  });
});

describe("esCarrilDeTareas", () => {
  it("IT y Admin son tareas; video y guiones no", () => {
    expect(esCarrilDeTareas("it")).toBe(true);
    expect(esCarrilDeTareas("admin")).toBe(true);
    expect(esCarrilDeTareas("video")).toBe(false);
    expect(esCarrilDeTareas("guion")).toBe(false);
  });

  it("los boards nuevos dicen su tipo en el id", () => {
    expect(esCarrilDeTareas("t_ab12cd34")).toBe(true);
    expect(esCarrilDeTareas("v_ab12cd34")).toBe(false);
  });

  it("sin columna no es tarea: una pieza huérfana sigue pidiendo Hero", () => {
    expect(esCarrilDeTareas(null)).toBe(false);
    expect(esCarrilDeTareas(undefined)).toBe(false);
  });
});

describe("McLovin nombra el board", () => {
  it("los de siempre por su nombre; uno nuevo no le lee el id a nadie", () => {
    expect(nombreDeCarril("it")).toBe("el carril de IT");
    expect(nombreDeCarril("t_ab12cd34")).toBe("ese board");
  });

  it("un board nuevo sin columna final lo dice sin mostrar el id", () => {
    const columnas = [{ id: "c1", name: "Sin Empezar", is_done: false, section: "t_ab12cd34" }];
    const r = columnaFinalDe(columnas, "c1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.nota).not.toContain("t_ab12cd34");
  });
});
