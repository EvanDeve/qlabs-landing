import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anonClient, makeUser, cleanup, type TestUser } from "./helpers";

// ⚠️ Requiere la migración 20260731000000_qos_wa_agent.sql aplicada en el
// proyecto Supabase (SQL Editor). Sin ella, todo esto falla con "relation
// wa_messages does not exist", que es la señal correcta.
//
// Lo que se cuida acá: `wa_messages` guarda lo que cada miembro del equipo
// tiene atrasado, y `staff_members` guarda ahora los teléfonos personales del
// equipo. Ninguna de las dos cosas le corresponde a un creador ni a una marca.

let elAdmin: TestUser;
let elCreador: TestUser;
let laMarca: TestUser;
let mensajeId: string;

beforeAll(async () => {
  [elAdmin, elCreador, laMarca] = await Promise.all([makeUser("admin"), makeUser("creator"), makeUser("brand")]);

  const { error: staffError } = await admin
    .from("staff_members")
    .insert({ profile_id: elAdmin.id, staff_role: "editor", phone_e164: "+50688887777", wa_opt_in: true });
  if (staffError) throw new Error(`no se pudo crear el staff de prueba: ${staffError.message}`);

  const { data, error } = await admin
    .from("wa_messages")
    .insert({
      profile_id: elAdmin.id,
      direction: "out",
      body: "Atrasado (1): Publicar Reel de prueba",
      dedupe_key: `test:${crypto.randomUUID()}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(`no se pudo crear el mensaje de prueba: ${error.message}`);
  mensajeId = data.id;
});

afterAll(async () => {
  // Los mensajes cuelgan de staff_members on delete cascade, y staff_members de
  // profiles, así que borrar las cuentas se lleva todo. Igual se verifica.
  await cleanup();
  const { data } = await admin.from("wa_messages").select("id").eq("id", mensajeId);
  expect(data ?? []).toHaveLength(0);
});

describe("wa_messages", () => {
  it("el admin sí los ve — si no, el panel de Equipo estaría vacío y el test de abajo no probaría nada", async () => {
    const { data } = await elAdmin.client.from("wa_messages").select("id").eq("id", mensajeId);

    expect(data).toHaveLength(1);
  });

  it("un creador no ve ninguno", async () => {
    const { data } = await elCreador.client.from("wa_messages").select("id");

    expect(data ?? []).toHaveLength(0);
  });

  it("una marca no ve ninguno", async () => {
    const { data } = await laMarca.client.from("wa_messages").select("id");

    expect(data ?? []).toHaveLength(0);
  });

  it("un visitante sin sesión tampoco", async () => {
    const { data } = await anonClient().from("wa_messages").select("id");

    expect(data ?? []).toHaveLength(0);
  });

  // Sin policy de insert, ni siquiera un admin escribe desde el navegador: las
  // filas las crean el cron y el webhook con service-role. Así una sesión
  // secuestrada no puede fabricar historial.
  it("nadie inserta desde una sesión de navegador, ni el admin", async () => {
    const { error } = await elAdmin.client
      .from("wa_messages")
      .insert({ profile_id: elAdmin.id, direction: "out", body: "colado" });

    expect(error).not.toBeNull();
  });
});

describe("staff_members", () => {
  it("no le filtra el teléfono del equipo a un creador", async () => {
    const { data } = await elCreador.client.from("staff_members").select("phone_e164");

    expect(data ?? []).toHaveLength(0);
  });

  it("no le filtra el teléfono del equipo a una marca", async () => {
    const { data } = await laMarca.client.from("staff_members").select("phone_e164");

    expect(data ?? []).toHaveLength(0);
  });
});

describe("garantías de la base", () => {
  // Este índice es TODA la garantía de que el recordatorio diario salga una
  // sola vez. Vercel reintenta un cron que tarda o devuelve 5xx, así que sin
  // esto un timeout se traduce en mensajes duplicados al equipo.
  it("el índice de dedupe impide mandar dos veces el mismo recordatorio", async () => {
    const clave = `daily:${crypto.randomUUID()}`;
    const fila = { profile_id: elAdmin.id, direction: "out", body: "x", dedupe_key: clave };

    const primero = await admin.from("wa_messages").insert(fila);
    const segundo = await admin.from("wa_messages").insert(fila);

    expect(primero.error).toBeNull();
    expect(segundo.error?.code).toBe("23505");
  });

  it("rechaza un teléfono que no esté en E.164", async () => {
    const { error } = await admin
      .from("staff_members")
      .update({ phone_e164: "8888-7777" })
      .eq("profile_id", elAdmin.id);

    expect(error).not.toBeNull();
  });
});
