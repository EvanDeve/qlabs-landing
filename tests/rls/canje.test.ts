import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, makeUser, cleanup, type TestUser } from "./helpers";

// Loyalty Loop · Fases 3 y 4. El criterio de aceptación del plan es el flujo
// completo: reclamar como creador, pegar el código como marca, confirmar; el
// segundo intento con el mismo código dice "ya canjeado"; uno de otra marca
// dice "no encontrado".
//
// Más lo de la fase 4: que el barrido venza lo que se pasó de fecha y libere el
// lugar que ese reclamo estaba ocupando.

let marca: TestUser;
let otraMarca: TestUser;
let creador: TestUser;

let cupon: string;
let cuponAjeno: string;
let cuponChico: string;
let codigo: string;

async function darPuntos(creatorId: string, puntos: number) {
  const { error } = await admin.from("points_events").insert({
    creator_id: creatorId,
    action: "delivery_approved",
    points: puntos,
    reference_type: "test",
    reference_id: crypto.randomUUID(),
  });
  if (error) throw new Error(`setup points_events: ${error.message}`);
}

beforeAll(async () => {
  [marca, otraMarca, creador] = await Promise.all([
    makeUser("brand"),
    makeUser("brand"),
    makeUser("creator"),
  ]);

  const { error: eMarcas } = await admin.from("brand_profiles").insert([
    { profile_id: marca.id, brand_name: "Canje Test", industry: "Restaurante", verified: true },
    { profile_id: otraMarca.id, brand_name: "Canje Ajeno", industry: "Hotel", verified: true },
  ]);
  if (eMarcas) throw new Error(`setup brand_profiles: ${eMarcas.message}`);

  const { error: eCreador } = await admin
    .from("creator_profiles")
    .insert({ profile_id: creador.id, handle: `@canje.${creador.id.slice(0, 8)}`, verified: true });
  if (eCreador) throw new Error(`setup creator_profiles: ${eCreador.message}`);

  await darPuntos(creador.id, 150);

  const base = { description: "Lo que incluye", claim_validity_days: 14, type: "producto" as const };
  const { data: creados, error: eCupones } = await admin
    .from("coupons")
    .insert([
      { ...base, brand_id: marca.id, title: "Canje principal", min_level: 1, stock_total: 5, status: "publicado" },
      { ...base, brand_id: otraMarca.id, title: "De otra marca", min_level: 1, stock_total: 5, status: "publicado" },
      { ...base, brand_id: marca.id, title: "Un solo lugar", min_level: 1, stock_total: 1, status: "publicado" },
    ])
    .select("id, title");
  if (eCupones) throw new Error(`setup coupons: ${eCupones.message}`);

  const idDe = (t: string) => creados!.find((c) => c.title === t)!.id;
  cupon = idDe("Canje principal");
  cuponAjeno = idDe("De otra marca");
  cuponChico = idDe("Un solo lugar");
});

afterAll(async () => {
  await admin.from("coupons").delete().in("brand_id", [marca.id, otraMarca.id]);
  await cleanup();
});

describe("el flujo completo", () => {
  it("el creador reclama y se lleva un código", async () => {
    const { data, error } = await creador.client.rpc("claim_coupon", { p_coupon: cupon });
    expect(error).toBeNull();
    codigo = data!.code;
    expect(codigo).toMatch(/^QL-/);
  });

  it("la marca dueña lo canjea", async () => {
    const { data, error } = await marca.client.rpc("redeem_coupon", { p_code: codigo });
    expect(error).toBeNull();
    expect(data!.status).toBe("canjeado");
    expect(data!.redeemed_at).not.toBeNull();
    expect(data!.validated_by).toBe(marca.id);
  });

  it("el código funciona en minúscula y con espacios — se dicta en el mostrador", async () => {
    // Ya está canjeado, así que la prueba de que normaliza es que lo ENCUENTRA:
    // si no lo encontrara, el error sería "no encontramos ese código".
    const { error } = await marca.client.rpc("redeem_coupon", { p_code: `  ${codigo.toLowerCase()} ` });
    expect(error?.message).toContain("ya fue canjeado");
  });

  it("el segundo intento dice que ya fue canjeado", async () => {
    const { error } = await marca.client.rpc("redeem_coupon", { p_code: codigo });
    expect(error?.message).toContain("ya fue canjeado");
  });

  it("una marca ajena ni siquiera sabe que el código existe", async () => {
    const { error } = await otraMarca.client.rpc("redeem_coupon", { p_code: codigo });
    expect(error?.message).toContain("No encontramos ese código");
  });

  it("un código inventado da exactamente el mismo error", async () => {
    // Que sean idénticos es el punto: si dijeran cosas distintas, la pantalla
    // de validación serviría para adivinar qué códigos existen.
    const { error } = await marca.client.rpc("redeem_coupon", { p_code: "QL-ZZZZ-99" });
    expect(error?.message).toContain("No encontramos ese código");
  });

  it("el creador no puede canjear su propio cupón", async () => {
    const { data: nuevo } = await creador.client.rpc("claim_coupon", { p_coupon: cuponAjeno });
    const { error } = await creador.client.rpc("redeem_coupon", { p_code: nuevo!.code });
    expect(error?.message).toContain("No encontramos ese código");
  });

  it("la marca queda avisada del canje", async () => {
    const { data } = await admin
      .from("notifications")
      .select("type, payload")
      .eq("profile_id", marca.id)
      .eq("type", "coupon_redeemed");

    expect(data!.length).toBeGreaterThan(0);
    expect(data![0].payload).toMatchObject({ code: codigo });
  });
});

describe("vencimientos", () => {
  it("un código vencido no se canjea", async () => {
    const ayer = new Date(Date.now() - 86_400_000).toISOString();
    const { data: viejo, error: eInsert } = await admin
      .from("redemptions")
      .insert({
        coupon_id: cuponChico,
        creator_id: creador.id,
        code: "QL-VENC-01",
        expires_at: ayer,
      })
      .select("id")
      .single();
    if (eInsert) throw new Error(`setup redemption vencida: ${eInsert.message}`);

    const { error } = await marca.client.rpc("redeem_coupon", { p_code: "QL-VENC-01" });
    expect(error?.message).toContain("venció");

    // Sigue en 'reclamado' a propósito, y esto lo deja documentado: `raise
    // exception` revierte la transacción entera, así que la función NO puede
    // marcar la fila antes de avisar del error. Quien marca es el barrido.
    const { data } = await admin.from("redemptions").select("status").eq("id", viejo!.id).single();
    expect(data!.status).toBe("reclamado");
  });

  it("el barrido lo marca expirado y libera el lugar que tenía tomado", async () => {
    // El cupón chico tiene 1 solo lugar y la fila vencida de arriba lo tomó.
    await admin.from("coupons").update({ status: "agotado" }).eq("id", cuponChico);

    const { data: resumen, error } = await admin.rpc("expirar_loyalty");
    expect(error).toBeNull();
    expect(resumen).toBeTruthy();

    const { data: vencida } = await admin
      .from("redemptions")
      .select("status")
      .eq("code", "QL-VENC-01")
      .single();
    expect(vencida!.status).toBe("expirado");

    const { data: cuponDespues } = await admin
      .from("coupons")
      .select("status")
      .eq("id", cuponChico)
      .single();
    expect(cuponDespues!.status).toBe("publicado");

    const { data: stock } = await admin
      .from("coupon_stock")
      .select("stock_available")
      .eq("coupon_id", cuponChico)
      .single();
    expect(stock!.stock_available).toBe(1);
  });
});

describe("avisos y visibilidad", () => {
  it("cruzar el umbral genera el aviso de subida de nivel", async () => {
    // Estaba en 150. Con 400 más llega a 550 y cruza Plata (500).
    await darPuntos(creador.id, 400);

    const { data } = await admin
      .from("notifications")
      .select("payload")
      .eq("profile_id", creador.id)
      .eq("type", "level_up");

    expect(data!.length).toBe(1);
    expect(data![0].payload).toMatchObject({ level: 2 });
  });

  it("sumar puntos sin cruzar umbral no avisa de nuevo", async () => {
    await darPuntos(creador.id, 10);

    const { data } = await admin
      .from("notifications")
      .select("id")
      .eq("profile_id", creador.id)
      .eq("type", "level_up");

    expect(data!.length).toBe(1);
  });

  it("el creador sigue viendo el cupón que reclamó aunque la marca lo pause", async () => {
    // El caso real: la marca pausa el cupón y el creador ya tenía su código.
    // Sin la policy `coupons_select_reclamados_por_mi`, "Mis cupones" le
    // mostraría una fila sin título.
    await admin.from("coupons").update({ status: "pausado" }).eq("id", cupon);

    const { data } = await creador.client.from("coupons").select("title").eq("id", cupon).maybeSingle();
    expect(data?.title).toBe("Canje principal");
  });

  it("pero no ve un cupón pausado que nunca reclamó", async () => {
    const { data: otro } = await admin
      .from("coupons")
      .insert({
        brand_id: marca.id,
        title: "Pausado ajeno",
        type: "producto",
        description: "x",
        stock_total: 3,
        claim_validity_days: 7,
        status: "pausado",
      })
      .select("id")
      .single();

    const { data } = await creador.client.from("coupons").select("id").eq("id", otro!.id);
    expect(data).toEqual([]);
  });
});
