import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, makeUser, cleanup, type TestUser } from "./helpers";

// Loyalty Loop · Fase 2. Los criterios de aceptación del plan:
//
//   1. un creador Plata reclama los cupones de "Todos" y de "Plata", pero no
//      los de "Oro";
//   2. el reclamo descuenta stock (y el que agota el cupón lo deja agotado);
//   3. el código sobrevive a recargar la página — o sea, quedó guardado.
//
// Más lo que no está en el plan pero es lo que rompe en producción: que el
// stock que ve un creador sea el REAL y no solo el de sus propios reclamos.

let marca: TestUser;
let marcaSinVerificar: TestUser;
let creador: TestUser;
let otroCreador: TestUser;

let cuponTodos: string;
let cuponPlata: string;
let cuponOro: string;
let cuponUltimo: string;
let cuponBorrador: string;

/** Puntos directos al ledger con service-role: el motor ya está probado aparte. */
async function darPuntos(creatorId: string, puntos: number, referencia: string) {
  const { error } = await admin.from("points_events").insert({
    creator_id: creatorId,
    action: "delivery_approved",
    points: puntos,
    reference_type: "test",
    reference_id: referencia,
  });
  if (error) throw new Error(`setup points_events: ${error.message}`);
}

beforeAll(async () => {
  [marca, marcaSinVerificar, creador, otroCreador] = await Promise.all([
    makeUser("brand"),
    makeUser("brand"),
    makeUser("creator"),
    makeUser("creator"),
  ]);

  const { error: eMarcas } = await admin.from("brand_profiles").insert([
    { profile_id: marca.id, brand_name: "Cupones Test", industry: "Restaurante", verified: true },
    { profile_id: marcaSinVerificar.id, brand_name: "Sin Verificar Test", industry: "Hotel", verified: false },
  ]);
  if (eMarcas) throw new Error(`setup brand_profiles: ${eMarcas.message}`);

  const { error: eCreadores } = await admin.from("creator_profiles").insert([
    { profile_id: creador.id, handle: `@cup.${creador.id.slice(0, 8)}`, verified: true },
    { profile_id: otroCreador.id, handle: `@cup2.${otroCreador.id.slice(0, 8)}`, verified: true },
  ]);
  if (eCreadores) throw new Error(`setup creator_profiles: ${eCreadores.message}`);

  // 600 pts = Plata (umbral 500), sin llegar a Oro (1500).
  await darPuntos(creador.id, 600, crypto.randomUUID());
  // El otro queda en Bronce: sirve para probar el gate desde abajo.
  await darPuntos(otroCreador.id, 100, crypto.randomUUID());

  const base = { brand_id: marca.id, description: "Lo que incluye", claim_validity_days: 14 };
  const { data: creados, error: eCupones } = await admin
    .from("coupons")
    .insert([
      { ...base, title: "Café para todos", type: "producto", min_level: 1, stock_total: 5, status: "publicado" },
      { ...base, title: "Cena Plata", type: "servicio", min_level: 2, stock_total: 5, status: "publicado" },
      { ...base, title: "Noche Oro", type: "producto", min_level: 3, stock_total: 5, status: "publicado" },
      { ...base, title: "Último lugar", type: "producto", min_level: 1, stock_total: 1, status: "publicado" },
      { ...base, title: "Borrador secreto", type: "producto", min_level: 1, stock_total: 5, status: "borrador" },
    ])
    .select("id, title");
  if (eCupones) throw new Error(`setup coupons: ${eCupones.message}`);

  const idDe = (t: string) => creados!.find((c) => c.title === t)!.id;
  cuponTodos = idDe("Café para todos");
  cuponPlata = idDe("Cena Plata");
  cuponOro = idDe("Noche Oro");
  cuponUltimo = idDe("Último lugar");
  cuponBorrador = idDe("Borrador secreto");
});

afterAll(async () => {
  // Los cupones cuelgan de la marca (on delete cascade) y los reclamos de los
  // cupones, así que borrar las cuentas alcanza. Se listan igual por si alguna
  // vez cambia el cascade.
  await admin.from("coupons").delete().eq("brand_id", marca.id);
  await cleanup();
});

describe("el gate de nivel", () => {
  it("un creador Plata reclama el cupón de Todos", async () => {
    const { data, error } = await creador.client.rpc("claim_coupon", { p_coupon: cuponTodos });
    expect(error).toBeNull();
    expect(data!.code).toMatch(/^QL-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{2}$/);
    expect(data!.status).toBe("reclamado");
    expect(new Date(data!.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("y también el de su propio nivel", async () => {
    const { error } = await creador.client.rpc("claim_coupon", { p_coupon: cuponPlata });
    expect(error).toBeNull();
  });

  it("pero no el de Oro", async () => {
    const { error } = await creador.client.rpc("claim_coupon", { p_coupon: cuponOro });
    expect(error?.message).toContain("Tu nivel todavía no alcanza");

    const { data } = await admin.from("redemptions").select("id").eq("coupon_id", cuponOro);
    expect(data).toEqual([]);
  });

  it("un creador Bronce tampoco entra al de Plata", async () => {
    const { error } = await otroCreador.client.rpc("claim_coupon", { p_coupon: cuponPlata });
    expect(error?.message).toContain("Tu nivel todavía no alcanza");
  });

  it("no se puede reclamar dos veces el mismo cupón", async () => {
    const { error } = await creador.client.rpc("claim_coupon", { p_coupon: cuponTodos });
    expect(error?.message).toContain("Ya reclamaste este cupón");
  });

  it("un cupón en borrador no existe para el creador", async () => {
    const { data } = await creador.client.from("coupons").select("id").eq("id", cuponBorrador);
    expect(data).toEqual([]);

    const { error } = await creador.client.rpc("claim_coupon", { p_coupon: cuponBorrador });
    expect(error).not.toBeNull();
  });
});

describe("el stock", () => {
  it("el código queda guardado: recargar la página lo conserva", async () => {
    // "Recargar" es exactamente esto: volver a leer con la sesión del creador,
    // sin nada en memoria del reclamo anterior.
    const { data } = await creador.client
      .from("redemptions")
      .select("code, status, expires_at")
      .eq("coupon_id", cuponTodos)
      .single();

    expect(data!.code).toMatch(/^QL-/);
    expect(data!.status).toBe("reclamado");
  });

  it("el creador ve el stock REAL, no solo el que descontó él", async () => {
    // El bug que esto previene: si la vista corriera con los permisos del que
    // pregunta, cada creador contaría únicamente sus propios reclamos y vería
    // "5 de 5 disponibles" en un cupón que ya está por agotarse.
    await otroCreador.client.rpc("claim_coupon", { p_coupon: cuponTodos });

    const { data } = await creador.client
      .from("coupon_stock")
      .select("stock_available, stock_claimed")
      .eq("coupon_id", cuponTodos)
      .single();

    expect(data!.stock_claimed).toBe(2);
    expect(data!.stock_available).toBe(3);
  });

  it("el último lugar deja el cupón agotado y el siguiente se topa con eso", async () => {
    const { error: ePrimero } = await creador.client.rpc("claim_coupon", { p_coupon: cuponUltimo });
    expect(ePrimero).toBeNull();

    const { data: cupon } = await admin.from("coupons").select("status").eq("id", cuponUltimo).single();
    expect(cupon!.status).toBe("agotado");

    const { error: eSegundo } = await otroCreador.client.rpc("claim_coupon", { p_coupon: cuponUltimo });
    expect(eSegundo?.message).toMatch(/agotaron|no está disponible/);

    const { data: reclamos } = await admin.from("redemptions").select("id").eq("coupon_id", cuponUltimo);
    expect(reclamos).toHaveLength(1);
  });
});

describe("nadie se saltea el RPC", () => {
  it("un creador no puede insertar un reclamo a mano", async () => {
    const { error } = await creador.client.from("redemptions").insert({
      coupon_id: cuponOro,
      creator_id: creador.id,
      code: "QL-HACK-99",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(error).not.toBeNull();

    const { data } = await admin.from("redemptions").select("id").eq("code", "QL-HACK-99");
    expect(data).toEqual([]);
  });

  it("un creador no puede marcar su reclamo como canjeado", async () => {
    await creador.client.from("redemptions").update({ status: "canjeado" }).eq("coupon_id", cuponTodos);

    const { data } = await admin
      .from("redemptions")
      .select("status")
      .eq("coupon_id", cuponTodos)
      .eq("creator_id", creador.id)
      .single();
    expect(data!.status).toBe("reclamado");
  });

  it("un creador no ve los reclamos de otro", async () => {
    const { data } = await creador.client
      .from("redemptions")
      .select("id")
      .eq("creator_id", otroCreador.id);
    expect(data).toEqual([]);
  });

  it("la marca sí ve los reclamos de sus cupones", async () => {
    const { data } = await marca.client.from("redemptions").select("id, code").eq("coupon_id", cuponTodos);
    expect(data!.length).toBe(2);
  });

  it("una marca no ve los cupones de otra marca", async () => {
    const { data } = await marcaSinVerificar.client.from("coupons").select("id").eq("brand_id", marca.id);
    expect(data).toEqual([]);
  });
});

describe("el gate de verificación de la marca", () => {
  it("una marca sin verificar no puede publicar un cupón", async () => {
    const { error } = await marcaSinVerificar.client.from("coupons").insert({
      brand_id: marcaSinVerificar.id,
      title: "No debería publicarse",
      type: "producto",
      description: "x",
      stock_total: 3,
      claim_validity_days: 7,
      status: "publicado",
    });
    expect(error).not.toBeNull();
  });

  it("pero sí puede dejarlo en borrador", async () => {
    const { error } = await marcaSinVerificar.client.from("coupons").insert({
      brand_id: marcaSinVerificar.id,
      title: "Borrador propio",
      type: "producto",
      description: "x",
      stock_total: 3,
      claim_validity_days: 7,
    });
    expect(error).toBeNull();
  });
});
