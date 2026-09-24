import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { admin, anonClient, makeUser, cleanup, track, verifyCreator, type TestUser } from "./helpers";

// Close Friends · el rol `member` (migraciones 20260924100000 → 20260924140000).
//
// Lo que pidió Evan como mínimo:
//   · RLS: un miembro no ve a otro; un negocio no ve miembros de otro negocio
//     ni contactos sin consentimiento;
//   · registro: menor de edad, correo que ya es de otro rol, código inactivo;
//   · un cupón no se reclama dos veces;
//   · dos reclamos simultáneos del último cupón en stock: entra uno solo.
//
// Y lo que abrió la exploración: nadie se pone un rol que no le toca.

const VERSION = "test-2026-09-24";

let marcaX: TestUser;
let marcaY: TestUser;
let marcaSinVerificar: TestUser;
let creador: TestUser;
let miembroA: TestUser;
let miembroB: TestUser;

let codigoX: string;
let codigoY: string;
let codigoInactivo: string;

const sufijo = randomUUID().replace(/-/g, "").slice(0, 8);
const agenteA = `Válé_${sufijo}`;
const agenteB = `agente.b.${sufijo}`.slice(0, 20);

/** Una fecha de nacimiento de hace `anios` años, como la manda el formulario. */
function nacido(anios: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anios);
  return d.toISOString().slice(0, 10);
}

function registro(code: string, extra: Record<string, unknown> = {}) {
  return {
    p_code: code,
    p_full_name: "Persona de Prueba",
    p_phone: "+50688887777",
    p_birthdate: nacido(25),
    p_agent_name: `ag${randomUUID().slice(0, 8)}`,
    p_acepta_terminos: true,
    p_comparte_con_marca: false,
    p_whatsapp: false,
    p_version_textos: VERSION,
    ...extra,
  };
}

/** Lo que pasa cuando un miembro con sesión escanea el QR de un cupón. */
async function escanear(quien: TestUser, couponId: string) {
  const { data: qr } = await admin.from("brand_invite_codes").select("code").eq("coupon_id", couponId).single();
  return quien.client.rpc("completar_registro_miembro", {
    ...registro(qr!.code),
    p_full_name: null,
    p_phone: null,
    p_birthdate: null,
    p_agent_name: null,
  });
}

async function rolDe(id: string) {
  const { data } = await admin.from("profiles").select("role").eq("id", id).single();
  return data?.role ?? null;
}

beforeAll(async () => {
  [marcaX, marcaY, marcaSinVerificar, creador, miembroA, miembroB] = await Promise.all([
    makeUser("brand"),
    makeUser("brand"),
    makeUser("brand"),
    makeUser("creator"),
    makeUser("sin-rol"),
    makeUser("sin-rol"),
  ]);

  const { error: eMarcas } = await admin.from("brand_profiles").insert([
    { profile_id: marcaX.id, brand_name: "CF Test X", industry: "Restaurante", verified: true },
    { profile_id: marcaY.id, brand_name: "CF Test Y", industry: "Hotel", verified: true },
    { profile_id: marcaSinVerificar.id, brand_name: "CF Sin Verificar", industry: "Bar", verified: false },
  ]);
  if (eMarcas) throw new Error(`setup brand_profiles: ${eMarcas.message}`);

  const { error: eCreador } = await admin
    .from("creator_profiles")
    .insert({ profile_id: creador.id, handle: `@cf.${creador.id.slice(0, 8)}` });
  if (eCreador) throw new Error(`setup creator_profiles: ${eCreador.message}`);
  await verifyCreator(creador.id);

  // Los códigos los crea la marca con SU sesión, como en el panel: solo manda
  // la etiqueta. Si esto falla, la prueba de grants de abajo no vale nada.
  const { data: cx, error: eCx } = await marcaX.client
    .from("brand_invite_codes")
    .insert({ label: "Caja" })
    .select("code")
    .single();
  if (eCx) throw new Error(`setup código X: ${eCx.message}`);
  codigoX = cx.code;

  const { data: cy } = await marcaY.client.from("brand_invite_codes").insert({ label: "Mesa 4" }).select("code").single();
  codigoY = cy!.code;

  const { data: ci } = await marcaX.client
    .from("brand_invite_codes")
    .insert({ label: "Viejo" })
    .select("id, code")
    .single();
  codigoInactivo = ci!.code;
  await marcaX.client.from("brand_invite_codes").update({ active: false }).eq("id", ci!.id);
});

afterAll(async () => {
  const ids = [miembroA, miembroB].filter(Boolean).map((m) => m.id);
  // El log no tiene FK a propósito (sobrevive a la cuenta), así que el
  // cascade no lo limpia: se borra a mano para no dejar rastro de pruebas.
  if (ids.length) await admin.from("member_audit_log").delete().in("member_id", ids);
  await cleanup();
});

// ---------------------------------------------------------------------------

describe("nadie se pone un rol que no le toca", () => {
  it("el metadata del alta ya no da admin", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `rlstest.meta-admin.${randomUUID()}@testmail.cr`,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    expect(error).toBeNull();
    track(data.user!.id);
    expect(await rolDe(data.user!.id)).toBeNull();
  });

  it("tampoco da member: eso solo lo pone el registro por QR", async () => {
    const { data } = await admin.auth.admin.createUser({
      email: `rlstest.meta-member.${randomUUID()}@testmail.cr`,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { role: "member" },
    });
    track(data.user!.id);
    expect(await rolDe(data.user!.id)).toBeNull();
  });

  it("una cuenta sin rol no se pone admin con un PATCH", async () => {
    const u = await makeUser("sin-rol");
    const { error } = await u.client.from("profiles").update({ role: "admin" }).eq("id", u.id);
    expect(error?.message).toContain("ese rol no se puede elegir");
    expect(await rolDe(u.id)).toBeNull();
  });

  it("ni member", async () => {
    const u = await makeUser("sin-rol");
    await u.client.from("profiles").update({ role: "member" }).eq("id", u.id);
    expect(await rolDe(u.id)).toBeNull();
  });

  it("pero sí creador o marca, que es lo que hace el onboarding", async () => {
    const u = await makeUser("sin-rol");
    const { error } = await u.client.from("profiles").update({ role: "creator" }).eq("id", u.id);
    expect(error).toBeNull();
    expect(await rolDe(u.id)).toBe("creator");
  });

  it("un creador no se cambia de rol", async () => {
    await creador.client.from("profiles").update({ role: "member" }).eq("id", creador.id);
    expect(await rolDe(creador.id)).toBe("creator");
  });
});

// ---------------------------------------------------------------------------

describe("los códigos QR del negocio", () => {
  it("nacen con un código aleatorio de 10 caracteres", () => {
    expect(codigoX).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/);
    expect(codigoX).not.toBe(codigoY);
  });

  it("la marca no elige su propio código (sería adivinable)", async () => {
    const { error } = await marcaX.client.from("brand_invite_codes").insert({ label: "x", code: "AAAAAAAAAA" } as never);
    expect(error).not.toBeNull();
  });

  it("ni se infla los escaneos o los registros", async () => {
    const { error } = await marcaX.client
      .from("brand_invite_codes")
      .update({ scans: 9999 } as never)
      .eq("code", codigoX);
    expect(error).not.toBeNull();
  });

  it("una marca no ve los códigos de otra", async () => {
    const { data } = await marcaY.client.from("brand_invite_codes").select("id").eq("code", codigoX);
    expect(data).toEqual([]);
  });

  it("una marca sin verificar no reparte QR", async () => {
    const { error } = await marcaSinVerificar.client.from("brand_invite_codes").insert({ label: "Caja" });
    expect(error).not.toBeNull();
  });

  it("la página pública muestra el negocio, sin ids, y solo con código activo", async () => {
    const { data } = await admin.rpc("invitacion_publica", { p_code: codigoX.toLowerCase() });
    // Un QR del negocio a secas no trae cupón (los QR de cupón, más abajo).
    expect(data).toEqual({ brand_name: "CF Test X", logo_url: null, slug: expect.any(String), cupon: null });

    const { data: inactivo } = await admin.rpc("invitacion_publica", { p_code: codigoInactivo });
    expect(inactivo).toBeNull();
  });

  it("y esa función no la llama nadie desde el navegador", async () => {
    const { error } = await anonClient().rpc("invitacion_publica", { p_code: codigoX });
    expect(error).not.toBeNull();
    const { error: e2 } = await miembroA.client.rpc("invitacion_publica", { p_code: codigoX });
    expect(e2).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("el registro", () => {
  it("un menor de edad no se registra, y la cuenta queda sin rol", async () => {
    const u = await makeUser("sin-rol");
    const { error } = await u.client.rpc("completar_registro_miembro", registro(codigoX, { p_birthdate: nacido(17) }));
    expect(error?.message).toContain("mayores de 18");
    expect(await rolDe(u.id)).toBeNull();
    const { data } = await admin.from("members").select("profile_id").eq("profile_id", u.id);
    expect(data).toEqual([]);
  });

  it("un código inactivo no registra", async () => {
    const u = await makeUser("sin-rol");
    const { error } = await u.client.rpc("completar_registro_miembro", registro(codigoInactivo));
    expect(error?.message).toContain("ya no está activo");
    expect(await rolDe(u.id)).toBeNull();
  });

  it("sin aceptar los términos no hay alta", async () => {
    const u = await makeUser("sin-rol");
    const { error } = await u.client.rpc("completar_registro_miembro", registro(codigoX, { p_acepta_terminos: false }));
    expect(error?.message).toContain("términos");
  });

  it("el correo de un creador no se convierte en miembro", async () => {
    const { error } = await creador.client.rpc("completar_registro_miembro", registro(codigoX));
    expect(error?.message).toContain("ya tiene una cuenta de creador o de marca");
    expect(await rolDe(creador.id)).toBe("creator");
  });

  it("el alta completa: rol, expediente, consentimientos y vínculo", async () => {
    const { data, error } = await miembroA.client.rpc(
      "completar_registro_miembro",
      registro(codigoX, { p_agent_name: agenteA, p_comparte_con_marca: true, p_whatsapp: true })
    );
    expect(error).toBeNull();
    expect(data).toMatchObject({ nuevo: true, vinculo_nuevo: true, agent_name: agenteA });
    expect(data.expediente_code).toMatch(/^CF-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    expect(await rolDe(miembroA.id)).toBe("member");

    const { data: consents } = await miembroA.client
      .from("member_consents")
      .select("kind, granted, brand_id, text_version");
    expect(consents).toHaveLength(3);
    expect(consents).toEqual(
      expect.arrayContaining([
        { kind: "terms", granted: true, brand_id: null, text_version: VERSION },
        { kind: "whatsapp_marketing", granted: true, brand_id: null, text_version: VERSION },
        // General (20260924170000): vale para todos los negocios, no para X.
        { kind: "share_with_brand", granted: true, brand_id: null, text_version: VERSION },
      ])
    );

    const { data: cod } = await admin.from("brand_invite_codes").select("signups").eq("code", codigoX).single();
    expect(cod!.signups).toBe(1);
  });

  it("el nombre de agente es único sin tildes ni mayúsculas", async () => {
    const u = await makeUser("sin-rol");
    const { error } = await u.client.rpc(
      "completar_registro_miembro",
      registro(codigoX, { p_agent_name: agenteA.toUpperCase().replace("Á", "A").replace("É", "E") })
    );
    expect(error?.message).toContain("ya está tomado");
    expect(await rolDe(u.id)).toBeNull();
  });

  it("el segundo miembro, sin compartir contacto", async () => {
    const { error } = await miembroB.client.rpc(
      "completar_registro_miembro",
      registro(codigoX, { p_agent_name: agenteB, p_comparte_con_marca: false })
    );
    expect(error).toBeNull();
  });

  it("el QR de otro negocio suma el vínculo, sin otra cuenta ni pisar datos", async () => {
    const { data, error } = await miembroA.client.rpc(
      "completar_registro_miembro",
      registro(codigoY, { p_agent_name: "otroNombre", p_full_name: "Otro Nombre", p_comparte_con_marca: false })
    );
    expect(error).toBeNull();
    expect(data).toMatchObject({ nuevo: false, vinculo_nuevo: true, agent_name: agenteA });

    const { data: ficha } = await admin.from("members").select("full_name, agent_name").eq("profile_id", miembroA.id);
    expect(ficha).toEqual([{ full_name: "Persona de Prueba", agent_name: agenteA }]);

    const { data: links } = await miembroA.client.from("member_brand_links").select("brand_id");
    expect(links!.map((l) => l.brand_id).sort()).toEqual([marcaX.id, marcaY.id].sort());
  });

  it("escanear otra vez el mismo QR no duplica nada", async () => {
    const { data } = await miembroA.client.rpc("completar_registro_miembro", registro(codigoX));
    expect(data).toMatchObject({ nuevo: false, vinculo_nuevo: false });
    const { data: cod } = await admin.from("brand_invite_codes").select("signups").eq("code", codigoX).single();
    expect(cod!.signups).toBe(2); // A y B, no A dos veces
  });
});

// ---------------------------------------------------------------------------

describe("lo que ve cada quien", () => {
  it("un miembro no ve la ficha de otro", async () => {
    const { data } = await miembroA.client.from("members").select("profile_id").eq("profile_id", miembroB.id);
    expect(data).toEqual([]);
    // Y la suya sí: una policy que devuelve vacío a todos no pasaría esto.
    const { data: propia } = await miembroA.client.from("members").select("profile_id");
    expect(propia).toEqual([{ profile_id: miembroA.id }]);
  });

  it("ni sus consentimientos ni sus vínculos", async () => {
    const { data: c } = await miembroA.client.from("member_consents").select("id").eq("member_id", miembroB.id);
    expect(c).toEqual([]);
    const { data: l } = await miembroA.client.from("member_brand_links").select("brand_id").eq("member_id", miembroB.id);
    expect(l).toEqual([]);
  });

  it("la marca no lee la tabla de miembros, ni siquiera los suyos", async () => {
    const { data } = await marcaX.client.from("members").select("profile_id, phone");
    expect(data).toEqual([]);
  });

  it("la marca ve a sus miembros, con contacto solo si lo compartieron", async () => {
    const { data, error } = await marcaX.client.rpc("miembros_de_mi_marca");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    const a = data!.find((m: { member_id: string }) => m.member_id === miembroA.id)!;
    expect(a).toMatchObject({ agent_name: agenteA, comparte_contacto: true, phone: "+50688887777", origen: "Caja" });
    expect(a.email).toBe(miembroA.email);

    const b = data!.find((m: { member_id: string }) => m.member_id === miembroB.id)!;
    expect(b).toMatchObject({ agent_name: agenteB, comparte_contacto: false, full_name: null, phone: null, email: null });
  });

  it("el permiso es general: Y, el negocio que A sumó después, también ve su contacto", async () => {
    const { data } = await marcaY.client.rpc("miembros_de_mi_marca");
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ member_id: miembroA.id, comparte_contacto: true, phone: "+50688887777" });
  });

  it("sumar un negocio no pregunta ni cambia el permiso", async () => {
    const { data: filas } = await miembroA.client.from("member_consents").select("id").eq("kind", "share_with_brand");
    expect(filas).toHaveLength(1);
  });

  it("una marca no ve los vínculos de otra", async () => {
    const { data } = await marcaY.client.from("member_brand_links").select("member_id");
    expect(data).toEqual([{ member_id: miembroA.id }]);
  });

  it("retirar el permiso esconde el contacto en TODOS sus negocios en el acto", async () => {
    const { error } = await miembroA.client.rpc("cambiar_consentimiento", {
      p_kind: "share_with_brand",
      p_brand: null,
      p_granted: false,
      p_version_textos: VERSION,
    });
    expect(error).toBeNull();

    for (const marca of [marcaX, marcaY]) {
      const { data } = await marca.client.rpc("miembros_de_mi_marca");
      expect(data!.find((m: { member_id: string }) => m.member_id === miembroA.id)).toMatchObject({
        comparte_contacto: false,
        phone: null,
      });
    }

    // Append-only: la fila vieja sigue ahí, es el historial.
    const { data: filas } = await miembroA.client.from("member_consents").select("granted").eq("kind", "share_with_brand");
    expect(filas).toHaveLength(2);
  });

  it("un permiso se guarda siempre general, aunque llegue con un negocio", async () => {
    const { error } = await miembroB.client.rpc("cambiar_consentimiento", {
      p_kind: "share_with_brand",
      p_brand: marcaY.id,
      p_granted: false,
      p_version_textos: VERSION,
    });
    expect(error).toBeNull();
    const { data } = await miembroB.client
      .from("member_consents")
      .select("brand_id")
      .eq("kind", "share_with_brand")
      .order("id", { ascending: false })
      .limit(1);
    expect(data).toEqual([{ brand_id: null }]);
  });

  it("un creador no llama la lista de miembros de nadie", async () => {
    const { data } = await creador.client.rpc("miembros_de_mi_marca");
    expect(data).toEqual([]);
  });

  it("sin sesión no se ve nada", async () => {
    const anon = anonClient();
    for (const tabla of ["members", "member_consents", "member_brand_links", "brand_invite_codes", "member_audit_log"]) {
      const { data } = await anon.from(tabla).select("*");
      expect(data ?? []).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------

describe("lo que el miembro puede escribir", () => {
  it("edita su teléfono", async () => {
    const { error } = await miembroA.client.from("members").update({ phone: "+50677776666" }).eq("profile_id", miembroA.id);
    expect(error).toBeNull();
  });

  it("pero no su expediente, su estado ni su fecha de nacimiento", async () => {
    for (const cambio of [{ expediente_code: "CF-AAAAA" }, { status: "suspendido" }, { birthdate: nacido(10) }]) {
      const { error } = await miembroA.client.from("members").update(cambio as never).eq("profile_id", miembroA.id);
      expect(error).not.toBeNull();
    }
    const { data } = await admin.from("members").select("expediente_code, status").eq("profile_id", miembroA.id).single();
    expect(data!.status).toBe("activo");
    expect(data!.expediente_code).not.toBe("CF-AAAAA");
  });

  it("no se vincula solo a un negocio ni se inventa consentimientos", async () => {
    const { error: e1 } = await miembroB.client
      .from("member_brand_links")
      .insert({ member_id: miembroB.id, brand_id: marcaY.id } as never);
    expect(e1).not.toBeNull();

    const { error: e2 } = await miembroB.client
      .from("member_consents")
      .insert({ member_id: miembroB.id, kind: "terms", granted: true, text_version: "x" } as never);
    expect(e2).not.toBeNull();
  });

  it("no ve el log de auditoría", async () => {
    const { data } = await miembroA.client.from("member_audit_log").select("id");
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("los cupones", () => {
  let cXMiembros: string;
  let cXUltimo: string;
  let codigoDeB: string;

  beforeAll(async () => {
    // Todas las filas llevan audience Y member_scope: en un insert de varias
    // filas, PostgREST manda null (no el default) en la columna que le falte a
    // una, y member_scope es NOT NULL.
    const base = { description: "Lo que incluye", claim_validity_days: 14, type: "producto", status: "publicado" };
    const { data, error } = await admin
      .from("coupons")
      .insert([
        { ...base, brand_id: marcaX.id, title: "X miembros", stock_total: 5, audience: "members", member_scope: "brand_members" },
        { ...base, brand_id: marcaX.id, title: "X creadores", stock_total: 5, audience: "creators", member_scope: "brand_members" },
        { ...base, brand_id: marcaX.id, title: "X último", stock_total: 1, audience: "both", member_scope: "brand_members" },
      ])
      .select("id, title");
    if (error) throw new Error(`setup coupons: ${error.message}`);
    const idDe = (t: string) => data!.find((c) => c.title === t)!.id;
    cXMiembros = idDe("X miembros");
    cXUltimo = idDe("X último");
  });

  it("no hay vitrina: un miembro no ve ningún cupón que no tenga en su wallet", async () => {
    const { data } = await miembroB.client.from("coupons").select("id");
    expect(data).toEqual([]);
  });

  it("y reclamar desde el panel ya no existe: la única puerta es el QR", async () => {
    const { error } = await miembroB.client.rpc("claim_coupon_member" as never, { p_coupon: cXMiembros } as never);
    expect(error).not.toBeNull();
    const { data } = await admin.from("redemptions").select("id").eq("coupon_id", cXMiembros);
    expect(data).toEqual([]);
  });

  it("escanear el QR deja el cupón en la wallet, con un código como el de Loyalty Loop", async () => {
    const { data, error } = await escanear(miembroB, cXMiembros);
    expect(error).toBeNull();
    expect(data.cupon).toMatchObject({ ok: true, nuevo: true });
    codigoDeB = data.cupon.code;
    expect(codigoDeB).toMatch(/^QL-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{2}$/);

    const { data: mio } = await miembroB.client.from("redemptions").select("member_id, creator_id").eq("code", codigoDeB).single();
    expect(mio).toEqual({ member_id: miembroB.id, creator_id: null });
    // Y ahora sí ve la ficha de ese cupón, y solo esa.
    const { data: visibles } = await miembroB.client.from("coupons").select("id");
    expect(visibles).toEqual([{ id: cXMiembros }]);
  });

  it("escanearlo dos veces no lo duplica", async () => {
    const { data } = await escanear(miembroB, cXMiembros);
    expect(data.cupon).toMatchObject({ ok: true, nuevo: false, code: codigoDeB });
    const { data: filas } = await admin.from("redemptions").select("id").eq("coupon_id", cXMiembros);
    expect(filas).toHaveLength(1);
  });

  it("un miembro no ve los reclamos de otro", async () => {
    const { data } = await miembroA.client.from("redemptions").select("id").eq("member_id", miembroB.id);
    expect(data).toEqual([]);
  });

  it("el creador no ve ni reclama lo que es solo para miembros", async () => {
    const { data } = await creador.client.from("coupons").select("id").eq("id", cXMiembros);
    expect(data).toEqual([]);
    const { error } = await creador.client.rpc("claim_coupon", { p_coupon: cXMiembros });
    expect(error).not.toBeNull();
  });

  it("y un miembro no usa la función del creador", async () => {
    const { error } = await miembroB.client.rpc("claim_coupon", { p_coupon: cXUltimo });
    expect(error?.message).toContain("Solo las cuentas de creador");
  });

  it("dos personas escanean a la vez el QR del último lugar: entra una sola", async () => {
    const [ra, rb] = await Promise.all([escanear(miembroA, cXUltimo), escanear(miembroB, cXUltimo)]);
    // Ninguna de las dos falla: el alta/vínculo se hace igual, y el cupón
    // agotado se informa en `cupon` (ver 20260924150000).
    expect(ra.error).toBeNull();
    expect(rb.error).toBeNull();
    const resultados = [ra.data.cupon, rb.data.cupon];
    expect(resultados.filter((c) => c.ok)).toHaveLength(1);
    expect(resultados.find((c) => !c.ok)).toMatchObject({ ok: false, motivo: "agotado" });

    const { data } = await admin.from("redemptions").select("id").eq("coupon_id", cXUltimo);
    expect(data).toHaveLength(1);
    const { data: cupon } = await admin.from("coupons").select("status").eq("id", cXUltimo).single();
    expect(cupon!.status).toBe("agotado");
  });

  it("otra marca no canjea el código", async () => {
    const { error } = await marcaY.client.rpc("redeem_coupon", { p_code: codigoDeB });
    expect(error?.message).toContain("No encontramos ese código");
  });

  it("la marca lo valida en caja y el miembro lo ve canjeado", async () => {
    const { data, error } = await marcaX.client.rpc("redeem_coupon", { p_code: codigoDeB });
    expect(error).toBeNull();
    expect(data!.status).toBe("canjeado");

    const { data: mio } = await miembroB.client.from("redemptions").select("status").eq("code", codigoDeB).single();
    expect(mio!.status).toBe("canjeado");

    const { data: lista } = await marcaX.client.rpc("miembros_de_mi_marca");
    expect(lista!.find((m: { member_id: string }) => m.member_id === miembroB.id)).toMatchObject({ canjeados: 1 });
  });

  it("todo quedó en el log: alta, reclamo y canje", async () => {
    const { data } = await admin
      .from("member_audit_log")
      .select("action")
      .eq("member_id", miembroB.id)
      .order("id");
    expect(data!.map((r) => r.action)).toEqual(expect.arrayContaining(["alta", "reclamo", "canje"]));
  });
});

// ---------------------------------------------------------------------------

describe("pedir la eliminación", () => {
  it("crea un solo pedido abierto aunque se pida dos veces", async () => {
    const { data: uno, error } = await miembroB.client.rpc("pedir_eliminacion_miembro", { p_reason: "ya no voy" });
    expect(error).toBeNull();
    const { data: dos } = await miembroB.client.rpc("pedir_eliminacion_miembro", { p_reason: null });
    expect(dos!.id).toBe(uno!.id);

    const { data: ficha } = await admin.from("members").select("status").eq("profile_id", miembroB.id).single();
    expect(ficha!.status).toBe("eliminacion_pedida");
  });

  it("y con la cuenta en ese estado ya no suma cupones escaneando", async () => {
    const { error } = await miembroB.client.rpc("completar_registro_miembro", registro(codigoX));
    expect(error?.message).toContain("no puede sumar negocios ni cupones");
  });

  it("otro miembro no ve ese pedido", async () => {
    const { data } = await miembroA.client.from("member_deletion_requests").select("id");
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// El QR es del cupón (20260924150000)

describe("el QR de un cupón", () => {
  let cuponTorta: string;
  let qrTorta: string;
  let nuevo: TestUser;
  let tarde: TestUser;

  beforeAll(async () => {
    const { data, error } = await admin
      .from("coupons")
      .insert({
        brand_id: marcaY.id,
        title: "Torta gratis",
        description: "Una porción",
        type: "producto",
        claim_validity_days: 14,
        status: "publicado",
        stock_total: 1,
        audience: "members",
        member_scope: "brand_members",
      })
      .select("id")
      .single();
    if (error) throw new Error(`setup cupón torta: ${error.message}`);
    cuponTorta = data.id;
    [nuevo, tarde] = await Promise.all([makeUser("sin-rol"), makeUser("sin-rol")]);
  });

  afterAll(async () => {
    await admin.from("member_audit_log").delete().in("member_id", [nuevo.id, tarde.id]);
  });

  it("nace solo al crear un cupón para miembros, y la marca lo ve", async () => {
    const { data } = await marcaY.client.from("brand_invite_codes").select("code, label").eq("coupon_id", cuponTorta);
    expect(data).toHaveLength(1);
    expect(data![0].label).toBe("Torta gratis");
    qrTorta = data![0].code;
  });

  it("un cupón solo para creadores no tiene QR", async () => {
    const { data } = await admin.from("coupons").select("id").eq("brand_id", marcaX.id).eq("title", "X creadores").single();
    const { data: qr } = await admin.from("brand_invite_codes").select("id").eq("coupon_id", data!.id);
    expect(qr).toEqual([]);
  });

  it("la página del QR muestra el cupón", async () => {
    const { data } = await admin.rpc("invitacion_publica", { p_code: qrTorta });
    expect(data.cupon).toMatchObject({ title: "Torta gratis", disponible: true });
  });

  it("registrarse por el QR deja el cupón en la wallet", async () => {
    const { data, error } = await nuevo.client.rpc("completar_registro_miembro", registro(qrTorta));
    expect(error).toBeNull();
    expect(data.cupon).toMatchObject({ ok: true, nuevo: true });

    const { data: mios } = await nuevo.client.from("redemptions").select("coupon_id, status");
    expect(mios).toEqual([{ coupon_id: cuponTorta, status: "reclamado" }]);
  });

  it("escanearlo otra vez no es un error ni duplica", async () => {
    const { data, error } = await nuevo.client.rpc("completar_registro_miembro", registro(qrTorta));
    expect(error).toBeNull();
    expect(data.cupon).toMatchObject({ ok: true, nuevo: false });
    const { data: mios } = await nuevo.client.from("redemptions").select("id");
    expect(mios).toHaveLength(1);
  });

  it("con el cupón agotado, la persona igual queda como miembro", async () => {
    const { data, error } = await tarde.client.rpc("completar_registro_miembro", registro(qrTorta));
    expect(error).toBeNull();
    expect(data).toMatchObject({ nuevo: true, cupon: { ok: false, motivo: "agotado" } });
    expect(await rolDe(tarde.id)).toBe("member");
  });

  it("un miembro con la app escanea el QR de otro negocio y queda unido con el cupón", async () => {
    // miembroA es de X y de Y; uno nuevo de X solo, para que el vínculo sea nuevo.
    const soloX = await makeUser("sin-rol");
    await soloX.client.rpc("completar_registro_miembro", registro(codigoX));
    const { data: cupon } = await admin
      .from("coupons")
      .insert({
        brand_id: marcaY.id,
        title: "Café de bienvenida",
        description: "x",
        type: "producto",
        claim_validity_days: 14,
        status: "publicado",
        stock_total: 5,
        audience: "both",
        member_scope: "brand_members",
      })
      .select("id")
      .single();
    const { data: qr } = await admin.from("brand_invite_codes").select("code").eq("coupon_id", cupon!.id).single();

    const { data } = await soloX.client.rpc(
      "completar_registro_miembro",
      { ...registro(qr!.code), p_full_name: null, p_phone: null, p_birthdate: null, p_agent_name: null }
    );
    expect(data).toMatchObject({ nuevo: false, vinculo_nuevo: true, cupon: { ok: true, nuevo: true } });
    await admin.from("member_audit_log").delete().eq("member_id", soloX.id);
  });
});

describe("apagar el QR de un cupón", () => {
  it("la marca apaga el suyo y deja de abrir el registro; no toca el de otra", async () => {
    const { data: cupon } = await admin
      .from("coupons")
      .insert({
        brand_id: marcaY.id,
        title: "Para apagar",
        description: "x",
        type: "producto",
        claim_validity_days: 5,
        status: "publicado",
        stock_total: 5,
        audience: "members",
        member_scope: "brand_members",
      })
      .select("id")
      .single();
    const { data: qr } = await admin.from("brand_invite_codes").select("code").eq("coupon_id", cupon!.id).single();

    // Otra marca: cero filas, sin error (así responde la RLS en un UPDATE).
    const { data: ajeno } = await marcaX.client
      .from("brand_invite_codes")
      .update({ active: false })
      .eq("code", qr!.code)
      .select("code");
    expect(ajeno).toEqual([]);

    const { data: propio, error } = await marcaY.client
      .from("brand_invite_codes")
      .update({ active: false })
      .eq("code", qr!.code)
      .select("active");
    expect(error).toBeNull();
    expect(propio).toEqual([{ active: false }]);

    const { data: publica } = await admin.rpc("invitacion_publica", { p_code: qr!.code });
    expect(publica).toBeNull();
  });
});
