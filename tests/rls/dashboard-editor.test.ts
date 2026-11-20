import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { admin, anonClient, makeUser, cleanup, type TestUser } from "./helpers";

/**
 * Spec 003, dashboard del editor. Migración 20261119120000_dashboard_editor.sql.
 *
 * Primer bloque (T07): el momento de terminado. Lo escribe SOLO el trigger
 * registrar_terminado, entre por la puerta que entre (la sesión del editor o
 * McLovin con service role), y nadie lo puede poner a mano: la policy de
 * content_pieces autoriza la fila, no la columna.
 *
 * Corre en un board de prueba `v_rls…` con sus propias columnas para no tocar
 * el tablero real del equipo. El board se borra al final.
 */

const BOARD = `v_rls${randomUUID().replace(/-/g, "").slice(0, 10)}`;

let editor: TestUser;
const col = { porEditar: "", revision: "", terminado: "", publicado: "" };
const piezas: string[] = [];

async function crearPieza(columnId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await admin
    .from("content_pieces")
    .insert({ title: "RLS test 003", brand_id: null, column_id: columnId, owner_id: editor.id, ...extra })
    .select("id")
    .single();
  if (error || !data) throw new Error(`setup content_pieces: ${error?.message}`);
  piezas.push(data.id);
  return data.id;
}

async function leer(id: string): Promise<{ terminado_at: string | null; owner_id: string | null }> {
  const { data, error } = await admin.from("content_pieces").select("terminado_at, owner_id").eq("id", id).single();
  if (error || !data) throw new Error(`leer pieza: ${error?.message}`);
  return data;
}

/** Mueve con la sesión del editor y confirma que la fila de verdad se movió. */
async function moverComoEditor(id: string, columnId: string) {
  const { data, error } = await editor.client
    .from("content_pieces")
    .update({ column_id: columnId })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`mover como editor: ${error.message}`);
  expect(data).toHaveLength(1);
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  editor = await makeUser("admin");
  const { error: eS } = await admin.from("staff_members").insert({ profile_id: editor.id, staff_role: "editor" });
  if (eS) throw new Error(`setup staff_members: ${eS.message}`);

  const { error: eB } = await admin.from("pipeline_boards").insert({ id: BOARD, name: "RLS 003", kind: "videos", position: 99 });
  if (eB) throw new Error(`setup pipeline_boards: ${eB.message}`);
  // Un board que no es 'video': el editor entra porque es miembro.
  const { error: eM } = await admin.from("pipeline_board_members").insert({ board_id: BOARD, profile_id: editor.id });
  if (eM) throw new Error(`setup pipeline_board_members: ${eM.message}`);

  const { data: cols, error: eC } = await admin
    .from("content_columns")
    // Todas las filas con las mismas claves: en un insert de varias, PostgREST
    // manda null en la que falta y las banderas son not null.
    .insert([
      { name: "Por editar", section: BOARD, position: 0, es_por_editar: true, cuenta_como_terminado: false },
      { name: "Revisión", section: BOARD, position: 1, es_por_editar: false, cuenta_como_terminado: false },
      { name: "Terminado", section: BOARD, position: 2, es_por_editar: false, cuenta_como_terminado: true },
      { name: "Publicado", section: BOARD, position: 3, es_por_editar: false, cuenta_como_terminado: true },
    ])
    .select("id, position");
  if (eC || !cols || cols.length !== 4) throw new Error(`setup content_columns: ${eC?.message}`);
  const porPos = Object.fromEntries(cols.map((c) => [c.position, c.id]));
  col.porEditar = porPos[0];
  col.revision = porPos[1];
  col.terminado = porPos[2];
  col.publicado = porPos[3];
});

afterAll(async () => {
  const errores: string[] = [];
  if (piezas.length) {
    const { error } = await admin.from("content_pieces").delete().in("id", piezas);
    if (error) errores.push(`content_pieces: ${error.message}`);
  }
  const { error: eC } = await admin.from("content_columns").delete().eq("section", BOARD);
  if (eC) errores.push(`content_columns: ${eC.message}`);
  const { error: eB } = await admin.from("pipeline_boards").delete().eq("id", BOARD);
  if (eB) errores.push(`pipeline_boards: ${eB.message}`);
  await cleanup();
  if (errores.length) throw new Error(`Quedó basura del test 003:\n${errores.join("\n")}`);
});

describe("terminado_at: lo registra el trigger", () => {
  it("RF-01: Por editar → Terminado con la sesión del editor registra el momento", async () => {
    const id = await crearPieza(col.porEditar);
    const antes = Date.now();
    await moverComoEditor(id, col.terminado);
    const { terminado_at } = await leer(id);
    expect(terminado_at).not.toBeNull();
    // Margen por la diferencia de reloj con el server.
    expect(Math.abs(new Date(terminado_at!).getTime() - antes)).toBeLessThan(60_000);
  });

  it("RF-01: también cuando mueve McLovin (service role)", async () => {
    const id = await crearPieza(col.porEditar);
    const { error } = await admin.from("content_pieces").update({ column_id: col.terminado }).eq("id", id);
    if (error) throw error;
    expect((await leer(id)).terminado_at).not.toBeNull();
  });

  it("RF-02, CL-02: volver a una columna anterior lo borra y conserva el responsable", async () => {
    const id = await crearPieza(col.porEditar);
    await moverComoEditor(id, col.terminado);
    await moverComoEditor(id, col.revision);
    const fila = await leer(id);
    expect(fila.terminado_at).toBeNull();
    expect(fila.owner_id).toBe(editor.id);
  });

  it("RF-03: Terminado → Publicado conserva el momento exacto", async () => {
    const id = await crearPieza(col.porEditar);
    await moverComoEditor(id, col.terminado);
    const original = (await leer(id)).terminado_at;
    await pausa(1100);
    await moverComoEditor(id, col.publicado);
    expect((await leer(id)).terminado_at).toBe(original);
  });

  it("CL-01: ida y vuelta deja un solo valor, el último", async () => {
    const id = await crearPieza(col.porEditar);
    await moverComoEditor(id, col.terminado);
    const primero = (await leer(id)).terminado_at!;
    await moverComoEditor(id, col.porEditar);
    await pausa(1100);
    await moverComoEditor(id, col.terminado);
    const ultimo = (await leer(id)).terminado_at!;
    expect(new Date(ultimo).getTime()).toBeGreaterThan(new Date(primero).getTime());
  });

  it("CL-03: Por editar → Publicado de un saque registra", async () => {
    const id = await crearPieza(col.porEditar);
    await moverComoEditor(id, col.publicado);
    expect((await leer(id)).terminado_at).not.toBeNull();
  });

  it("CL-04: nacer en Terminado no cuenta, ni mandando terminado_at", async () => {
    const id1 = await crearPieza(col.terminado);
    expect((await leer(id1)).terminado_at).toBeNull();
    const id2 = await crearPieza(col.terminado, { terminado_at: new Date().toISOString() });
    expect((await leer(id2)).terminado_at).toBeNull();
  });

  it("nadie lo escribe a mano: un update sin cambiar de columna no lo toca", async () => {
    const id = await crearPieza(col.porEditar);
    // Sin terminar: intentar ponérselo.
    const { error: e1 } = await editor.client
      .from("content_pieces")
      .update({ terminado_at: "2026-01-01T12:00:00Z" })
      .eq("id", id);
    expect(e1).toBeNull();
    expect((await leer(id)).terminado_at).toBeNull();

    // Ya terminado: intentar correrlo a otro día, también con service role.
    await moverComoEditor(id, col.terminado);
    const real = (await leer(id)).terminado_at;
    await editor.client.from("content_pieces").update({ terminado_at: "2026-01-01T12:00:00Z" }).eq("id", id);
    await admin.from("content_pieces").update({ terminado_at: "2026-01-01T12:00:00Z", title: "RLS test 003 b" }).eq("id", id);
    expect((await leer(id)).terminado_at).toBe(real);
  });
});

/**
 * Segundo bloque (T08): acceso, vistas y reparto, contra el board `video`
 * REAL (es el único que puede_ver_board abre a los editores). Se usa una sola
 * tarjeta de prueba sin Hero en Por editar, que se borra al final, y la rpc se
 * llama con un día imposible (2099-01-05) para no pisar el reparto de verdad.
 * La rpc solo toca las tarjetas que se le pasan: las del equipo no se rozan.
 */
const POR_EDITAR_VIDEO = "dc307d54-8010-47b9-a546-9978d084b342";
const REVISION_VIDEO = "fee3f550-929c-4876-bad7-9f671399ce55";
const TERMINADO_VIDEO = "91e3aa85-a18c-45f6-8ccd-f34ecb6b771c";
const DIA_DE_PRUEBA = "2099-01-05";

describe("acceso, vistas y reparto (board video real)", () => {
  let editorSolo: TestUser;
  let editorInactivo: TestUser;
  let guionista: TestUser;
  let director: TestUser;
  const tarjetas = { disponible: "", conDueno: "", enTerminado: "", otroBoard: "", paraInactivo: "", paraGuionista: "" };
  const propias: string[] = [];

  async function tarjeta(columnId: string, ownerId: string | null = null): Promise<string> {
    const { data, error } = await admin
      .from("content_pieces")
      .insert({ title: "RLS test 003 video", brand_id: null, column_id: columnId, owner_id: ownerId })
      .select("id")
      .single();
    if (error || !data) throw new Error(`setup tarjeta: ${error?.message}`);
    propias.push(data.id);
    return data.id;
  }

  async function dueno(id: string): Promise<string | null> {
    const { data, error } = await admin.from("content_pieces").select("owner_id").eq("id", id).single();
    if (error || !data) throw new Error(`leer dueño: ${error?.message}`);
    return data.owner_id;
  }

  beforeAll(async () => {
    [editorSolo, editorInactivo, guionista, director] = await Promise.all([
      makeUser("admin"),
      makeUser("admin"),
      makeUser("admin"),
      makeUser("admin"),
    ]);
    // Ninguno es miembro de ningún board: lo que vean, lo ven por la función.
    const { error } = await admin.from("staff_members").insert([
      { profile_id: editorSolo.id, staff_role: "editor", active: true },
      { profile_id: editorInactivo.id, staff_role: "editor", active: false },
      { profile_id: guionista.id, staff_role: "guionista", active: true },
      { profile_id: director.id, staff_role: "director", active: true },
    ]);
    if (error) throw new Error(`setup staff_members: ${error.message}`);

    tarjetas.disponible = await tarjeta(POR_EDITAR_VIDEO);
    tarjetas.conDueno = await tarjeta(POR_EDITAR_VIDEO, director.id);
    tarjetas.enTerminado = await tarjeta(TERMINADO_VIDEO);
    tarjetas.otroBoard = await tarjeta(col.porEditar); // la Por editar del board de prueba
    tarjetas.paraInactivo = await tarjeta(POR_EDITAR_VIDEO);
    tarjetas.paraGuionista = await tarjeta(POR_EDITAR_VIDEO);
  });

  afterAll(async () => {
    const errores: string[] = [];
    if (propias.length) {
      const { error } = await admin.from("content_pieces").delete().in("id", propias);
      if (error) errores.push(`content_pieces: ${error.message}`);
    }
    const { error: eR } = await admin.from("repartos_de_edicion").delete().eq("dia", DIA_DE_PRUEBA);
    if (eR) errores.push(`repartos_de_edicion: ${eR.message}`);
    if (errores.length) throw new Error(`Quedó basura del test 003 (bloque 2):\n${errores.join("\n")}`);
  });

  it("RF-23: el editor activo ve el board video, sus columnas y la tarjeta, sin ser miembro", async () => {
    const { data: boards } = await editorSolo.client.from("pipeline_boards").select("id").eq("id", "video");
    expect(boards).toHaveLength(1);
    const { data: cols } = await editorSolo.client.from("content_columns").select("id").eq("section", "video");
    expect(cols!.length).toBeGreaterThanOrEqual(4);
    const { data: piezas } = await editorSolo.client.from("content_pieces").select("id").eq("id", tarjetas.disponible);
    expect(piezas).toHaveLength(1);
  });

  it("RF-23: y la puede mover", async () => {
    const { data, error } = await editorSolo.client
      .from("content_pieces")
      .update({ column_id: REVISION_VIDEO })
      .eq("id", tarjetas.paraGuionista)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    // De vuelta a Por editar para los casos de la rpc.
    await admin.from("content_pieces").update({ column_id: POR_EDITAR_VIDEO }).eq("id", tarjetas.paraGuionista);
  });

  it("RF-23: no ve otros boards", async () => {
    const { data: boards } = await editorSolo.client.from("pipeline_boards").select("id").eq("id", "it");
    expect(boards).toEqual([]);
    const { data: cols } = await editorSolo.client.from("content_columns").select("id").eq("section", "it");
    expect(cols).toEqual([]);
  });

  it("CL-07: el editor inactivo y el guionista sin membresía no ven nada", async () => {
    for (const u of [editorInactivo, guionista]) {
      const { data: boards } = await u.client.from("pipeline_boards").select("id").eq("id", "video");
      expect(boards).toEqual([]);
      const { data: piezas } = await u.client.from("content_pieces").select("id").eq("id", tarjetas.disponible);
      expect(piezas).toEqual([]);
      const { data: fila } = await u.client.from("videos_por_editar").select("id").eq("id", tarjetas.disponible);
      expect(fila).toEqual([]);
    }
  });

  it("videos_por_editar: la trae para el editor, no para anon, y no trae otro board ni Terminado", async () => {
    const { data } = await editorSolo.client
      .from("videos_por_editar")
      .select("id")
      .in("id", [tarjetas.disponible, tarjetas.enTerminado, tarjetas.otroBoard]);
    expect(data!.map((r) => r.id)).toEqual([tarjetas.disponible]);

    const { data: deAnon } = await anonClient().from("videos_por_editar").select("id").limit(1);
    expect(deAnon ?? []).toEqual([]);
  });

  it("RF-30: videos_esperando_aprobacion responde para el director y no para anon", async () => {
    const { data, error } = await director.client.from("videos_esperando_aprobacion").select("month, videos");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const { data: deAnon } = await anonClient().from("videos_esperando_aprobacion").select("month").limit(1);
    expect(deAnon ?? []).toEqual([]);
  });

  it("repartos_de_edicion: el director la lee, el editor no la lee ni ejecuta la rpc", async () => {
    const { error: eDir } = await director.client.from("repartos_de_edicion").select("dia").limit(1);
    expect(eDir).toBeNull();

    // Fila sembrada para que "no lee" signifique algo y no sea una tabla vacía.
    const { error: eSemilla } = await admin.from("repartos_de_edicion").insert({ dia: DIA_DE_PRUEBA, asignados: 0 });
    if (eSemilla) throw eSemilla;
    const { data: delEditor } = await editorSolo.client.from("repartos_de_edicion").select("dia").eq("dia", DIA_DE_PRUEBA);
    expect(delEditor ?? []).toEqual([]);
    const { data: delDirector } = await director.client.from("repartos_de_edicion").select("dia").eq("dia", DIA_DE_PRUEBA);
    expect(delDirector).toHaveLength(1);
    await admin.from("repartos_de_edicion").delete().eq("dia", DIA_DE_PRUEBA);

    const { error: eRpc } = await editorSolo.client.rpc("aplicar_reparto_de_edicion", {
      p_dia: DIA_DE_PRUEBA,
      p_asignaciones: [{ piece_id: tarjetas.disponible, owner_id: editorSolo.id }],
    });
    expect(eRpc).not.toBeNull();
    expect(await dueno(tarjetas.disponible)).toBeNull();
    const { data: sinFila } = await admin.from("repartos_de_edicion").select("dia").eq("dia", DIA_DE_PRUEBA);
    expect(sinFila).toEqual([]);
  });

  it("RF-08, RF-10, RF-11: la rpc asigna solo lo que corresponde, y una sola vez por día", async () => {
    const pedidas = [
      { piece_id: tarjetas.disponible, owner_id: editorSolo.id },
      { piece_id: tarjetas.conDueno, owner_id: editorSolo.id },
      { piece_id: tarjetas.enTerminado, owner_id: editorSolo.id },
      { piece_id: tarjetas.otroBoard, owner_id: editorSolo.id },
      { piece_id: tarjetas.paraInactivo, owner_id: editorInactivo.id },
      { piece_id: tarjetas.paraGuionista, owner_id: guionista.id },
    ];
    const { data: asignados, error } = await admin.rpc("aplicar_reparto_de_edicion", {
      p_dia: DIA_DE_PRUEBA,
      p_asignaciones: pedidas,
    });
    expect(error).toBeNull();
    expect(asignados).toBe(1);

    expect(await dueno(tarjetas.disponible)).toBe(editorSolo.id);
    expect(await dueno(tarjetas.conDueno)).toBe(director.id);
    expect(await dueno(tarjetas.enTerminado)).toBeNull();
    expect(await dueno(tarjetas.otroBoard)).toBeNull();
    expect(await dueno(tarjetas.paraInactivo)).toBeNull();
    expect(await dueno(tarjetas.paraGuionista)).toBeNull();

    const { data: fila } = await admin.from("repartos_de_edicion").select("asignados, asignaciones").eq("dia", DIA_DE_PRUEBA).single();
    expect(fila!.asignados).toBe(1);
    expect(fila!.asignaciones).toHaveLength(6);

    // Segunda vez el mismo día: 0, y nada cambia.
    const { data: otraVez } = await admin.rpc("aplicar_reparto_de_edicion", {
      p_dia: DIA_DE_PRUEBA,
      p_asignaciones: [{ piece_id: tarjetas.paraInactivo, owner_id: editorSolo.id }],
    });
    expect(otraVez).toBe(0);
    expect(await dueno(tarjetas.paraInactivo)).toBeNull();
  });
});
