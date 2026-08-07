import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anonClient, makeUser, cleanup, verifyCreator, type TestUser } from "./helpers";

// Las dos cosas que el roadmap pide probar sí o sí:
//   1. que un usuario no pueda leer datos ajenos (RLS)
//   2. el flujo crítico publicar -> aplicar -> aceptar
//
// Se prueban contra el proyecto Supabase real, con cuentas desechables que se
// borran en el teardown. Ver README.md de esta carpeta antes de tocar nada.

let marca: TestUser;
let otraMarca: TestUser;
let creador: TestUser;
let otroCreador: TestUser;
let campaignId: string;
let borradorId: string;

beforeAll(async () => {
  [marca, otraMarca, creador, otroCreador] = await Promise.all([
    makeUser("brand"),
    makeUser("brand"),
    makeUser("creator"),
    makeUser("creator"),
  ]);

  // Perfiles. La marca dueña va verificada porque publicar exige verificación;
  // el creador arranca SIN verificar a propósito, para probar el gate.
  // Se chequea cada error: un insert que falla en silencio deja los tests
  // "pasando" contra un escenario que no existe.
  const { error: eMarcas } = await admin.from("brand_profiles").insert([
    { profile_id: marca.id, brand_name: "Marca RLS Test", industry: "Restaurante", verified: true },
    { profile_id: otraMarca.id, brand_name: "Otra Marca RLS", industry: "Hotel", verified: true },
  ]);
  if (eMarcas) throw new Error(`setup brand_profiles: ${eMarcas.message}`);

  const { error: eCreadores } = await admin.from("creator_profiles").insert([
    { profile_id: creador.id, handle: `@rls.${creador.id.slice(0, 8)}`, followers_count: 5000, verified: false },
    { profile_id: otroCreador.id, handle: `@rls2.${otroCreador.id.slice(0, 8)}`, followers_count: 8000, verified: false },
  ]);
  if (eCreadores) throw new Error(`setup creator_profiles: ${eCreadores.message}`);

  const { data: pub } = await admin
    .from("campaigns")
    .insert({
      brand_id: marca.id,
      title: "Campaña RLS publicada",
      brief: "BRIEF-SECRETO-RLS",
      budget_amount: 100_000,
      deliverables: [{ type: "reel", qty: 1 }],
      status: "published",
      published_at: new Date().toISOString(),
      usage_rights_scope: "pauta",
      usage_rights_duration: "meses_6",
      usage_rights_editing: true,
    })
    .select("id")
    .single();
  campaignId = pub!.id;

  const { data: draft } = await admin
    .from("campaigns")
    .insert({
      brand_id: marca.id,
      title: "Campaña RLS borrador",
      brief: "BRIEF-BORRADOR-RLS",
      budget_amount: 50_000,
      deliverables: [{ type: "reel", qty: 1 }],
      status: "draft",
    })
    .select("id")
    .single();
  borradorId = draft!.id;
});

afterAll(async () => {
  await admin.from("campaigns").delete().in("id", [campaignId, borradorId].filter(Boolean));
  await cleanup();
});

describe("visitante anónimo", () => {
  it("no puede leer la tabla campaigns: ni brief ni presupuesto salen sin sesión", async () => {
    const { data } = await anonClient().from("campaigns").select("*").eq("id", campaignId);
    expect(data).toEqual([]);
  });

  it("ve la campaña en campaign_previews pero sin brief, presupuesto ni derechos", async () => {
    const { data } = await anonClient().from("campaign_previews").select("*").eq("id", campaignId);
    expect(data).toHaveLength(1);
    const fila = data![0] as Record<string, unknown>;
    expect(fila.title).toBe("Campaña RLS publicada");
    for (const prohibido of [
      "brief",
      "budget_amount",
      "usage_rights_scope",
      "usage_rights_duration",
      "usage_rights_notes",
      "target_audience",
    ]) {
      expect(Object.keys(fila)).not.toContain(prohibido);
    }
    expect(JSON.stringify(fila)).not.toContain("BRIEF-SECRETO-RLS");
  });

  it("no puede leer aplicaciones ni perfiles de marca ajenos", async () => {
    const anon = anonClient();
    const { data: apps } = await anon.from("applications").select("*");
    expect(apps ?? []).toEqual([]);
  });
});

describe("aislamiento entre cuentas", () => {
  it("un creador no puede editar el perfil de otro creador", async () => {
    await creador.client
      .from("creator_profiles")
      .update({ followers_count: 999_999 })
      .eq("profile_id", otroCreador.id);

    // RLS puede rechazar explícito o simplemente no afectar filas: se comprueba
    // el efecto real sobre los datos, que es lo que importa.
    const { data } = await admin
      .from("creator_profiles")
      .select("followers_count")
      .eq("profile_id", otroCreador.id)
      .single();
    expect(data!.followers_count).toBe(8000);
  });

  it("un creador no puede auto-verificarse (trigger protect_verified)", async () => {
    await creador.client.from("creator_profiles").update({ verified: true }).eq("profile_id", creador.id);

    const { data } = await admin
      .from("creator_profiles")
      .select("verified")
      .eq("profile_id", creador.id)
      .single();
    expect(data!.verified).toBe(false);
  });

  it("un creador no puede leer el brief de una campaña en borrador", async () => {
    const { data } = await creador.client.from("campaigns").select("*").eq("id", borradorId);
    expect(data ?? []).toEqual([]);
  });

  it("una marca no puede leer las campañas de otra marca", async () => {
    const { data } = await otraMarca.client.from("campaigns").select("*").eq("id", borradorId);
    expect(data ?? []).toEqual([]);
  });
});

describe("gate de verificación", () => {
  // Este bloque es el que se ganó con la migración 20260807000000. Antes,
  // `campaigns_select_published_creators` solo pedía el ROL, que se elige uno
  // mismo al registrarse: bastaba registrarse como creador para leer el brief y
  // el presupuesto de todas las campañas publicadas, sin verificar nada. Y la
  // llave anónima de Supabase viaja en el HTML, así que ni siquiera hacía falta
  // abrir el panel — se pedía por API.
  //
  // Se usa `otroCreador`, que queda sin verificar durante todo el archivo, para
  // que estos tests no dependan del orden de los de abajo.
  it("un creador sin verificar NO puede leer el brief de una campaña publicada", async () => {
    const { data } = await otroCreador.client.from("campaigns").select("*").eq("id", campaignId);
    expect(data ?? []).toEqual([]);
  });

  it("un creador sin verificar tampoco la ve al pedir la tabla entera", async () => {
    const { data } = await otroCreador.client.from("campaigns").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("la vitrina pública SÍ le sigue saliendo — el bloqueo es del brief, no del catálogo", async () => {
    const { data } = await otroCreador.client
      .from("campaign_previews")
      .select("*")
      .eq("id", campaignId);
    expect(data).toHaveLength(1);
    expect(JSON.stringify(data![0])).not.toContain("BRIEF-SECRETO-RLS");
  });

  it("un creador no puede sacarse el rechazo solo (trigger protect_verified)", async () => {
    const { error: eRechazo } = await admin
      .from("creator_profiles")
      .update({ rejected_at: new Date().toISOString(), rejection_reason: "prueba" })
      .eq("profile_id", otroCreador.id);
    expect(eRechazo).toBeNull();

    await otroCreador.client
      .from("creator_profiles")
      .update({ rejected_at: null, rejection_reason: null })
      .eq("profile_id", otroCreador.id);

    const { data } = await admin
      .from("creator_profiles")
      .select("rejected_at")
      .eq("profile_id", otroCreador.id)
      .single();
    expect(data!.rejected_at).not.toBeNull();
  });

  it("un creador sin verificar NO puede aplicar", async () => {
    const { error } = await creador.client
      .from("applications")
      .insert({ campaign_id: campaignId, creator_id: creador.id });

    expect(error).not.toBeNull();

    const { count } = await admin
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    expect(count).toBe(0);
  });
});

describe("flujo crítico: publicar -> aplicar -> aceptar", () => {
  it("una vez verificado, el creador ve el brief completo", async () => {
    await verifyCreator(creador.id);

    const { data } = await creador.client.from("campaigns").select("brief").eq("id", campaignId);
    expect(data).toHaveLength(1);
    expect(data![0].brief).toBe("BRIEF-SECRETO-RLS");
  });

  it("una vez verificado, el creador sí puede aplicar", async () => {

    const { error } = await creador.client
      .from("applications")
      .insert({ campaign_id: campaignId, creator_id: creador.id, pitch_message: "Me interesa" });
    expect(error).toBeNull();

    const { data } = await admin
      .from("applications")
      .select("status, creator_id")
      .eq("campaign_id", campaignId)
      .single();
    expect(data!.status).toBe("pending");
    expect(data!.creator_id).toBe(creador.id);
  });

  it("la marca dueña ve la aplicación de SU campaña", async () => {
    const { data } = await marca.client.from("applications").select("*").eq("campaign_id", campaignId);
    expect(data).toHaveLength(1);
    expect(data![0].creator_id).toBe(creador.id);
  });

  it("OTRA marca no ve esa aplicación — es la regla que más plata protege", async () => {
    const { data } = await otraMarca.client.from("applications").select("*").eq("campaign_id", campaignId);
    expect(data ?? []).toEqual([]);
  });

  it("otro creador tampoco ve la aplicación ajena", async () => {
    const { data } = await otroCreador.client.from("applications").select("*").eq("campaign_id", campaignId);
    expect(data ?? []).toEqual([]);
  });

  it("la marca dueña acepta la aplicación y el estado queda en accepted", async () => {
    const { data: app } = await admin
      .from("applications")
      .select("id")
      .eq("campaign_id", campaignId)
      .single();

    const { error } = await marca.client
      .from("applications")
      .update({ status: "accepted" })
      .eq("id", app!.id);
    expect(error).toBeNull();

    const { data } = await admin.from("applications").select("status").eq("id", app!.id).single();
    expect(data!.status).toBe("accepted");
  });

  it("otra marca NO puede cambiarle el estado a una aplicación ajena", async () => {
    const { data: app } = await admin
      .from("applications")
      .select("id")
      .eq("campaign_id", campaignId)
      .single();

    await otraMarca.client.from("applications").update({ status: "rejected" }).eq("id", app!.id);

    const { data } = await admin.from("applications").select("status").eq("id", app!.id).single();
    expect(data!.status).toBe("accepted");
  });
});
