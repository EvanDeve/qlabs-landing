import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, makeUser, cleanup, verifyCreator, type TestUser } from "./helpers";
import { DELIVERIES_BUCKET, MAX_DELIVERY_FILE_BYTES } from "../../src/lib/ugc/deliveries";
import { PORTFOLIO_BUCKET, MAX_PORTFOLIO_FILE_BYTES } from "../../src/lib/ugc/portfolio";
import { MAX_STORAGE_FILE_BYTES } from "../../src/lib/ugc/uploads";

// La entrega del creador y la subida del book ahora suben DIRECTO del navegador
// a Supabase Storage: el archivo ya no pasa por un Server Action, porque en
// Vercel el body de una función corta en ~4.5 MB (andaba en local, fallaba en
// producción).
//
// Eso mueve el control de acceso del server action a las policies de
// storage.objects. Antes el servidor era el que subía, con la sesión del
// usuario ya validada en código; ahora quien sube es el navegador y lo único
// que separa la carpeta de un creador de la de otro son estas policies. Por eso
// se prueban contra la base real y no se dan por buenas leyendo el SQL.

let creador: TestUser;
let otroCreador: TestUser;
let marca: TestUser;
let campaignId: string;
let aplicacionAceptada: string;
let aplicacionPendiente: string;

/** Archivo mínimo: lo que se prueba es el permiso, no el contenido. */
const ARCHIVO = Buffer.from("contenido de prueba");

/** Rutas subidas con éxito, para barrerlas en el teardown. */
const subidos: Array<{ bucket: string; path: string }> = [];

async function intentarSubida(
  quien: TestUser,
  bucket: string,
  path: string
): Promise<string | null> {
  const { error } = await quien.client.storage
    .from(bucket)
    .upload(path, ARCHIVO, { contentType: "text/plain" });
  if (!error) subidos.push({ bucket, path });
  return error?.message ?? null;
}

beforeAll(async () => {
  [creador, otroCreador, marca] = await Promise.all([
    makeUser("creator"),
    makeUser("creator"),
    makeUser("brand"),
  ]);

  const { error: eM } = await admin
    .from("brand_profiles")
    .insert({ profile_id: marca.id, brand_name: "Marca Uploads Test", industry: "Restaurante", verified: true });
  if (eM) throw new Error(`setup brand_profiles: ${eM.message}`);

  const { error: eC } = await admin.from("creator_profiles").insert([
    { profile_id: creador.id, handle: `@up.${creador.id.slice(0, 8)}`, followers_count: 5000 },
    { profile_id: otroCreador.id, handle: `@up2.${otroCreador.id.slice(0, 8)}`, followers_count: 3000 },
  ]);
  if (eC) throw new Error(`setup creator_profiles: ${eC.message}`);

  await verifyCreator(creador.id);

  const { data: camp, error: eCamp } = await admin
    .from("campaigns")
    .insert({
      brand_id: marca.id,
      title: "Campaña Uploads Test",
      brief: "BRIEF-UPLOADS",
      budget_amount: 100_000,
      deliverables: [{ type: "reel", qty: 1 }],
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eCamp || !camp) throw new Error(`setup campaigns: ${eCamp?.message}`);
  campaignId = camp.id;

  const { data: apps, error: eApps } = await admin
    .from("applications")
    .insert([
      { campaign_id: campaignId, creator_id: creador.id, status: "accepted" },
      { campaign_id: campaignId, creator_id: otroCreador.id, status: "pending" },
    ])
    .select("id, status");
  if (eApps || apps?.length !== 2) throw new Error(`setup applications: ${eApps?.message}`);

  aplicacionAceptada = apps.find((a) => a.status === "accepted")!.id;
  aplicacionPendiente = apps.find((a) => a.status === "pending")!.id;
});

afterAll(async () => {
  // Los objetos se borran con service role: el bucket `deliveries` no tiene
  // policy de DELETE para el creador, a propósito.
  for (const { bucket, path } of subidos.splice(0)) {
    await admin.storage.from(bucket).remove([path]);
  }
  await admin.from("applications").delete().eq("campaign_id", campaignId);
  await admin.from("campaigns").delete().eq("id", campaignId);
  await cleanup();
});

describe("bucket portfolio (book del creador)", () => {
  it("el creador sube a su propia carpeta desde el navegador", async () => {
    const error = await intentarSubida(creador, PORTFOLIO_BUCKET, `${creador.id}/pieza.txt`);
    expect(error).toBeNull();
  });

  it("un creador NO puede subir a la carpeta de otro", async () => {
    const error = await intentarSubida(creador, PORTFOLIO_BUCKET, `${otroCreador.id}/colado.txt`);
    expect(error).not.toBeNull();

    // No alcanza con que devuelva error: se confirma que el objeto no quedó.
    const { data } = await admin.storage.from(PORTFOLIO_BUCKET).list(otroCreador.id);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("bucket deliveries (entrega del creador)", () => {
  it("el creador con la aplicación aceptada sube a la carpeta de esa aplicación", async () => {
    const error = await intentarSubida(creador, DELIVERIES_BUCKET, `${aplicacionAceptada}/final.txt`);
    expect(error).toBeNull();
  });

  it("otro creador NO puede subir a la aplicación ajena", async () => {
    const error = await intentarSubida(
      otroCreador,
      DELIVERIES_BUCKET,
      `${aplicacionAceptada}/colado.txt`
    );
    expect(error).not.toBeNull();
  });

  it("la marca dueña de la campaña tampoco puede subir la entrega", async () => {
    const error = await intentarSubida(marca, DELIVERIES_BUCKET, `${aplicacionAceptada}/marca.txt`);
    expect(error).not.toBeNull();
  });

  it("no se puede entregar en una aplicación que todavía está pendiente", async () => {
    const error = await intentarSubida(
      otroCreador,
      DELIVERIES_BUCKET,
      `${aplicacionPendiente}/adelantado.txt`
    );
    expect(error).not.toBeNull();
  });

  it("el creador NO puede borrar lo ya entregado", async () => {
    // Es deliberado que el bucket no tenga policy de DELETE: si la tuviera, un
    // creador podría hacer desaparecer la pieza después de que la marca la
    // aprobó. La limpieza de huérfanos la hace el server con service role.
    const path = `${aplicacionAceptada}/final.txt`;
    await creador.client.storage.from(DELIVERIES_BUCKET).remove([path]);

    const { data } = await admin.storage.from(DELIVERIES_BUCKET).list(aplicacionAceptada);
    expect(data?.map((o) => o.name)).toContain("final.txt");
  });
});

describe("topes de tamaño", () => {
  it("ningún tope de la app se pasa del techo real del proyecto Supabase", () => {
    // Medido contra el proyecto en vivo: 49 MB entra, 55 MB devuelve 413.
    // Prometer más que esto en la UI es hacerle perder la subida al creador.
    expect(MAX_DELIVERY_FILE_BYTES).toBeLessThanOrEqual(MAX_STORAGE_FILE_BYTES);
    expect(MAX_PORTFOLIO_FILE_BYTES).toBeLessThanOrEqual(MAX_STORAGE_FILE_BYTES);
  });

  it("los buckets declaran el mismo tope que la app (requiere la migración 20260728000000)", async () => {
    const { data } = await admin.storage.listBuckets();
    const porId = new Map(data?.map((b) => [b.id, b.file_size_limit]) ?? []);

    const falta = "¿Corriste la migración 20260728000000_upload_size_limits.sql en el SQL Editor?";
    expect(porId.get(DELIVERIES_BUCKET), falta).toBe(MAX_DELIVERY_FILE_BYTES);
    expect(porId.get(PORTFOLIO_BUCKET), falta).toBe(MAX_PORTFOLIO_FILE_BYTES);
  });
});
