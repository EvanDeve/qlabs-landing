import { describe, it, expect } from "vitest";
import {
  META_DIARIA,
  compararParaReparto,
  repartir,
  type EditorParaReparto,
  type VideoParaReparto,
} from "@/lib/ugc/reparto";

function video(id: string, publishDate: string | null, extra: Partial<VideoParaReparto> = {}): VideoParaReparto {
  return { id, publishDate, publishTime: null, createdAt: "2026-11-01T12:00:00Z", ...extra };
}

function videos(n: number, prefijo = "v"): VideoParaReparto[] {
  return Array.from({ length: n }, (_, i) =>
    video(`${prefijo}${String(i).padStart(2, "0")}`, `2026-12-${String(i + 1).padStart(2, "0")}`)
  );
}

function conteo(asignaciones: { ownerId: string }[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const a of asignaciones) c[a.ownerId] = (c[a.ownerId] ?? 0) + 1;
  return c;
}

describe("META_DIARIA", () => {
  it("es 8", () => expect(META_DIARIA).toBe(8));
});

describe("compararParaReparto", () => {
  it("atrasado viejo → atrasado nuevo → hoy → futuro → sin fecha", () => {
    // Hoy = 2026-11-20. Los atrasados salen primero solo por ir en orden ascendente.
    const desordenados = [
      video("sin-fecha", null),
      video("futuro", "2026-12-05"),
      video("hoy", "2026-11-20"),
      video("atrasado-nuevo", "2026-11-10"),
      video("atrasado-viejo", "2026-09-15"),
    ];
    expect([...desordenados].sort(compararParaReparto).map((v) => v.id)).toEqual([
      "atrasado-viejo",
      "atrasado-nuevo",
      "hoy",
      "futuro",
      "sin-fecha",
    ]);
  });

  it("desempata por hora (sin hora al final), después por creación, después por id", () => {
    const mismaFecha = [
      video("sin-hora", "2026-11-20"),
      video("tarde", "2026-11-20", { publishTime: "18:00" }),
      video("manana-nuevo", "2026-11-20", { publishTime: "09:00", createdAt: "2026-11-03T00:00:00Z" }),
      video("manana-viejo", "2026-11-20", { publishTime: "09:00", createdAt: "2026-11-02T00:00:00Z" }),
    ];
    expect([...mismaFecha].sort(compararParaReparto).map((v) => v.id)).toEqual([
      "manana-viejo",
      "manana-nuevo",
      "tarde",
      "sin-hora",
    ]);

    const gemelos = [video("b", "2026-11-20"), video("a", "2026-11-20")];
    expect([...gemelos].sort(compararParaReparto).map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("los sin fecha también se ordenan por creación", () => {
    const sinFecha = [
      video("nuevo", null, { createdAt: "2026-11-05T00:00:00Z" }),
      video("viejo", null, { createdAt: "2026-11-01T00:00:00Z" }),
    ];
    expect([...sinFecha].sort(compararParaReparto).map((v) => v.id)).toEqual(["viejo", "nuevo"]);
  });
});

describe("repartir", () => {
  it("un editor con 3 pendientes recibe 5", () => {
    const r = repartir([{ profileId: "ana", pendientes: 3 }], videos(10));
    expect(r).toHaveLength(5);
    expect(conteo(r)).toEqual({ ana: 5 });
  });

  it("con 8 o más no recibe ninguno", () => {
    expect(repartir([{ profileId: "ana", pendientes: 8 }], videos(10))).toEqual([]);
    expect(repartir([{ profileId: "ana", pendientes: 12 }], videos(10))).toEqual([]);
  });

  it("reparte en el orden de RF-05 aunque los disponibles vengan desordenados", () => {
    const r = repartir(
      [{ profileId: "ana", pendientes: 6 }],
      [video("sin-fecha", null), video("futuro", "2026-12-05"), video("atrasado", "2026-09-15")]
    );
    expect(r.map((a) => a.pieceId)).toEqual(["atrasado", "futuro"]);
  });

  it("cada video va al que menos tiene: el de 0 recibe los primeros 4, después alternan", () => {
    const r = repartir(
      [
        { profileId: "ana", pendientes: 4 },
        { profileId: "beto", pendientes: 0 },
      ],
      videos(12)
    );
    expect(r.slice(0, 4).every((a) => a.ownerId === "beto")).toBe(true);
    // Desde ahí los dos tienen 4: empate → orden del array (ana primero).
    expect(r.slice(4).map((a) => a.ownerId)).toEqual(["ana", "beto", "ana", "beto", "ana", "beto", "ana", "beto"]);
    expect(conteo(r)).toEqual({ ana: 4, beto: 8 });
  });

  it("empate → el orden del array", () => {
    const r = repartir(
      [
        { profileId: "carla", pendientes: 0 },
        { profileId: "ana", pendientes: 0 },
      ],
      videos(1)
    );
    expect(r).toEqual([{ pieceId: "v00", ownerId: "carla" }]);
  });

  it("si no alcanzan: 5 disponibles para 3 editores en 0 → 2/2/1", () => {
    const r = repartir(
      [
        { profileId: "ana", pendientes: 0 },
        { profileId: "beto", pendientes: 0 },
        { profileId: "carla", pendientes: 0 },
      ],
      videos(5)
    );
    expect(conteo(r)).toEqual({ ana: 2, beto: 2, carla: 1 });
    expect(r.map((a) => a.pieceId)).toEqual(["v00", "v01", "v02", "v03", "v04"]);
  });

  it("sin disponibles o sin editores → []", () => {
    expect(repartir([{ profileId: "ana", pendientes: 0 }], [])).toEqual([]);
    expect(repartir([], videos(5))).toEqual([]);
  });

  it("respeta una meta distinta", () => {
    expect(repartir([{ profileId: "ana", pendientes: 0 }], videos(10), 3)).toHaveLength(3);
  });

  it("no muta las entradas", () => {
    const editores: EditorParaReparto[] = [
      { profileId: "ana", pendientes: 2 },
      { profileId: "beto", pendientes: 0 },
    ];
    const disponibles = [video("b", null), video("a", "2026-11-01")];
    const copiaEditores = structuredClone(editores);
    const copiaDisponibles = structuredClone(disponibles);
    repartir(editores, disponibles);
    expect(editores).toEqual(copiaEditores);
    expect(disponibles).toEqual(copiaDisponibles);
  });

  it("es determinista", () => {
    const editores = [
      { profileId: "ana", pendientes: 1 },
      { profileId: "beto", pendientes: 3 },
    ];
    const lista = [...videos(9)].reverse();
    expect(repartir(editores, lista)).toEqual(repartir(editores, lista));
  });
});
