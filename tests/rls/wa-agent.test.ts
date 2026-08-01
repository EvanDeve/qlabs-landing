import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anonClient, makeUser, cleanup, type TestUser } from "./helpers";
import type { WaActionStatus } from "@/lib/database.types";

// ⚠️ Requiere las migraciones 20260731000000_qos_wa_agent.sql y
// 20260802000000_mclovin.sql aplicadas en el proyecto Supabase (SQL Editor).
// Sin ellas, todo esto falla con "relation ... does not exist", que es la señal
// correcta.
//
// Lo que se cuida acá: `wa_messages` guarda lo que cada miembro del equipo
// tiene atrasado, `staff_members` guarda los teléfonos personales del equipo, y
// `wa_agent_actions` guarda lo que el agente hizo en el tablero de cada quien.
// Nada de eso le corresponde a un creador ni a una marca.

let elAdmin: TestUser;
let elCreador: TestUser;
let laMarca: TestUser;
let mensajeId: string;
let accionId: string;

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

  const { data: accion, error: accionError } = await admin
    .from("wa_agent_actions")
    .insert({
      profile_id: elAdmin.id,
      kind: "crear_pieza",
      payload: { titulo: "Reel de prueba", cliente: "Zonna", fecha: "2026-08-06", tipo: "grabar" },
      status: "ejecutada",
    })
    .select("id")
    .single();
  if (accionError) throw new Error(`no se pudo crear la acción de prueba: ${accionError.message}`);
  accionId = accion.id;
});

afterAll(async () => {
  // Los mensajes cuelgan de staff_members on delete cascade, y staff_members de
  // profiles, así que borrar las cuentas se lleva todo. Igual se verifica.
  await cleanup();
  const { data } = await admin.from("wa_messages").select("id").eq("id", mensajeId);
  expect(data ?? []).toHaveLength(0);

  const { data: acciones } = await admin.from("wa_agent_actions").select("id").eq("id", accionId);
  expect(acciones ?? []).toHaveLength(0);
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

describe("wa_agent_actions", () => {
  it("el admin sí las ve — es lo que muestra el panel de McLovin", async () => {
    const { data } = await elAdmin.client.from("wa_agent_actions").select("id").eq("id", accionId);

    expect(data).toHaveLength(1);
  });

  it("un creador no ve ninguna", async () => {
    const { data } = await elCreador.client.from("wa_agent_actions").select("id");

    expect(data ?? []).toHaveLength(0);
  });

  it("una marca no ve ninguna", async () => {
    const { data } = await laMarca.client.from("wa_agent_actions").select("id");

    expect(data ?? []).toHaveLength(0);
  });

  it("un visitante sin sesión tampoco", async () => {
    const { data } = await anonClient().from("wa_agent_actions").select("id");

    expect(data ?? []).toHaveLength(0);
  });

  // Sin policy de insert ni de update: las escribe el webhook con service-role.
  // Si una sesión de navegador pudiera insertar una fila en estado `propuesta`,
  // podría fabricar una confirmación pendiente para otra persona.
  it("nadie las escribe desde una sesión de navegador, ni el admin", async () => {
    const insert = await elAdmin.client
      .from("wa_agent_actions")
      .insert({ profile_id: elAdmin.id, kind: "crear_pieza", payload: {}, status: "propuesta" });
    const update = await elAdmin.client
      .from("wa_agent_actions")
      .update({ status: "ejecutada" })
      .eq("id", accionId)
      .select("id");

    expect(insert.error).not.toBeNull();
    // Un update sin policy no da error: no encuentra filas que autorizar y
    // devuelve vacío. Lo que importa es que no haya tocado nada.
    expect(update.data ?? []).toHaveLength(0);
  });
});

describe("agent_settings", () => {
  // Ojo: `agent_settings` es una fila única y compartida — estos tests corren
  // contra el proyecto de verdad, así que lo que se toca se devuelve como
  // estaba. Si no, un test dejaría al agente hablando distinto en producción.
  it("el admin puede leerla y editarla — es el panel de McLovin", async () => {
    const { data } = await elAdmin.client.from("agent_settings").select("instrucciones").eq("id", true).single();
    expect(data).not.toBeNull();
    const original = data!.instrucciones;

    const { error } = await elAdmin.client
      .from("agent_settings")
      .update({ instrucciones: "prueba de RLS" })
      .eq("id", true);
    expect(error).toBeNull();

    await admin.from("agent_settings").update({ instrucciones: original }).eq("id", true);

    const { data: despues } = await admin.from("agent_settings").select("instrucciones").eq("id", true).single();
    expect(despues?.instrucciones).toBe(original);
  });

  // La personalidad define lo que un agente le escribe al equipo por WhatsApp.
  // Un creador que pudiera editarla le estaría dictando mensajes a la agencia.
  it("un creador no la ve ni la edita", async () => {
    const { data } = await elCreador.client.from("agent_settings").select("nombre");
    expect(data ?? []).toHaveLength(0);

    const { data: tocadas } = await elCreador.client
      .from("agent_settings")
      .update({ nombre: "Hackeado" })
      .eq("id", true)
      .select("id");
    expect(tocadas ?? []).toHaveLength(0);
  });

  it("una marca tampoco", async () => {
    const { data } = await laMarca.client.from("agent_settings").select("nombre");
    expect(data ?? []).toHaveLength(0);
  });

  it("un visitante sin sesión tampoco", async () => {
    const { data } = await anonClient().from("agent_settings").select("nombre");
    expect(data ?? []).toHaveLength(0);
  });

  // La fila es una sola y la crea la migración. Una segunda dejaría dos
  // personalidades y el agente usaría la que devolviera el planner ese día.
  it("no se puede agregar una segunda fila", async () => {
    const { error } = await admin.from("agent_settings").insert({ id: true, nombre: "Otro" });

    expect(error).not.toBeNull();
  });
});

// Acá adentro hay teléfonos de gente que no es del equipo ni tiene cuenta —
// alguien que preguntó por un presupuesto. Es el dato más sensible que guarda
// McLovin y nadie del marketplace tiene nada que hacer leyéndolo.
describe("wa_public_messages", () => {
  let publicoId: string;

  beforeAll(async () => {
    const { data, error } = await admin
      .from("wa_public_messages")
      .insert({ phone_e164: "+50600000001", direction: "in", body: "hola, hacen páginas?", status: "received" })
      .select("id")
      .single();
    if (error) throw new Error(`no se pudo crear el mensaje público de prueba: ${error.message}`);
    publicoId = data.id;
  });

  afterAll(async () => {
    // No cuelga de ninguna cuenta, así que cleanup() no se lo lleva.
    await admin.from("wa_public_messages").delete().eq("id", publicoId);
  });

  it("el admin sí los ve — es lo que muestra el panel", async () => {
    const { data } = await elAdmin.client.from("wa_public_messages").select("id").eq("id", publicoId);

    expect(data).toHaveLength(1);
  });

  it("un creador no ve ninguno", async () => {
    const { data } = await elCreador.client.from("wa_public_messages").select("phone_e164");

    expect(data ?? []).toHaveLength(0);
  });

  it("una marca no ve ninguno", async () => {
    const { data } = await laMarca.client.from("wa_public_messages").select("phone_e164");

    expect(data ?? []).toHaveLength(0);
  });

  it("un visitante sin sesión tampoco", async () => {
    const { data } = await anonClient().from("wa_public_messages").select("phone_e164");

    expect(data ?? []).toHaveLength(0);
  });

  it("nadie los escribe desde una sesión de navegador, ni el admin", async () => {
    const { error } = await elAdmin.client
      .from("wa_public_messages")
      .insert({ phone_e164: "+50600000002", direction: "in", body: "colado" });

    expect(error).not.toBeNull();
  });

  it("rechaza un teléfono que no esté en E.164", async () => {
    const { error } = await admin
      .from("wa_public_messages")
      .insert({ phone_e164: "8888-7777", direction: "in", body: "x" });

    expect(error).not.toBeNull();
  });
});

describe("garantías de la base", () => {
  // Es lo que hace que un "dale" no sea ambiguo: con dos propuestas abiertas,
  // la confirmación no sabría a cuál corresponde y se crearía la equivocada.
  it("solo puede haber una propuesta abierta por persona", async () => {
    const fila = {
      profile_id: elAdmin.id,
      kind: "crear_pieza" as const,
      payload: { titulo: "x", cliente: "Zonna", fecha: "2026-08-06", tipo: "grabar" },
      status: "propuesta" as const,
    };

    const primera = await admin.from("wa_agent_actions").insert(fila);
    const segunda = await admin.from("wa_agent_actions").insert(fila);

    expect(primera.error).toBeNull();
    expect(segunda.error?.code).toBe("23505");
  });

  it("rechaza un estado de acción que no existe", async () => {
    const { error } = await admin.from("wa_agent_actions").insert({
      profile_id: elAdmin.id,
      kind: "crear_pieza",
      payload: {},
      // El cast es a propósito: se prueba que el check de la base rechace lo
      // que el tipo de TypeScript ya no permite. Los dos candados, no uno.
      status: "inventado" as WaActionStatus,
    });

    expect(error).not.toBeNull();
  });

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
