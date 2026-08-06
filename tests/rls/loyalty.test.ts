import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, makeUser, cleanup, type TestUser } from "./helpers";

// Loyalty Loop · Fase 1. Lo que se prueba acá es lo que el plan pide como
// criterio de aceptación del motor de puntos:
//
//   1. aprobar una entrega otorga +150 UNA sola vez, aunque el evento se
//      dispare dos veces;
//   2. los topes mensuales (book, aplicaciones) se respetan;
//   3. nadie puede escribir el ledger — ni insertando, ni llamando al RPC.
//
// Como los puntos los otorgan triggers, los updates del escenario se hacen con
// service-role: es exactamente lo mismo que hace la app con la sesión de la
// marca, y de paso demuestra que el punto no depende de qué código lo escribió.
//
// Corre contra el proyecto Supabase real. Ver README.md de esta carpeta.

let marca: TestUser;
let creador: TestUser;
let otroCreador: TestUser;
let campaignId: string;
let segundaCampaignId: string;
let applicationId: string;

/** Los eventos del ledger de un creador, leídos con service-role. */
async function eventos(creatorId: string) {
  const { data, error } = await admin
    .from("points_events")
    .select("action, points, reference_id")
    .eq("creator_id", creatorId);
  if (error) throw new Error(`no se pudo leer el ledger: ${error.message}`);
  return data ?? [];
}

async function total(creatorId: string) {
  return (await eventos(creatorId)).reduce((suma, e) => suma + e.points, 0);
}

beforeAll(async () => {
  [marca, creador, otroCreador] = await Promise.all([
    makeUser("brand"),
    makeUser("creator"),
    makeUser("creator"),
  ]);

  const { error: eMarca } = await admin
    .from("brand_profiles")
    .insert({ profile_id: marca.id, brand_name: "Marca Loyalty Test", industry: "Restaurante", verified: true });
  if (eMarca) throw new Error(`setup brand_profiles: ${eMarca.message}`);

  // Sin avatar, bio ni ciudad: así el perfil NO está completo y los +50 de
  // `profile_completed` no se cuelan en los totales que se afirman abajo.
  const { error: eCreadores } = await admin.from("creator_profiles").insert([
    { profile_id: creador.id, handle: `@loy.${creador.id.slice(0, 8)}`, followers_count: 5000, verified: true },
    { profile_id: otroCreador.id, handle: `@loy2.${otroCreador.id.slice(0, 8)}`, followers_count: 3000, verified: true },
  ]);
  if (eCreadores) throw new Error(`setup creator_profiles: ${eCreadores.message}`);

  const campañas = [1, 2].map((n) => ({
    brand_id: marca.id,
    title: `Campaña Loyalty ${n}`,
    brief: "BRIEF-LOYALTY",
    budget_amount: 100_000,
    deliverables: [{ type: "reel", qty: 1 }],
    status: "published" as const,
    published_at: new Date().toISOString(),
    usage_rights_scope: "pauta" as const,
    usage_rights_duration: "meses_6" as const,
    usage_rights_editing: true,
  }));

  const { data: creadas, error: eCampañas } = await admin.from("campaigns").insert(campañas).select("id");
  if (eCampañas) throw new Error(`setup campaigns: ${eCampañas.message}`);
  [campaignId, segundaCampaignId] = creadas!.map((c) => c.id);
});

afterAll(async () => {
  await admin.from("campaigns").delete().in("id", [campaignId, segundaCampaignId].filter(Boolean));
  // points_events cuelga de profiles con on delete cascade, y profiles de
  // auth.users: borrar las cuentas se lleva el ledger de prueba con ellas.
  await cleanup();
});

describe("el ledger se llena solo", () => {
  it("aplicar a una promo otorga +5 y deja la aplicación como referencia", async () => {
    const { data, error } = await creador.client
      .from("applications")
      .insert({ campaign_id: campaignId, creator_id: creador.id, pitch_message: "Voy" })
      .select("id")
      .single();
    if (error) throw new Error(`no se pudo aplicar: ${error.message}`);
    applicationId = data!.id;

    const evs = await eventos(creador.id);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ action: "application", points: 5, reference_id: applicationId });
  });

  it("aceptar al aplicante otorga +50", async () => {
    const { error } = await admin.from("applications").update({ status: "accepted" }).eq("id", applicationId);
    if (error) throw new Error(`no se pudo aceptar: ${error.message}`);

    const evs = await eventos(creador.id);
    expect(evs.filter((e) => e.action === "campaign_selected")).toHaveLength(1);
    expect(await total(creador.id)).toBe(55);
  });

  it("aprobar la entrega con 5★ otorga +150 y +50 en el mismo movimiento", async () => {
    const { error } = await admin
      .from("applications")
      .update({ status: "approved", rating: 5 })
      .eq("id", applicationId);
    if (error) throw new Error(`no se pudo aprobar: ${error.message}`);

    const evs = await eventos(creador.id);
    expect(evs.filter((e) => e.action === "delivery_approved")).toHaveLength(1);
    expect(evs.filter((e) => e.action === "rating_5")).toHaveLength(1);
    expect(await total(creador.id)).toBe(255);
  });

  it("volver a aprobar la misma entrega NO vuelve a pagar", async () => {
    // El caso real: la marca desaprueba para pedir un ajuste y vuelve a
    // aprobar. Dos disparos del trigger, un solo punto — lo frena el índice de
    // idempotencia sobre (creador, acción, referencia).
    await admin.from("applications").update({ status: "delivered" }).eq("id", applicationId);
    await admin.from("applications").update({ status: "approved" }).eq("id", applicationId);

    const evs = await eventos(creador.id);
    expect(evs.filter((e) => e.action === "delivery_approved")).toHaveLength(1);
    expect(await total(creador.id)).toBe(255);
  });

  it("corregir el rating de 5★ a 4★ no paga dos veces", async () => {
    await admin.from("applications").update({ rating: 4 }).eq("id", applicationId);

    const evs = await eventos(creador.id);
    expect(evs.filter((e) => e.action === "rating_4")).toHaveLength(0);
    expect(await total(creador.id)).toBe(255);
  });
});

describe("topes anti-farming", () => {
  it("solo las primeras 5 piezas del book del mes puntúan", async () => {
    const piezas = Array.from({ length: 7 }, (_, i) => ({
      creator_id: creador.id,
      storage_path: `${creador.id}/loyalty-test-${i}.jpg`,
      media_type: "image",
      category: "ugc",
      position: i,
    }));

    const { error } = await admin.from("portfolio_items").insert(piezas);
    if (error) throw new Error(`setup portfolio_items: ${error.message}`);

    const evs = await eventos(creador.id);
    expect(evs.filter((e) => e.action === "book_upload")).toHaveLength(5);
    expect(await total(creador.id)).toBe(305); // 255 + 5 × 10
  });
});

describe("nadie escribe el ledger a mano", () => {
  it("un creador no ve los puntos de otro", async () => {
    const { data } = await otroCreador.client
      .from("points_events")
      .select("id")
      .eq("creator_id", creador.id);
    expect(data).toEqual([]);
  });

  it("un creador sí ve los propios", async () => {
    const { data } = await creador.client.from("points_events").select("id, action");
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((e) => typeof e.action === "string")).toBe(true);
  });

  it("un creador no puede insertarse puntos", async () => {
    const { error } = await creador.client.from("points_events").insert({
      creator_id: creador.id,
      action: "delivery_approved",
      points: 150,
    });
    expect(error).not.toBeNull();

    // Y lo que importa de verdad: que el dato no haya entrado igual.
    const evs = await eventos(creador.id);
    expect(evs.filter((e) => e.action === "delivery_approved")).toHaveLength(1);
  });

  it("un creador no puede llamar a award_points", async () => {
    const { error } = await creador.client.rpc("award_points", {
      p_creator: creador.id,
      p_action: "delivery_approved",
      p_reference_type: "application",
      p_reference_id: segundaCampaignId,
    });
    expect(error).not.toBeNull();
    expect(await total(creador.id)).toBe(305);
  });

  it("un creador no puede cambiar cuánto vale una acción", async () => {
    await creador.client.from("point_rules").update({ points: 9999 }).eq("action", "book_upload");

    const { data } = await admin.from("point_rules").select("points").eq("action", "book_upload").single();
    expect(data!.points).toBe(10);
  });
});

describe("el nivel sale del ledger", () => {
  it("arranca en Bronce y sube a Plata al pasar los 500", async () => {
    const { data: bronce } = await otroCreador.client.rpc("creator_level", { p_creator: otroCreador.id });
    expect(bronce).toBe(1);

    // Segundo ciclo completo: aplicar (5) + seleccionado (50) + aprobada (150)
    // + 5★ (50) = 255. Con los 305 que ya tenía: 560, arriba del umbral.
    const { data: app2, error: eApp } = await creador.client
      .from("applications")
      .insert({ campaign_id: segundaCampaignId, creator_id: creador.id })
      .select("id")
      .single();
    if (eApp) throw new Error(`no se pudo aplicar a la segunda: ${eApp.message}`);

    await admin.from("applications").update({ status: "accepted" }).eq("id", app2!.id);
    await admin.from("applications").update({ status: "approved", rating: 5 }).eq("id", app2!.id);

    expect(await total(creador.id)).toBe(560);

    const { data: nivel } = await creador.client.rpc("creator_level", { p_creator: creador.id });
    expect(nivel).toBe(2);
  });
});
