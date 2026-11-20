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

// ───────────── ejecutarReparto (T12) con un cliente falso ─────────────
import { ejecutarReparto } from "@/lib/ugc/edicion-datos";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Tablas = {
  repartos_de_edicion?: { dia: string }[];
  staff_members?: { profile_id: string; staff_role: string; active: boolean; created_at: string }[];
  videos_por_editar?: { id: string; owner_id: string | null; publish_date: string | null; publish_time: string | null; created_at: string }[];
};

/** Un PostgREST de juguete: eq/is/order/range/maybeSingle sobre arrays en memoria. */
function clienteFalso(tablas: Tablas, asignadosQueDevuelve = 0) {
  const llamadas: string[] = [];
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const from = (tabla: keyof Tablas) => {
    llamadas.push(tabla);
    let filas = [...((tablas[tabla] ?? []) as Record<string, unknown>[])];
    const b = {
      select: () => b,
      eq: (c: string, v: unknown) => ((filas = filas.filter((f) => f[c] === v)), b),
      is: (c: string, v: unknown) => ((filas = filas.filter((f) => f[c] === v)), b),
      order: (c: string) => ((filas = [...filas].sort((x, y) => String(x[c]).localeCompare(String(y[c])))), b),
      limit: (n: number) => ((filas = filas.slice(0, n)), b),
      range: (d: number, h: number) => Promise.resolve({ data: filas.slice(d, h + 1), error: null }),
      maybeSingle: () => Promise.resolve({ data: filas[0] ?? null, error: null }),
      then: (ok: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: filas, error: null }).then(ok),
    };
    return b;
  };
  const rpc = (fn: string, args: Record<string, unknown>) => {
    llamadas.push(`rpc:${fn}`);
    rpcs.push({ fn, args });
    return Promise.resolve({ data: asignadosQueDevuelve, error: null });
  };
  return { cliente: { from, rpc } as unknown as SupabaseClient<Database>, llamadas, rpcs };
}

const VIERNES_6AM = new Date("2026-11-20T12:00:00Z"); // 6:00 CR
const SABADO_6AM = new Date("2026-11-21T12:00:00Z");

describe("ejecutarReparto", () => {
  it("sábado → no-habil sin tocar la base", async () => {
    const { cliente, llamadas } = clienteFalso({});
    const r = await ejecutarReparto(cliente, SABADO_6AM);
    expect(r).toEqual({ dia: "2026-11-21", estado: "no-habil", pedidas: 0, asignados: 0 });
    expect(llamadas).toEqual([]);
  });

  it("ya hay fila del día → ya-repartido sin llamar a la rpc", async () => {
    const { cliente, llamadas } = clienteFalso({ repartos_de_edicion: [{ dia: "2026-11-20" }] });
    const r = await ejecutarReparto(cliente, VIERNES_6AM);
    expect(r.estado).toBe("ya-repartido");
    expect(llamadas.some((l) => l.startsWith("rpc:"))).toBe(false);
  });

  it("día hábil → rpc con lo que decide repartir, solo editores activos y en orden de created_at", async () => {
    const vid = (id: string, owner: string | null, fecha: string | null) => ({
      id, owner_id: owner, publish_date: fecha, publish_time: null, created_at: "2026-11-01T00:00:00Z",
    });
    const { cliente, rpcs } = clienteFalso(
      {
        repartos_de_edicion: [{ dia: "2026-11-19" }], // ayer sí, hoy no
        staff_members: [
          { profile_id: "beto", staff_role: "editor", active: true, created_at: "2026-11-18T00:00:00Z" },
          { profile_id: "ana", staff_role: "editor", active: true, created_at: "2026-07-31T00:00:00Z" },
          { profile_id: "inactivo", staff_role: "editor", active: false, created_at: "2026-01-01T00:00:00Z" },
          { profile_id: "dire", staff_role: "director", active: true, created_at: "2026-01-01T00:00:00Z" },
        ],
        videos_por_editar: [
          // ana ya tiene 7, beto 0
          ...Array.from({ length: 7 }, (_, i) => vid(`a${i}`, "ana", "2026-12-01")),
          vid("viejo", null, "2026-09-01"),
          vid("nuevo", null, "2026-11-25"),
          vid("sin-fecha", null, null),
        ],
      },
      3
    );
    const r = await ejecutarReparto(cliente, VIERNES_6AM);
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0].fn).toBe("aplicar_reparto_de_edicion");
    expect(rpcs[0].args.p_dia).toBe("2026-11-20");
    // beto (0) se lleva todo: ana (7) recibiría solo con empate, y nunca empatan.
    expect(rpcs[0].args.p_asignaciones).toEqual([
      { piece_id: "viejo", owner_id: "beto" },
      { piece_id: "nuevo", owner_id: "beto" },
      { piece_id: "sin-fecha", owner_id: "beto" },
    ]);
    expect(r).toEqual({ dia: "2026-11-20", estado: "repartido", pedidas: 3, asignados: 3 });
  });

  it("el orden de created_at decide el empate", async () => {
    const { cliente, rpcs } = clienteFalso({
      staff_members: [
        { profile_id: "nuevo", staff_role: "editor", active: true, created_at: "2026-11-18T00:00:00Z" },
        { profile_id: "viejo", staff_role: "editor", active: true, created_at: "2026-07-31T00:00:00Z" },
      ],
      videos_por_editar: [{ id: "x", owner_id: null, publish_date: null, publish_time: null, created_at: "2026-11-01T00:00:00Z" }],
    });
    await ejecutarReparto(cliente, VIERNES_6AM);
    expect(rpcs[0].args.p_asignaciones).toEqual([{ piece_id: "x", owner_id: "viejo" }]);
  });
});
