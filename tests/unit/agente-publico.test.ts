import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { responderPublico, hablaDemasiado, MAX_MENSAJES_DIA, SOBRE_QLABS_ARRANQUE } from "@/lib/ugc/agente-publico";

// Del otro lado hay alguien que no es del equipo, sin cuenta y sin opt-in. Lo
// que se cuida acá es que el agente no hable cuando no tiene qué decir y que un
// número no pueda hacerlo hablar sin límite.

const guardado = process.env.GEMINI_API_KEY;

beforeEach(() => {
  // Sin key, pedirleAGemini() devuelve null y se ejerce el camino de respaldo
  // sin salir a la red. Se borra explícitamente para que el test no dependa de
  // cómo esté el ambiente de quien lo corra.
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  if (guardado === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = guardado;
});

describe("responderPublico", () => {
  const base = { nombre: "McLovin", historial: [], mensaje: "hola, hacen páginas web?" };

  // El interruptor prendido no alcanza. Un agente al que no le cargaron nada
  // sobre la agencia y contesta igual improvisa, y lo que improvise queda dicho
  // en nombre de Q Labs.
  it("no contesta si no hay nada cargado sobre Q Labs", async () => {
    expect(await responderPublico({ ...base, sobreQlabs: "" })).toBeNull();
    expect(await responderPublico({ ...base, sobreQlabs: "   \n  " })).toBeNull();
  });

  // La persona escribió y está esperando. Quedarse callado porque se cayó
  // Gemini es peor que un "ahorita te contestamos": del otro lado no hay forma
  // de distinguir el silencio de un número muerto.
  it("cae en un respaldo honesto cuando el modelo no responde", async () => {
    const respuesta = await responderPublico({ ...base, sobreQlabs: SOBRE_QLABS_ARRANQUE });

    expect(respuesta).not.toBeNull();
    expect(respuesta).toContain("equipo");
    // Lo que NO puede hacer el respaldo es prometer un plazo.
    expect(respuesta?.toLowerCase()).not.toMatch(/minutos?|horas?|mañana|hoy mismo/);
  });
});

describe("hablaDemasiado", () => {
  it("deja pasar el uso normal", () => {
    expect(hablaDemasiado(0)).toBe(false);
    expect(hablaDemasiado(1)).toBe(false);
    expect(hablaDemasiado(MAX_MENSAJES_DIA)).toBe(false);
  });

  // Cada mensaje cuesta un llamado a Gemini y uno a Twilio, y del otro lado no
  // hay cuenta que suspender: el tope es lo único que corta a alguien probando
  // el bot un rato largo.
  it("corta pasado el tope diario", () => {
    expect(hablaDemasiado(MAX_MENSAJES_DIA + 1)).toBe(true);
    expect(hablaDemasiado(500)).toBe(true);
  });
});

// No es un default que se aplique solo —el campo vacío significa "no contestes"—
// pero es lo que alguien va a pegar y publicar de un botón, así que no puede
// contener nada que el agente no deba afirmar.
describe("SOBRE_QLABS_ARRANQUE", () => {
  it("no promete precios ni plazos", () => {
    expect(SOBRE_QLABS_ARRANQUE).not.toMatch(/₡|\$|precio|desde \d|garantiz/i);
  });

  it("dice qué es Q Labs y para quién", () => {
    expect(SOBRE_QLABS_ARRANQUE).toMatch(/Costa Rica/i);
    expect(SOBRE_QLABS_ARRANQUE).toMatch(/restaurante/i);
    expect(SOBRE_QLABS_ARRANQUE).toMatch(/hotel/i);
  });
});
