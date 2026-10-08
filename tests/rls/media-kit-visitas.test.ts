import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { admin, anonClient, makeUser, cleanup, verifyCreator, type TestUser } from "./helpers";
import { diaCR } from "@/lib/ugc/calendar";
import { inicioVentanaVisitas } from "@/lib/ugc/visitas-kit";

/**
 * Visitas del media kit (spec 002, RF-13..RF-21).
 *
 * Cualquiera puede registrar una visita (es un kit público), pero solo el
 * dueño y el equipo leen los totales, y nadie lee las filas: dirían qué día
 * entró cada marca.
 */

let creador: TestUser;
let creadorSinVerificar: TestUser;
let otroCreador: TestUser;
let marca: TestUser;
let staff: TestUser;
const desde = () => inicioVentanaVisitas(diaCR(new Date()));

async function filas(creatorId: string) {
  const { count } = await admin
    .from("kit_visitas")
    .select("*", { count: "exact", head: true })
    .eq("creator_id", creatorId);
  return count ?? 0;
}

async function resumen(u: TestUser, creatorId: string) {
  const { data, error } = await u.client.rpc("resumen_visitas_kit", { p_creator: creatorId, p_desde: desde() });
  if (error) throw error;
  const r = (data ?? [])[0];
  return { total: Number(r?.total ?? 0), deMarcas: Number(r?.de_marcas ?? 0) };
}

beforeAll(async () => {
  [creador, creadorSinVerificar, otroCreador, marca, staff] = await Promise.all([
    makeUser("creator"),
    makeUser("creator"),
    makeUser("creator"),
    makeUser("brand"),
    makeUser("admin"),
  ]);
  for (const u of [creador, creadorSinVerificar, otroCreador]) {
    const { error } = await admin
      .from("creator_profiles")
      .insert({ profile_id: u.id, handle: `@vis.${u.id.slice(0, 8)}` });
    if (error) throw new Error(`setup creator_profiles: ${error.message}`);
  }
  await verifyCreator(creador.id);
  await verifyCreator(otroCreador.id);
});

afterAll(cleanup);

describe("registrar_visita_kit", () => {
  const anonimo = randomUUID();

  it("una visita sin sesión suma 1, y repetirla el mismo día no suma (RF-13, RF-16)", async () => {
    for (let i = 0; i < 2; i++) {
      const { error } = await anonClient().rpc("registrar_visita_kit", { p_creator: creador.id, p_anonimo: anonimo });
      expect(error).toBeNull();
    }
    expect(await filas(creador.id)).toBe(1);
  });

  it("no guarda la cookie en claro", async () => {
    const { data } = await admin.from("kit_visitas").select("huella").eq("creator_id", creador.id);
    expect(JSON.stringify(data)).not.toContain(anonimo);
  });

  it("otro visitante sin sesión suma el suyo", async () => {
    await anonClient().rpc("registrar_visita_kit", { p_creator: creador.id, p_anonimo: randomUUID() });
    expect(await filas(creador.id)).toBe(2);
  });

  it("sin sesión y sin cookie no registra nada", async () => {
    await anonClient().rpc("registrar_visita_kit", { p_creator: creador.id });
    expect(await filas(creador.id)).toBe(2);
  });

  it("el dueño y el equipo no suman (RF-14)", async () => {
    await creador.client.rpc("registrar_visita_kit", { p_creator: creador.id });
    await staff.client.rpc("registrar_visita_kit", { p_creator: creador.id });
    expect(await filas(creador.id)).toBe(2);
  });

  it("una marca suma como visita de marca, una sola por día", async () => {
    await marca.client.rpc("registrar_visita_kit", { p_creator: creador.id });
    await marca.client.rpc("registrar_visita_kit", { p_creator: creador.id });
    expect(await filas(creador.id)).toBe(3);
    expect(await resumen(creador, creador.id)).toEqual({ total: 3, deMarcas: 1 });
  });

  it("un creador sin verificar no suma visitas (RF-21)", async () => {
    await anonClient().rpc("registrar_visita_kit", { p_creator: creadorSinVerificar.id, p_anonimo: randomUUID() });
    expect(await filas(creadorSinVerificar.id)).toBe(0);
  });
});

describe("resumen_visitas_kit (RF-17, RF-19)", () => {
  it("una visita de hace 31 días no entra en la ventana", async () => {
    const viejo = new Date(`${diaCR(new Date())}T12:00:00Z`);
    viejo.setUTCDate(viejo.getUTCDate() - 31);
    const { error } = await admin.from("kit_visitas").insert({
      creator_id: creador.id,
      dia: viejo.toISOString().slice(0, 10),
      huella: "rlstest-vieja",
      es_marca: true,
    });
    if (error) throw error;
    expect(await resumen(creador, creador.id)).toEqual({ total: 3, deMarcas: 1 });
  });

  it("el equipo ve los totales", async () => {
    expect(await resumen(staff, creador.id)).toEqual({ total: 3, deMarcas: 1 });
  });

  it("otro creador y una marca reciben cero de un kit ajeno", async () => {
    for (const u of [otroCreador, marca]) {
      expect(await resumen(u, creador.id)).toEqual({ total: 0, deMarcas: 0 });
    }
  });

  it("anon no puede pedir totales", async () => {
    const { error } = await anonClient().rpc("resumen_visitas_kit", { p_creator: creador.id, p_desde: desde() });
    expect(error).not.toBeNull();
  });

  it("nadie lee las filas: ni anon, ni el dueño, ni una marca", async () => {
    for (const cliente of [anonClient(), creador.client, marca.client]) {
      const { data } = await cliente.from("kit_visitas").select("*").eq("creator_id", creador.id);
      expect(data ?? []).toEqual([]);
    }
  });
});
