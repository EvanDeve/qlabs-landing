import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anonClient, makeUser, cleanup, verifyCreator, type TestUser } from "./helpers";

/**
 * La vista filtra; la tabla de abajo tiene que filtrar igual.
 *
 * La auditoría del 2026-08-26 encontró cuatro veces el mismo agujero: una
 * vista (`creator_public_profiles`, `brand_public_profiles`) escondía bien lo
 * que no debía verse, y la tabla cruda que alimenta esa vista —o una tabla
 * hija— seguía abierta al mismo público. Pedirla directo por PostgREST la
 * saltea. Se cerró en `20260826140000_cerrar_tablas_de_perfil.sql`; esto fija
 * que siga cerrado cuando alguien vuelva a tocar esas policies.
 *
 * Cada caso prueba las dos caras: que lo que no debe salir no salga, y que lo
 * legítimo —el book de un creador publicado, la marca verificada en la
 * vitrina, cada quien lo suyo— siga saliendo. Una policy que devuelve cero
 * filas para todo el mundo también pasa el primer chequeo, y no sirve.
 */

let publicado: TestUser;
let sinAprobar: TestUser;
let otroCreador: TestUser;
let marca: TestUser;
let marcaRechazada: TestUser;
let otraMarca: TestUser;

/** Filas hijas de un creador, para poder buscarlas después por su valor. */
async function sembrarPerfil(creator: TestUser, tag: string) {
  const inserts = [
    admin.from("creator_skills").insert({ creator_id: creator.id, name: `skill-${tag}`, level: 3 }),
    admin.from("creator_services").insert({ creator_id: creator.id, service: `servicio-${tag}` }),
    admin.from("creator_addons").insert({ creator_id: creator.id, addon: `addon-${tag}` }),
    admin
      .from("creator_past_brands")
      .insert({ creator_id: creator.id, category: "Restaurante", brand_name: `marca-${tag}` }),
    admin.from("portfolio_items").insert({
      creator_id: creator.id,
      storage_path: `${creator.id}/pieza-${tag}.jpg`,
      media_type: "image",
    }),
  ];
  for (const [i, r] of (await Promise.all(inserts)).entries()) {
    if (r.error) throw new Error(`setup hijas ${tag} #${i}: ${r.error.message}`);
  }
}

beforeAll(async () => {
  [publicado, sinAprobar, otroCreador, marca, marcaRechazada, otraMarca] = await Promise.all([
    makeUser("creator"),
    makeUser("creator"),
    makeUser("creator"),
    makeUser("brand"),
    makeUser("brand"),
    makeUser("brand"),
  ]);

  const perfiles = await Promise.all(
    [publicado, sinAprobar, otroCreador].map((u, i) =>
      admin.from("creator_profiles").insert({
        profile_id: u.id,
        handle: `@abajo${i}.${u.id.slice(0, 8)}`,
        followers_count: 1000 * (i + 1),
        // La tarifa es la columna que la vista esconde a propósito.
        rate_min: 50000 + i,
        rate_max: 90000 + i,
      })
    )
  );
  for (const [i, r] of perfiles.entries()) {
    if (r.error) throw new Error(`setup creator_profiles ${i}: ${r.error.message}`);
  }
  await Promise.all([verifyCreator(publicado.id), verifyCreator(otroCreador.id)]);

  await Promise.all([sembrarPerfil(publicado, "pub"), sembrarPerfil(sinAprobar, "nope")]);

  const marcas = await Promise.all([
    admin.from("brand_profiles").insert({
      profile_id: marca.id,
      brand_name: "Marca Verificada Abajo",
      industry: "Restaurante",
      verified: true,
    }),
    admin.from("brand_profiles").insert({
      profile_id: marcaRechazada.id,
      brand_name: "Marca Rechazada Abajo",
      industry: "Restaurante",
      verified: false,
      rejected_at: new Date().toISOString(),
      rejection_reason: "MOTIVO INTERNO: no debería leerse afuera",
    }),
    admin.from("brand_profiles").insert({
      profile_id: otraMarca.id,
      brand_name: "Otra Marca Abajo",
      industry: "Hotel",
      verified: true,
    }),
  ]);
  for (const [i, r] of marcas.entries()) {
    if (r.error) throw new Error(`setup brand_profiles ${i}: ${r.error.message}`);
  }
});

afterAll(cleanup);

// Las cinco tablas hijas comparten policy; se recorren con la misma prueba
// para que agregar una sexta sea sumar una línea acá.
const HIJAS = [
  { tabla: "creator_skills", columna: "name", prefijo: "skill" },
  { tabla: "creator_services", columna: "service", prefijo: "servicio" },
  { tabla: "creator_addons", columna: "addon", prefijo: "addon" },
  { tabla: "creator_past_brands", columna: "brand_name", prefijo: "marca" },
  { tabla: "portfolio_items", columna: "storage_path", prefijo: null },
] as const;

function filasDe(client: TestUser["client"] | ReturnType<typeof anonClient>, tabla: string, creatorId: string) {
  return client.from(tabla).select("id").eq("creator_id", creatorId);
}

describe("las hijas de creator_public_profiles: solo de creadores publicados", () => {
  for (const { tabla } of HIJAS) {
    it(`${tabla}: el visitante ve las del publicado y ninguna del que está sin aprobar`, async () => {
      const anon = anonClient();
      const { data: ocultas } = await filasDe(anon, tabla, sinAprobar.id);
      expect(ocultas ?? []).toHaveLength(0);

      const { data: visibles, error } = await filasDe(anon, tabla, publicado.id);
      // Las tres tablas del book se muestran afuera; servicios y add-ons son
      // solo para quien tiene sesión, y para el anónimo dan vacío sin error.
      expect(error).toBeNull();
      if (tabla === "creator_services" || tabla === "creator_addons") {
        expect(visibles ?? []).toHaveLength(0);
      } else {
        expect(visibles).toHaveLength(1);
      }
    });

    it(`${tabla}: una marca con sesión tampoco ve al que está sin aprobar`, async () => {
      const { data: ocultas } = await filasDe(marca.client, tabla, sinAprobar.id);
      expect(ocultas ?? []).toHaveLength(0);

      const { data: visibles } = await filasDe(marca.client, tabla, publicado.id);
      expect(visibles).toHaveLength(1);
    });

    it(`${tabla}: el dueño sin aprobar sí ve lo suyo`, async () => {
      const { data } = await filasDe(sinAprobar.client, tabla, sinAprobar.id);
      expect(data).toHaveLength(1);
    });
  }

  it("un creador no ve al que está sin aprobar ni por el valor de la fila", async () => {
    // Buscar por valor y no por creator_id: es la consulta que haría alguien
    // que no sabe el id y va tanteando.
    for (const { tabla, columna, prefijo } of HIJAS) {
      if (!prefijo) continue;
      const { data } = await otroCreador.client.from(tabla).select("creator_id").eq(columna, `${prefijo}-nope`);
      expect(data ?? [], tabla).toHaveLength(0);
    }
  });
});

describe("creator_profiles: la tarifa es de cada quien", () => {
  it("el creador lee su propia fila, tarifa incluida", async () => {
    const { data, error } = await publicado.client
      .from("creator_profiles")
      .select("rate_min")
      .eq("profile_id", publicado.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].rate_min).toBe(50000);
  });

  it("un creador no lee la fila de otro, aunque esté publicado", async () => {
    const { data } = await otroCreador.client
      .from("creator_profiles")
      .select("rate_min")
      .eq("profile_id", publicado.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("una marca tampoco: para eso está la vista, que no trae la tarifa", async () => {
    const { data: tabla } = await marca.client
      .from("creator_profiles")
      .select("profile_id")
      .eq("profile_id", publicado.id);
    expect(tabla ?? []).toHaveLength(0);

    const { data: vista, error } = await marca.client
      .from("creator_public_profiles")
      .select("profile_id")
      .eq("profile_id", publicado.id);
    expect(error).toBeNull();
    expect(vista).toHaveLength(1);

    const { error: sinColumna } = await marca.client
      .from("creator_public_profiles")
      .select("rate_min")
      .eq("profile_id", publicado.id);
    expect(sinColumna).not.toBeNull();
  });

  it("sin sesión, la tabla no entrega nada", async () => {
    const { data } = await anonClient().from("creator_profiles").select("profile_id").eq("profile_id", publicado.id);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("brand_profiles: cerrada al dueño; afuera, la vista", () => {
  it("sin sesión, la tabla no entrega nada — ni la marca verificada", async () => {
    const { data } = await anonClient().from("brand_profiles").select("brand_name").eq("profile_id", marca.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("brand_public_profiles muestra la verificada y esconde la rechazada", async () => {
    const anon = anonClient();
    const { data: verificada, error } = await anon
      .from("brand_public_profiles")
      .select("brand_name")
      .eq("profile_id", marca.id);
    expect(error).toBeNull();
    expect(verificada).toHaveLength(1);

    const { data: rechazada } = await anon
      .from("brand_public_profiles")
      .select("brand_name")
      .eq("profile_id", marcaRechazada.id);
    expect(rechazada ?? []).toHaveLength(0);
  });

  it("la vista no tiene columna de motivo de rechazo", async () => {
    const { error } = await anonClient().from("brand_public_profiles").select("rejection_reason").limit(1);
    expect(error).not.toBeNull();
  });

  it("una marca lee la suya y no la de otra", async () => {
    const { data: propia, error } = await marca.client
      .from("brand_profiles")
      .select("brand_name")
      .eq("profile_id", marca.id);
    expect(error).toBeNull();
    expect(propia).toHaveLength(1);

    const { data: ajena } = await marca.client
      .from("brand_profiles")
      .select("brand_name, rejection_reason")
      .eq("profile_id", marcaRechazada.id);
    expect(ajena ?? []).toHaveLength(0);

    const { data: otra } = await otraMarca.client.from("brand_profiles").select("brand_name").eq("profile_id", marca.id);
    expect(otra ?? []).toHaveLength(0);
  });

  it("un creador con sesión no lee la tabla, pero sí la vitrina", async () => {
    const { data: tabla } = await publicado.client
      .from("brand_profiles")
      .select("brand_name")
      .eq("profile_id", marca.id);
    expect(tabla ?? []).toHaveLength(0);

    const { data: vista } = await publicado.client
      .from("brand_public_profiles")
      .select("brand_name")
      .eq("profile_id", marca.id);
    expect(vista).toHaveLength(1);
  });
});
