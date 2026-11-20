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

// ───────────── Reordenar columnas y dónde nace una nueva ─────────────
import { moverEnCarril, posicionParaNueva, type ColumnaOrdenable } from "@/lib/ugc/content-columns";

const col = (id: string, position: number, created_at = "2026-01-01T00:00:00Z"): ColumnaOrdenable => ({ id, position, created_at });
// El board video de prod al 2026-11-20: Por Grabar quedó al final.
const video = [col("editar", 3), col("revision", 4), col("terminado", 5), col("publicado", 6), col("grabar", 16)];
const aplicar = (cols: ColumnaOrdenable[], cambios: { id: string; position: number }[]) =>
  cols
    .map((c) => ({ ...c, position: cambios.find((x) => x.id === c.id)?.position ?? c.position }))
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
    .map((c) => c.id);

describe("moverEnCarril", () => {
  it("mover antes intercambia con la de la izquierda y reusa las mismas posiciones", () => {
    const cambios = moverEnCarril(video, "grabar", -1)!;
    expect(aplicar(video, cambios)).toEqual(["editar", "revision", "terminado", "grabar", "publicado"]);
    expect([...cambios].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "grabar", position: 6 },
      { id: "publicado", position: 16 },
    ]);
  });

  it("llevar Por Grabar al principio, de a un paso", () => {
    let cols = video;
    for (let i = 0; i < 4; i++) {
      const cambios = moverEnCarril(cols, "grabar", -1)!;
      cols = cols.map((c) => ({ ...c, position: cambios.find((x) => x.id === c.id)?.position ?? c.position }));
    }
    expect(aplicar(cols, [])).toEqual(["grabar", "editar", "revision", "terminado", "publicado"]);
    // Las posiciones son las mismas de antes: no se pisan con las de otros boards.
    expect(cols.map((c) => c.position).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 16]);
  });

  it("mover después", () => {
    expect(aplicar(video, moverEnCarril(video, "editar", 1)!)).toEqual(["revision", "editar", "terminado", "publicado", "grabar"]);
  });

  it("en los extremos no hace nada", () => {
    expect(moverEnCarril(video, "editar", -1)).toBeNull();
    expect(moverEnCarril(video, "grabar", 1)).toBeNull();
    expect(moverEnCarril(video, "no-existe", 1)).toBeNull();
  });

  it("con posiciones repetidas primero las separa, y el orden lo da created_at", () => {
    const empatadas = [col("a", 2, "2026-01-01T00:00:00Z"), col("b", 2, "2026-01-02T00:00:00Z"), col("c", 3)];
    const cambios = moverEnCarril(empatadas, "c", -1)!;
    expect(aplicar(empatadas, cambios)).toEqual(["a", "c", "b"]);
    const finales = empatadas.map((c) => cambios.find((x) => x.id === c.id)?.position ?? c.position);
    expect(new Set(finales).size).toBe(3);
  });

  it("no muta la entrada", () => {
    const copia = structuredClone(video);
    moverEnCarril(video, "grabar", -1);
    expect(video).toEqual(copia);
  });
});

describe("posicionParaNueva", () => {
  it("nace antes de la final: la final corre un lugar y la nueva toma el suyo", () => {
    expect(posicionParaNueva(video, 20)).toEqual({ position: 16, correrFinal: { id: "grabar", position: 17 } });
  });

  it("un board vacío arranca después de todo lo que existe", () => {
    expect(posicionParaNueva([], 20)).toEqual({ position: 21, correrFinal: null });
  });

  it("con una sola columna, la nueva va antes y la única sigue siendo la final", () => {
    expect(posicionParaNueva([col("unica", 7)], 20)).toEqual({ position: 7, correrFinal: { id: "unica", position: 8 } });
  });
});
