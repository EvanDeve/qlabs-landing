import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  responderPublico,
  armarCerebroPublico,
  hablaDemasiado,
  MAX_MENSAJES_DIA,
  SOBRE_QLABS_ARRANQUE,
  GUION_ARRANQUE,
  type CerebroPublico,
} from "@/lib/ugc/agente-publico";

// Del otro lado hay alguien que no es del equipo, sin cuenta y sin opt-in. Lo
// que se cuida acá es que el agente no hable cuando no tiene qué decir, que no
// invente un link de agenda, y que un número no pueda hacerlo hablar sin límite.

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

const CEREBRO: CerebroPublico = {
  nombre: "McLovin",
  sobreQlabs: SOBRE_QLABS_ARRANQUE,
  guionPublico: GUION_ARRANQUE,
  linkAgenda: "https://calendly.com/q-labs/30min",
};

const cerebro = (extra: Partial<CerebroPublico> = {}): CerebroPublico => ({ ...CEREBRO, ...extra });

describe("responderPublico", () => {
  const base = { historial: [], mensaje: "hola, hacen páginas web?" };

  // El interruptor prendido no alcanza. Un agente al que no le cargaron nada
  // sobre la agencia y contesta igual improvisa, y lo que improvise queda dicho
  // en nombre de Q Labs.
  it("no contesta si no hay nada cargado sobre Q Labs", async () => {
    expect(await responderPublico({ ...base, cerebro: cerebro({ sobreQlabs: "" }) })).toBeNull();
    expect(await responderPublico({ ...base, cerebro: cerebro({ sobreQlabs: "   \n  " }) })).toBeNull();
  });

  // La persona escribió y está esperando. Quedarse callado porque se cayó
  // Gemini es peor que un "ahorita te contestamos": del otro lado no hay forma
  // de distinguir el silencio de un número muerto.
  it("cae en un respaldo honesto cuando el modelo no responde", async () => {
    const respuesta = await responderPublico({ ...base, cerebro: cerebro() });

    expect(respuesta).not.toBeNull();
    expect(respuesta).toContain("equipo");
    // Lo que NO puede hacer el respaldo es prometer un plazo.
    expect(respuesta?.toLowerCase()).not.toMatch(/minutos?|horas?|mañana|hoy mismo/);
  });
});

// Es lo que el panel muestra como "el cerebro armado", así que lo que se
// verifique acá es exactamente lo que alguien va a leer antes de editarlo.
describe("armarCerebroPublico", () => {
  it("mete el link y le dice qué hacer con él", () => {
    const prompt = armarCerebroPublico(cerebro());

    expect(prompt).toContain("https://calendly.com/q-labs/30min");
    expect(prompt).toContain("UNA vez");
  });

  // El caso que importa: sin link configurado el agente no puede quedar
  // invitando a agendar en un lado que no existe.
  it("sin link, le prohíbe inventar uno", () => {
    const prompt = armarCerebroPublico(cerebro({ linkAgenda: "" }));

    expect(prompt).toContain("No tenés link de agenda");
    expect(prompt).toMatch(/no inventes un link/i);
    expect(prompt).not.toContain("calendly");
  });

  it("incluye siempre las reglas que no se editan", () => {
    const pelado = armarCerebroPublico({ nombre: "X", sobreQlabs: "algo", guionPublico: "", linkAgenda: "" });

    // Que se sepa bot si le preguntan, y que no cotice.
    expect(pelado).toMatch(/asistente autom[áa]tico/i);
    expect(pelado).toMatch(/no cotiz|cotizar/i);
    expect(pelado).toContain("algo");
  });

  it("el guion es opcional y no deja un encabezado huérfano", () => {
    expect(armarCerebroPublico(cerebro({ guionPublico: "" }))).not.toContain("CÓMO LLEVÁS LA CONVERSACIÓN");
    expect(armarCerebroPublico(cerebro())).toContain("CÓMO LLEVÁS LA CONVERSACIÓN");
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

// No son defaults que se apliquen solos —los campos vacíos apagan la función—
// pero son lo que alguien va a pegar de un botón y publicar, así que no pueden
// contener nada que el agente no deba afirmar.
describe("textos de arranque", () => {
  it("no prometen precios ni plazos", () => {
    for (const texto of [SOBRE_QLABS_ARRANQUE, GUION_ARRANQUE]) {
      expect(texto).not.toMatch(/₡|\$|precio de|desde \d|garantiz/i);
    }
  });

  it("el de Q Labs dice qué es y para quién", () => {
    expect(SOBRE_QLABS_ARRANQUE).toMatch(/Costa Rica/i);
    expect(SOBRE_QLABS_ARRANQUE).toMatch(/restaurante/i);
    expect(SOBRE_QLABS_ARRANQUE).toMatch(/hotel/i);
  });

  it("el guion lleva a la reunión y frena la insistencia", () => {
    expect(GUION_ARRANQUE).toMatch(/reuni[óo]n/i);
    expect(GUION_ARRANQUE).toMatch(/no insistas/i);
  });
});
