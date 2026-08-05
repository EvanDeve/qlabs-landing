import { describe, it, expect } from "vitest";
import {
  MAX_VOICEOVER_CHARS,
  MODELOS_DE_VOZ,
  VozError,
  creditosDe,
  diasParaVencer,
  limpiarGuionParaVoz,
  mensajeDeErrorDeVoz,
  modeloDeVoz,
  motivoDeRechazo,
  tituloDeGuion,
} from "@/lib/ugc/voz";

describe("motivoDeRechazo", () => {
  it("rechaza el texto vacío o solo con espacios", () => {
    expect(motivoDeRechazo("")).toBeTruthy();
    expect(motivoDeRechazo("   \n  ")).toBeTruthy();
  });

  it("acepta un guion normal", () => {
    expect(motivoDeRechazo("Probá el brunch de domingo en Zonna.")).toBeNull();
  });

  it("rechaza pasado el tope y dice cuánto se pasó", () => {
    const motivo = motivoDeRechazo("a".repeat(MAX_VOICEOVER_CHARS + 1));
    // Sin separador de miles: `toLocaleString("es-CR")` devuelve "5 001" con un
    // espacio raro y cambia según el ICU del runtime.
    expect(motivo).toContain("5001");
  });

  it("mide después de recortar: los espacios de sobra no gastan créditos", () => {
    expect(motivoDeRechazo(`   ${"a".repeat(MAX_VOICEOVER_CHARS)}   `)).toBeNull();
  });
});

describe("creditosDe", () => {
  it("cobra un crédito por carácter en el modelo de calidad", () => {
    expect(creditosDe("hola", "eleven_multilingual_v2")).toBe(4);
  });

  it("cobra la mitad en Flash", () => {
    expect(creditosDe("a".repeat(100), "eleven_flash_v2_5")).toBe(50);
  });

  it("redondea para arriba: ElevenLabs no cobra medio crédito", () => {
    expect(creditosDe("abc", "eleven_flash_v2_5")).toBe(2);
  });

  it("asume el precio caro si el modelo no se reconoce", () => {
    // Vale más quedar corto en la estimación que prometer barato y cobrar caro.
    expect(creditosDe("hola", "modelo_inventado")).toBe(4);
  });
});

describe("modeloDeVoz", () => {
  it("encuentra los modelos que se ofrecen", () => {
    for (const m of MODELOS_DE_VOZ) {
      expect(modeloDeVoz(m.id)?.nombre).toBe(m.nombre);
    }
  });

  it("devuelve undefined con un id desconocido", () => {
    expect(modeloDeVoz("eleven_v3")).toBeUndefined();
  });
});

describe("tituloDeGuion", () => {
  it("deja pasar un texto corto tal cual", () => {
    expect(tituloDeGuion("Reel de brunch")).toBe("Reel de brunch");
  });

  it("colapsa los saltos de línea: el título va en una sola línea", () => {
    expect(tituloDeGuion("Hola\n\n   mundo")).toBe("Hola mundo");
  });

  it("recorta el guion largo con puntos suspensivos", () => {
    const t = tituloDeGuion("a".repeat(80));
    expect(t).toHaveLength(43);
    expect(t.endsWith("…")).toBe(true);
  });

  it("no deja el título vacío", () => {
    expect(tituloDeGuion("   ")).toBe("sin texto");
  });
});

describe("limpiarGuionParaVoz", () => {
  // Todos estos casos salen de los guiones reales del equipo: sin limpiarlos,
  // ElevenLabs lee "cero cero, a cámara, mirada intensa" en voz alta y lo cobra.
  it("saca los tiempos", () => {
    expect(limpiarGuionParaVoz("[0:00] Hola\n[0:03] Chao")).toBe("Hola\nChao");
  });

  it("saca las acotaciones de cámara", () => {
    expect(limpiarGuionParaVoz("(A cámara, mirada intensa) ¿Sabés cuántas reservas perdés?")).toBe(
      "¿Sabés cuántas reservas perdés?"
    );
  });

  it("saca los títulos en markdown y el énfasis con asteriscos", () => {
    expect(limpiarGuionParaVoz("## GUION MEJORADO — FOODSY\n\nReservas *mientras dormís*")).toBe(
      "Reservas mientras dormís"
    );
  });

  it("saca el preámbulo del modelo cuando viene antes de un título", () => {
    const r = limpiarGuionParaVoz("Acá tenés el guion mejorado para Publifier:\n\n## GUION\n\n[0:00] Hola");
    expect(r).toBe("Hola");
  });

  it("NO se come una primera frase que solo termina en dos puntos", () => {
    // Sin el requisito de que lo siguiente sea un título o un tiempo, esto
    // perdería la línea de apertura del guion.
    const r = limpiarGuionParaVoz("Te lo digo así de simple:\nreservá hoy.");
    expect(r).toBe("Te lo digo así de simple:\nreservá hoy.");
  });

  it("corta la sección de análisis del final", () => {
    // El prompt del coach le pide al modelo esta sección (script-coach.ts), así
    // que está en TODOS los guiones. Es más de la mitad del archivo y es
    // análisis para el creador, no texto para locutar.
    const r = limpiarGuionParaVoz(
      "[0:00] Vení a probarlo.\n\n---\n\n## Qué cambié y por qué\n\n1. **GANCHO:** Cambié la afirmación por una pregunta."
    );
    expect(r).toBe("Vení a probarlo.");
  });

  it("no deja la raya colgando cuando corta el análisis", () => {
    const r = limpiarGuionParaVoz("Cerrá hoy.\n\n---\n\n## Qué cambié y por qué\n\n1. Algo.");
    expect(r).toBe("Cerrá hoy.");
  });

  it("saca las rayas sueltas de separación", () => {
    expect(limpiarGuionParaVoz("Primera parte.\n\n---\n\nSegunda parte.")).toBe(
      "Primera parte.\n\nSegunda parte."
    );
  });

  it("saca el preámbulo cuando lo sigue una raya y no un título", () => {
    // Caso real: "Aquí tenés el guion mejorado, listo para grabarse:\n\n---\n\nTu
    // restaurante…". Sin contemplar la raya, el preámbulo se locutaba.
    const r = limpiarGuionParaVoz(
      "Aquí tenés el guion mejorado, listo para grabarse:\n\n---\n\nTu restaurante pierde clientes."
    );
    expect(r).toBe("Tu restaurante pierde clientes.");
  });

  it("deja intacto un texto que ya es solo habla", () => {
    const plano = "Domingo de brunch en Zonna. Reservá tu mesa.";
    expect(limpiarGuionParaVoz(plano)).toBe(plano);
  });

  it("no deja líneas en blanco de más donde había acotaciones", () => {
    const r = limpiarGuionParaVoz("[0:00] (Plano del local)\n\n\n\n[0:05] Vení a probarlo.");
    expect(r).toBe("Vení a probarlo.");
  });
});

describe("diasParaVencer", () => {
  const ahora = new Date("2026-08-05T12:00:00Z");

  it("cuenta los días que faltan", () => {
    expect(diasParaVencer("2026-08-08T12:00:00Z", ahora)).toBe(3);
  });

  it("redondea para arriba: quedan 'X días' hasta el último momento", () => {
    expect(diasParaVencer("2026-08-05T23:00:00Z", ahora)).toBe(1);
  });

  it("nunca da negativo", () => {
    expect(diasParaVencer("2026-08-01T12:00:00Z", ahora)).toBe(0);
  });
});

describe("mensajeDeErrorDeVoz", () => {
  it("distingue la key vencida", () => {
    const m = mensajeDeErrorDeVoz(new VozError("nope", { status: 401 }));
    expect(m).toContain("API key");
  });

  it("distingue la cuota agotada, que es el error que más va a pasar", () => {
    const m = mensajeDeErrorDeVoz(new VozError("nope", { status: 429, codigo: "quota_exceeded" }));
    expect(m).toContain("créditos");
  });

  it("el código de cuota le gana al status 401", () => {
    // ElevenLabs manda 401 con status quota_exceeded en algunos planes: sin
    // mirar el código, esto se leería como "la key no sirve" y mandaría a
    // renovar una key que está perfecta.
    const m = mensajeDeErrorDeVoz(new VozError("nope", { status: 401, codigo: "quota_exceeded" }));
    expect(m).toContain("créditos");
  });

  it("distingue la voz borrada", () => {
    expect(mensajeDeErrorDeVoz(new VozError("nope", { status: 404 }))).toContain("voz");
  });

  it("traduce el timeout", () => {
    expect(mensajeDeErrorDeVoz(new Error("The operation was aborted"))).toContain("tardó demasiado");
  });

  it("cae en un mensaje genérico accionable con lo desconocido", () => {
    const m = mensajeDeErrorDeVoz(new Error("boom"));
    expect(m).toContain("Probá de nuevo");
    // Nunca se filtra el error crudo del proveedor: viene en inglés y no dice
    // qué hacer.
    expect(m).not.toContain("boom");
  });
});
