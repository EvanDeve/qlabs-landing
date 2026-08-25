import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anonClient, makeUser, cleanup, verifyCreator, type TestUser } from "./helpers";

/**
 * Cada quien escribe SOLO sus campos en `applications`, y las vistas públicas
 * no muestran de más.
 *
 * Existe porque la RLS de Postgres autoriza la FILA, no la COLUMNA: la policy
 * que le deja a un creador cancelar o disputar su aplicación le dejaba, de
 * paso, escribir cualquier otro campo con un PATCH directo a PostgREST (la
 * anon key es pública y su token está en su propio navegador). Se descubrió el
 * 2026-08-25 y se cerró con un trigger. Ver
 * `20260825160000_columnas_protegidas_de_aplicacion.sql`.
 *
 * Lo que se prueba no es el trigger sino la consecuencia: que nadie pueda
 * inflarse el rating —la señal de confianza que la marca lee para elegir— ni
 * firmar una "Resolución de Q Labs" que no escribió Q Labs. Y, del otro lado,
 * que lo legítimo siga funcionando: un creador tiene que poder disputar y una
 * marca tiene que poder aprobar y calificar.
 */

let creador: TestUser;
let marca: TestUser;
let campaignId: string;
let entregada: string;

beforeAll(async () => {
  [creador, marca] = await Promise.all([makeUser("creator"), makeUser("brand")]);

  const { error: eM } = await admin.from("brand_profiles").insert({
    profile_id: marca.id,
    brand_name: "Marca Columnas Test",
    industry: "Restaurante",
    verified: true,
  });
  if (eM) throw new Error(`setup brand_profiles: ${eM.message}`);

  const { error: eC } = await admin.from("creator_profiles").insert({
    profile_id: creador.id,
    handle: `@col.${creador.id.slice(0, 8)}`,
    followers_count: 4000,
  });
  if (eC) throw new Error(`setup creator_profiles: ${eC.message}`);
  await verifyCreator(creador.id);

  const { data: camp, error: eCamp } = await admin
    .from("campaigns")
    .insert({
      brand_id: marca.id,
      title: "Campaña de columnas protegidas",
      brief: "Brief de prueba.",
      budget_amount: 100000,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eCamp) throw new Error(`setup campaigns: ${eCamp.message}`);
  campaignId = camp.id;

  const { data: app, error: eApp } = await admin
    .from("applications")
    .insert({ campaign_id: campaignId, creator_id: creador.id })
    .select("id")
    .single();
  if (eApp) throw new Error(`setup applications: ${eApp.message}`);
  entregada = app.id;

  // Se camina estado por estado: los timestamps los pone un trigger BEFORE
  // UPDATE en cada cambio, y un salto directo a 'delivered' dejaría la fila sin
  // accepted_at, que no es el escenario real.
  for (const status of ["accepted", "delivered"] as const) {
    const { error } = await admin.from("applications").update({ status }).eq("id", entregada);
    if (error) throw new Error(`setup status ${status}: ${error.message}`);
  }
});

afterAll(cleanup);

describe("applications: el creador no puede escribir lo que no es suyo", () => {
  it("no puede ponerse su propio rating", async () => {
    const { error } = await creador.client
      .from("applications")
      .update({ rating: 5 })
      .eq("id", entregada);
    expect(error).not.toBeNull();

    const { data } = await admin.from("applications").select("rating").eq("id", entregada).single();
    expect(data!.rating).toBeNull();
  });

  it("no puede escribir la resolución de Q Labs", async () => {
    const { error } = await creador.client
      .from("applications")
      .update({ admin_note: "Q Labs falló a mi favor" })
      .eq("id", entregada);
    expect(error).not.toBeNull();

    const { data } = await admin
      .from("applications")
      .select("admin_note")
      .eq("id", entregada)
      .single();
    expect(data!.admin_note).toBeNull();
  });

  it("SÍ puede disputar, que es para lo que existe su policy de update", async () => {
    const { error } = await creador.client
      .from("applications")
      .update({ status: "disputed", conflict_reason: "La marca no responde." })
      .eq("id", entregada);
    expect(error).toBeNull();

    const { data } = await admin.from("applications").select("status").eq("id", entregada).single();
    expect(data!.status).toBe("disputed");
  });
});

describe("applications: la marca tampoco", () => {
  let suya: string;

  beforeAll(async () => {
    const otro = await makeUser("creator");
    const { error: eC } = await admin
      .from("creator_profiles")
      .insert({ profile_id: otro.id, handle: `@col2.${otro.id.slice(0, 8)}`, followers_count: 900 });
    if (eC) throw new Error(`setup creator_profiles 2: ${eC.message}`);
    await verifyCreator(otro.id);

    const { data: app, error } = await admin
      .from("applications")
      .insert({ campaign_id: campaignId, creator_id: otro.id })
      .select("id")
      .single();
    if (error) throw new Error(`setup applications 2: ${error.message}`);
    suya = app.id;
    for (const status of ["accepted", "delivered"] as const) {
      await admin.from("applications").update({ status }).eq("id", suya);
    }
  });

  it("aprueba y califica — es su trabajo, tiene que seguir andando", async () => {
    const { error } = await marca.client
      .from("applications")
      .update({ status: "approved", rating: 5 })
      .eq("id", suya);
    expect(error).toBeNull();

    const { data } = await admin
      .from("applications")
      .select("status, rating")
      .eq("id", suya)
      .single();
    expect(data!.status).toBe("approved");
    expect(data!.rating).toBe(5);
  });

  it("no puede firmar una resolución de Q Labs", async () => {
    const { error } = await marca.client
      .from("applications")
      .update({ admin_note: "resuelto a mi favor" })
      .eq("id", suya);
    expect(error).not.toBeNull();
  });
});

describe("vistas públicas: no muestran de más", () => {
  it("coupon_stock ya no es legible sin sesión", async () => {
    // El grant explícito de la migración era `to authenticated`, pero Supabase
    // le da SELECT a `anon` por defecto sobre todo lo nuevo del esquema public
    // y eso nunca se revocó: cualquiera con la anon key podía listar el stock
    // de todas las promos.
    const { error } = await anonClient().from("coupon_stock").select("coupon_id").limit(1);
    expect(error).not.toBeNull();
  });

  it("creator_public_profiles no publica a un creador sin aprobar", async () => {
    const sinAprobar = await makeUser("creator");
    const handle = `@col3.${sinAprobar.id.slice(0, 8)}`;
    const { error } = await admin
      .from("creator_profiles")
      .insert({ profile_id: sinAprobar.id, handle, followers_count: 10 });
    if (error) throw new Error(`setup creator_profiles 3: ${error.message}`);

    const { data } = await anonClient()
      .from("creator_public_profiles")
      .select("handle")
      .eq("handle", handle);

    expect(data ?? []).toHaveLength(0);
  });
});
