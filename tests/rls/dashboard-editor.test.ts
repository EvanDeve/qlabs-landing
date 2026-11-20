import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { admin, makeUser, cleanup, type TestUser } from "./helpers";

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
