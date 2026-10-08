import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anonClient, makeUser, cleanup, type TestUser } from "./helpers";

/**
 * Piezas destacadas del media kit (spec 002, RF-01, RF-02, RF-05).
 *
 * El tope de 3 lo garantiza la base y no solo la pantalla: un check 1..3 más
 * un unique por creador. Acá se prueba que ni la rpc ni un update directo a
 * PostgREST dejan meter una cuarta, y que cada creador toca solo su book.
 */

let creador: TestUser;
let otro: TestUser;
let piezas: string[] = [];
let piezaAjena: string;

async function nuevaPieza(creatorId: string, position: number) {
  const { data, error } = await admin
    .from("portfolio_items")
    .insert({
      creator_id: creatorId,
      storage_path: `${creatorId}/rlstest-${position}.jpg`,
      media_type: "image",
      position,
    })
    .select("id")
    .single();
  if (error) throw new Error(`setup portfolio_items: ${error.message}`);
  return data.id as string;
}

async function ordenes(creatorId: string) {
  const { data } = await admin
    .from("portfolio_items")
    .select("id, orden_destacada")
    .eq("creator_id", creatorId)
    .not("orden_destacada", "is", null)
    .order("orden_destacada");
  return (data ?? []).map((p) => p.id);
}

beforeAll(async () => {
  [creador, otro] = await Promise.all([makeUser("creator"), makeUser("creator")]);
  piezas = [];
  for (let i = 0; i < 5; i++) piezas.push(await nuevaPieza(creador.id, i));
  piezaAjena = await nuevaPieza(otro.id, 0);
});

afterAll(cleanup);

describe("fijar_destacadas", () => {
  it("deja las 3 piezas en el orden pedido (RF-01)", async () => {
    const lista = [piezas[2], piezas[0], piezas[4]];
    const { error } = await creador.client.rpc("fijar_destacadas", { p_ids: lista });
    expect(error).toBeNull();
    expect(await ordenes(creador.id)).toEqual(lista);
  });

  it("reordenar cambia el orden sin chocar con el unique", async () => {
    const lista = [piezas[4], piezas[2], piezas[0]];
    const { error } = await creador.client.rpc("fijar_destacadas", { p_ids: lista });
    expect(error).toBeNull();
    expect(await ordenes(creador.id)).toEqual(lista);
  });

  it("con 4 piezas falla y no cambia nada (RF-02)", async () => {
    const antes = await ordenes(creador.id);
    const { error } = await creador.client.rpc("fijar_destacadas", { p_ids: piezas.slice(0, 4) });
    expect(error).not.toBeNull();
    expect(await ordenes(creador.id)).toEqual(antes);
  });

  it("una cuarta por update directo choca con la base (RF-02)", async () => {
    const libre = piezas.find((id) => ![piezas[4], piezas[2], piezas[0]].includes(id))!;
    for (const orden of [3, 4]) {
      const { error } = await creador.client
        .from("portfolio_items")
        .update({ orden_destacada: orden })
        .eq("id", libre);
      expect(error, `orden ${orden}`).not.toBeNull();
    }
  });

  it("no deja destacar piezas de otro creador", async () => {
    const { error } = await creador.client.rpc("fijar_destacadas", { p_ids: [piezaAjena] });
    expect(error).not.toBeNull();
    const { data } = await admin.from("portfolio_items").select("orden_destacada").eq("id", piezaAjena).single();
    expect(data!.orden_destacada).toBeNull();
  });

  it("anon no puede ejecutarla", async () => {
    const { error } = await anonClient().rpc("fijar_destacadas", { p_ids: [piezas[1]] });
    expect(error).not.toBeNull();
  });

  it("una lista vacía saca todas las destacadas", async () => {
    const { error } = await otro.client.rpc("fijar_destacadas", { p_ids: [piezaAjena] });
    expect(error).toBeNull();
    expect(await ordenes(otro.id)).toEqual([piezaAjena]);

    const { error: e2 } = await otro.client.rpc("fijar_destacadas", { p_ids: [] });
    expect(e2).toBeNull();
    expect(await ordenes(otro.id)).toEqual([]);
  });
});

describe("borrar una destacada (RF-05)", () => {
  it("la saca de las destacadas y deja lugar para otra", async () => {
    const lista = [piezas[4], piezas[2], piezas[0]];
    await creador.client.rpc("fijar_destacadas", { p_ids: lista });

    const { error } = await creador.client.from("portfolio_items").delete().eq("id", piezas[2]);
    expect(error).toBeNull();
    expect(await ordenes(creador.id)).toEqual([piezas[4], piezas[0]]);

    const { error: e2 } = await creador.client.rpc("fijar_destacadas", {
      p_ids: [piezas[4], piezas[0], piezas[1]],
    });
    expect(e2).toBeNull();
    expect(await ordenes(creador.id)).toEqual([piezas[4], piezas[0], piezas[1]]);
  });
});
