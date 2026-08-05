import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, anonClient, makeUser, cleanup, type TestUser } from "./helpers";
import { VOICEOVER_BUCKET } from "../../src/lib/ugc/voz";

// Los voiceovers son material de trabajo privado de cada cuenta, igual que las
// transcripciones: la herramienta hoy es solo del equipo, pero "del equipo" no
// significa "de todos". Un director no tiene por qué escuchar los audios de
// otro miembro, y el día que se le abra a los creadores esa línea ya tiene que
// estar puesta.
//
// ⚠️ Requiere que el bucket `voiceovers` exista en el proyecto (privado, 10 MB,
// audio/mpeg). Se crea a mano desde el dashboard de Supabase — la migración
// 20260805000000 solo trae sus policies.

let uno: TestUser;
let otro: TestUser;
let voiceoverId: string;

/** Un mp3 no hace falta: lo que se prueba es el permiso, no el contenido. */
const AUDIO = Buffer.from("audio de prueba");

const subidos: string[] = [];

async function intentarSubida(quien: TestUser, path: string): Promise<string | null> {
  const { error } = await quien.client.storage
    .from(VOICEOVER_BUCKET)
    .upload(path, AUDIO, { contentType: "audio/mpeg" });
  if (!error) subidos.push(path);
  return error?.message ?? null;
}

beforeAll(async () => {
  [uno, otro] = await Promise.all([makeUser("admin"), makeUser("admin")]);

  const { data, error } = await uno.client
    .from("voiceovers")
    .insert({
      owner_id: uno.id,
      text: "Probá el brunch de domingo en Zonna.",
      voice_id: "voz-de-prueba",
      voice_name: "Prueba",
      char_count: 36,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`setup voiceovers: ${error?.message}`);
  voiceoverId = data.id;
});

afterAll(async () => {
  if (subidos.length) await admin.storage.from(VOICEOVER_BUCKET).remove(subidos);
  await admin.from("voiceovers").delete().eq("id", voiceoverId);
  await cleanup();
});

describe("tabla voiceovers", () => {
  it("el dueño ve el suyo", async () => {
    const { data } = await uno.client.from("voiceovers").select("id, text").eq("id", voiceoverId);
    expect(data).toHaveLength(1);
    expect(data![0].text).toContain("Zonna");
  });

  it("otra cuenta del equipo NO lo ve", async () => {
    const { data } = await otro.client.from("voiceovers").select("id").eq("id", voiceoverId);
    expect(data ?? []).toHaveLength(0);
  });

  it("otra cuenta NO lo puede borrar", async () => {
    // Un delete filtrado por RLS no da error: simplemente no toca ninguna fila.
    // Por eso se verifica después que la fila siga viva, y no solo el error.
    await otro.client.from("voiceovers").delete().eq("id", voiceoverId);

    const { count } = await admin
      .from("voiceovers")
      .select("id", { count: "exact", head: true })
      .eq("id", voiceoverId);
    expect(count).toBe(1);
  });

  it("nadie puede crear un voiceover a nombre de otro", async () => {
    const { error } = await otro.client.from("voiceovers").insert({
      owner_id: uno.id,
      text: "colado",
      voice_id: "x",
      voice_name: "x",
      char_count: 6,
    });
    expect(error).not.toBeNull();
  });

  it("un visitante sin sesión no ve nada", async () => {
    // La policy es `to authenticated`, así que el anónimo no debería ver ni
    // una fila. Se chequea aparte porque es el caso que se escapa cuando una
    // policy se escribe pensando solo en "el usuario equivocado".
    const { data } = await anonClient().from("voiceovers").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});

describe("bucket voiceovers", () => {
  it("cada quien escribe en su propia carpeta", async () => {
    const error = await intentarSubida(uno, `${uno.id}/propio.mp3`);
    if (error?.includes("Bucket not found")) {
      throw new Error(
        `Falta crear el bucket '${VOICEOVER_BUCKET}' en el dashboard de Supabase (privado, 10 MB, audio/mpeg).`
      );
    }
    expect(error).toBeNull();
  });

  it("no se puede escribir en la carpeta de otro", async () => {
    const error = await intentarSubida(otro, `${uno.id}/colado.mp3`);
    expect(error).not.toBeNull();
  });

  it("no se puede leer el audio de otro", async () => {
    const { error } = await otro.client.storage.from(VOICEOVER_BUCKET).download(`${uno.id}/propio.mp3`);
    expect(error).not.toBeNull();
  });
});
