import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, makeUser, cleanup, verifyCreator, type TestUser } from "./helpers";

// El trigger enforce_application_transition es lo único que impide que una
// marca cancele DESPUÉS de recibir el material, o que un creador se apruebe
// su propia entrega. Estas son las reglas que protegen plata y trabajo hecho,
// así que se prueban contra la base, no confiando en que la UI no muestre el
// botón.

let marca: TestUser;
let creador: TestUser;
let staff: TestUser;
let campaignId: string;

/** Crea una aplicación en el estado pedido, saltando RLS con service role. */
async function nuevaAplicacion(status: string): Promise<string> {
  await admin.from("applications").delete().eq("campaign_id", campaignId);
  const { data, error } = await admin
    .from("applications")
    .insert({ campaign_id: campaignId, creator_id: creador.id, status })
    .select("id")
    .single();
  if (error) throw new Error(`no se pudo montar la aplicación en ${status}: ${error.message}`);
  return data!.id;
}

async function estadoDe(id: string): Promise<string> {
  const { data } = await admin.from("applications").select("status").eq("id", id).single();
  return data!.status;
}

beforeAll(async () => {
  [marca, creador, staff] = await Promise.all([
    makeUser("brand"),
    makeUser("creator"),
    makeUser("admin"),
  ]);

  const { error: eM } = await admin
    .from("brand_profiles")
    .insert({ profile_id: marca.id, brand_name: "Marca Conflictos", industry: "Restaurante", verified: true });
  if (eM) throw new Error(`setup brand: ${eM.message}`);

  const { error: eC } = await admin
    .from("creator_profiles")
    .insert({ profile_id: creador.id, handle: `@conf.${creador.id.slice(0, 8)}`, verified: false });
  if (eC) throw new Error(`setup creator: ${eC.message}`);
  await verifyCreator(creador.id);

  const { data, error } = await admin
    .from("campaigns")
    .insert({
      brand_id: marca.id,
      title: "Campaña de conflictos",
      brief: "brief",
      budget_amount: 80_000,
      deliverables: [{ type: "reel", qty: 1 }],
      status: "published",
      published_at: new Date().toISOString(),
      usage_rights_scope: "organico",
      usage_rights_duration: "meses_3",
      usage_rights_editing: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(`setup campaign: ${error.message}`);
  campaignId = data!.id;
});

afterAll(async () => {
  // Las notificaciones de disputa van a los admins REALES del proyecto, no a
  // las cuentas de prueba, así que no se van en cascada al borrar los usuarios:
  // hay que limpiarlas a mano o quedan sonando en la campana de gente real.
  await admin
    .from("notifications")
    .delete()
    .eq("type", "application_disputed")
    .eq("payload->>campaign_id", campaignId);

  await admin.from("campaigns").delete().eq("id", campaignId);
  await cleanup();
});

describe("cancelar: solo mientras no haya entrega", () => {
  it("el creador puede liberarse de una aceptada", async () => {
    const id = await nuevaAplicacion("accepted");
    await creador.client.from("applications").update({ status: "cancelled" }).eq("id", id);
    expect(await estadoDe(id)).toBe("cancelled");
  });

  it("la marca puede cancelar una aceptada", async () => {
    const id = await nuevaAplicacion("accepted");
    await marca.client.from("applications").update({ status: "cancelled" }).eq("id", id);
    expect(await estadoDe(id)).toBe("cancelled");
  });

  it("LA MARCA NO PUEDE CANCELAR DESPUÉS DE RECIBIR — es la regla que más protege al creador", async () => {
    const id = await nuevaAplicacion("delivered");
    const { error } = await marca.client
      .from("applications")
      .update({ status: "cancelled" })
      .eq("id", id);

    expect(error).not.toBeNull();
    expect(await estadoDe(id)).toBe("delivered");
  });

  it("el creador tampoco puede cancelar lo que ya entregó", async () => {
    const id = await nuevaAplicacion("delivered");
    await creador.client.from("applications").update({ status: "cancelled" }).eq("id", id);
    expect(await estadoDe(id)).toBe("delivered");
  });
});

describe("disputar: solo sobre una entrega hecha", () => {
  it("el creador puede abrir un caso sobre lo entregado", async () => {
    const id = await nuevaAplicacion("delivered");
    await creador.client
      .from("applications")
      .update({ status: "disputed", conflict_reason: "no me responden hace 8 días" })
      .eq("id", id);
    expect(await estadoDe(id)).toBe("disputed");
  });

  it("la marca puede abrir un caso sobre lo recibido", async () => {
    const id = await nuevaAplicacion("delivered");
    await marca.client
      .from("applications")
      .update({ status: "disputed", conflict_reason: "el video no sigue el brief" })
      .eq("id", id);
    expect(await estadoDe(id)).toBe("disputed");
  });

  it("no se puede disputar algo que todavía no se entregó", async () => {
    const id = await nuevaAplicacion("accepted");
    await creador.client.from("applications").update({ status: "disputed" }).eq("id", id);
    expect(await estadoDe(id)).toBe("accepted");
  });
});

describe("lo que nadie puede hacer", () => {
  it("un creador no puede aprobarse su propia entrega", async () => {
    const id = await nuevaAplicacion("delivered");
    const { error } = await creador.client
      .from("applications")
      .update({ status: "approved" })
      .eq("id", id);

    expect(error).not.toBeNull();
    expect(await estadoDe(id)).toBe("delivered");
  });

  it("un creador no puede autoaceptarse una aplicación pendiente", async () => {
    const id = await nuevaAplicacion("pending");
    await creador.client.from("applications").update({ status: "accepted" }).eq("id", id);
    expect(await estadoDe(id)).toBe("pending");
  });

  it("una marca no puede resucitar una cancelada", async () => {
    const id = await nuevaAplicacion("cancelled");
    await marca.client.from("applications").update({ status: "accepted" }).eq("id", id);
    expect(await estadoDe(id)).toBe("cancelled");
  });
});

describe("resolución de Q Labs", () => {
  it("un admin puede cerrar una disputa aprobando la entrega", async () => {
    const id = await nuevaAplicacion("disputed");
    const { error } = await staff.client
      .from("applications")
      .update({ status: "approved", admin_note: "revisamos el material y cumple el brief" })
      .eq("id", id);

    expect(error).toBeNull();
    expect(await estadoDe(id)).toBe("approved");
  });

  it("un admin puede cerrar una disputa cancelando la colaboración", async () => {
    const id = await nuevaAplicacion("disputed");
    await staff.client
      .from("applications")
      .update({ status: "cancelled", admin_note: "el creador nunca entregó lo pactado" })
      .eq("id", id);
    expect(await estadoDe(id)).toBe("cancelled");
  });

  it("una disputa le genera notificación a los admins", async () => {
    const id = await nuevaAplicacion("delivered");
    await admin.from("notifications").delete().eq("profile_id", staff.id);

    await creador.client
      .from("applications")
      .update({ status: "disputed", conflict_reason: "sin respuesta" })
      .eq("id", id);

    const { data } = await admin
      .from("notifications")
      .select("type, payload")
      .eq("profile_id", staff.id)
      .eq("type", "application_disputed");

    expect(data?.length).toBeGreaterThan(0);
    expect((data![0].payload as Record<string, unknown>).application_id).toBe(id);
  });
});
