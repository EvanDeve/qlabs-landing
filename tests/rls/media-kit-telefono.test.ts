import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anonClient, makeUser, cleanup, verifyCreator, type TestUser } from "./helpers";

/**
 * El teléfono del creador en su media kit (spec 002, RF-06..RF-12c).
 *
 * El número vive en `creator_profiles`, cerrada al dueño y al equipo, y la
 * vista pública solo dice si hay uno. La única puerta para una marca es
 * `ver_telefono_creador`, que en el mismo acto le avisa al creador. Lo que se
 * prueba es la consecuencia: que nadie que no sea una marca verificada (o Q
 * Labs) se lleve el número, y que el aviso salga una vez por marca y por día.
 */

const NUMERO = "+50688887777";

let creador: TestUser;
let creadorOculto: TestUser;
let creadorSinVerificar: TestUser;
let otroCreador: TestUser;
let marca: TestUser;
let marca2: TestUser;
let marcaSinVerificar: TestUser;
let staff: TestUser;
const marcas: string[] = [];

async function perfilDeCreador(u: TestUser, verificado: boolean) {
  const { error } = await admin.from("creator_profiles").insert({
    profile_id: u.id,
    handle: `@tel.${u.id.slice(0, 8)}`,
  });
  if (error) throw new Error(`setup creator_profiles: ${error.message}`);
  if (verificado) await verifyCreator(u.id);
}

async function perfilDeMarca(u: TestUser, verificada: boolean, nombre: string) {
  const { error } = await admin.from("brand_profiles").insert({
    profile_id: u.id,
    brand_name: nombre,
    industry: "Restaurante",
    verified: verificada,
  });
  if (error) throw new Error(`setup brand_profiles: ${error.message}`);
  marcas.push(u.id);
}

async function avisos(creatorId: string) {
  const { data } = await admin
    .from("notifications")
    .select("payload")
    .eq("profile_id", creatorId)
    .eq("type", "telefono_visto");
  return data ?? [];
}

beforeAll(async () => {
  [creador, creadorOculto, creadorSinVerificar, otroCreador, marca, marca2, marcaSinVerificar, staff] =
    await Promise.all([
      makeUser("creator"),
      makeUser("creator"),
      makeUser("creator"),
      makeUser("creator"),
      makeUser("brand"),
      makeUser("brand"),
      makeUser("brand"),
      makeUser("admin"),
    ]);
  await Promise.all([
    perfilDeCreador(creador, true),
    perfilDeCreador(creadorOculto, true),
    perfilDeCreador(creadorSinVerificar, false),
    perfilDeCreador(otroCreador, true),
    perfilDeMarca(marca, true, "Marca Tel Test"),
    perfilDeMarca(marca2, true, "Marca Tel Test 2"),
    perfilDeMarca(marcaSinVerificar, false, "Marca Tel Sin Verificar"),
  ]);

  // El creador sin verificar también lo muestra: lo que lo oculta es que no
  // está verificado, no su elección.
  for (const u of [creador, creadorSinVerificar]) {
    const { error } = await u.client
      .from("creator_profiles")
      .update({ telefono_e164: NUMERO, mostrar_telefono: true })
      .eq("profile_id", u.id);
    if (error) throw new Error(`setup teléfono: ${error.message}`);
  }
  const { error } = await creadorOculto.client
    .from("creator_profiles")
    .update({ telefono_e164: NUMERO })
    .eq("profile_id", creadorOculto.id);
  if (error) throw new Error(`setup teléfono oculto: ${error.message}`);
});

afterAll(async () => {
  // Los avisos van a creadores de prueba y se irían en cascada, pero se
  // borran igual por si alguno cayó en otra cuenta: no se deja basura en una
  // campanita real.
  if (marcas.length) {
    const { error } = await admin
      .from("notifications")
      .delete()
      .eq("type", "telefono_visto")
      .in("payload->>brand_id", marcas);
    if (error) throw new Error(`no se limpiaron los avisos de prueba: ${error.message}`);
  }
  await cleanup();
});

describe("el creador carga su teléfono (RF-06, RF-07)", () => {
  it("por defecto no se muestra", async () => {
    const { data } = await admin
      .from("creator_profiles")
      .select("mostrar_telefono")
      .eq("profile_id", otroCreador.id)
      .single();
    expect(data!.mostrar_telefono).toBe(false);
  });

  it("no se puede mostrar sin número", async () => {
    const { error } = await otroCreador.client
      .from("creator_profiles")
      .update({ mostrar_telefono: true })
      .eq("profile_id", otroCreador.id);
    expect(error).not.toBeNull();
  });

  it("un número mal formado rebota en la base", async () => {
    const { error } = await otroCreador.client
      .from("creator_profiles")
      .update({ telefono_e164: "8888 7777" })
      .eq("profile_id", otroCreador.id);
    expect(error).not.toBeNull();
  });
});

describe("nadie se lleva el número por fuera de la puerta (RF-10)", () => {
  it("la vista pública no tiene el número, solo si hay uno", async () => {
    for (const cliente of [anonClient(), marca.client]) {
      const { error } = await cliente.from("creator_public_profiles").select("telefono_e164").limit(1);
      expect(error).not.toBeNull();
    }
    const { data } = await anonClient()
      .from("creator_public_profiles")
      .select("profile_id, tiene_telefono")
      .in("profile_id", [creador.id, creadorOculto.id]);
    const porId = new Map((data ?? []).map((r) => [r.profile_id, r.tiene_telefono]));
    expect(porId.get(creador.id)).toBe(true);
    expect(porId.get(creadorOculto.id)).toBe(false); // RF-12
  });

  it("la tabla no se la da a anon, a una marca ni a otro creador", async () => {
    for (const cliente of [anonClient(), marca.client, otroCreador.client]) {
      const { data } = await cliente.from("creator_profiles").select("telefono_e164").eq("profile_id", creador.id);
      expect(data ?? []).toEqual([]);
    }
  });

  it("anon no puede ejecutar ver_telefono_creador", async () => {
    const { error } = await anonClient().rpc("ver_telefono_creador", { p_creator: creador.id });
    expect(error).not.toBeNull();
  });

  it("otro creador y una marca sin verificar reciben null", async () => {
    for (const u of [otroCreador, marcaSinVerificar]) {
      const { data, error } = await u.client.rpc("ver_telefono_creador", { p_creator: creador.id });
      expect(error).toBeNull();
      expect(data).toBeNull();
    }
  });

  it("de un creador sin verificar o que no lo muestra, nadie recibe nada", async () => {
    for (const p_creator of [creadorSinVerificar.id, creadorOculto.id]) {
      const { data } = await marca.client.rpc("ver_telefono_creador", { p_creator });
      expect(data).toBeNull();
    }
  });

  it("el equipo lo ve sin avisarle al creador", async () => {
    const { data } = await staff.client.rpc("ver_telefono_creador", { p_creator: creador.id });
    expect(data).toBe(NUMERO);
    expect(await avisos(creador.id)).toEqual([]);
  });
});

describe("una marca verificada lo ve y el creador se entera (RF-08, RF-12b, RF-12c)", () => {
  it("recibe el número y el creador tiene un aviso con el nombre de la marca", async () => {
    const { data } = await marca.client.rpc("ver_telefono_creador", { p_creator: creador.id });
    expect(data).toBe(NUMERO);

    const lista = await avisos(creador.id);
    expect(lista).toHaveLength(1);
    expect(lista[0].payload).toMatchObject({ brand_id: marca.id, brand_name: "Marca Tel Test" });
  });

  it("la misma marca el mismo día no genera otro aviso", async () => {
    await marca.client.rpc("ver_telefono_creador", { p_creator: creador.id });
    await marca.client.rpc("ver_telefono_creador", { p_creator: creador.id });
    expect(await avisos(creador.id)).toHaveLength(1);
  });

  it("otra marca sí genera el suyo", async () => {
    await marca2.client.rpc("ver_telefono_creador", { p_creator: creador.id });
    expect(await avisos(creador.id)).toHaveLength(2);
  });

  it("ningún admin recibe estos avisos", async () => {
    const { data } = await admin
      .from("notifications")
      .select("profile_id")
      .eq("type", "telefono_visto")
      .in("payload->>brand_id", marcas);
    expect(new Set((data ?? []).map((r) => r.profile_id))).toEqual(new Set([creador.id]));
  });

  it("una marca a la que le sacan la verificación deja de verlo", async () => {
    const { error } = await admin.from("brand_profiles").update({ verified: false }).eq("profile_id", marca2.id);
    if (error) throw error;
    const { data } = await marca2.client.rpc("ver_telefono_creador", { p_creator: creador.id });
    expect(data).toBeNull();
  });
});
