import { describe, it, expect } from "vitest";
import { parsearGuion, nombreDeArchivoDeGuion } from "@/lib/ugc/guion";

/**
 * La muestra es EXACTAMENTE el ejemplo que el prompt le da al modelo
 * (`construirPromptDeGuion` en script-coach.ts). Si alguien toca el formato de
 * un lado sin tocar el otro, estos tests son los que lo cuentan.
 */
const GUION = `FORMATO: Reel · 30 s
TONO: Cercano

[GANCHO 0-3 s]
"El mejor brunch de Escalante no es el que sale en todas las listas."

[CUERPO 3-22 s]
Huevos benedictinos sobre masa madre, café de Tarrazú, y todo el frente ventanal.
Sentate del lado de la ventana: la luz hace el trabajo por vos.

[CIERRE 22-30 s]
"Guardate este si te gusta desayunar sin apuro. ¿A quién llevás?"

TOMAS QUE TE FALTAN
- Detalle del corte del huevo, en cámara lenta
- Plano del ventanal con la mesa servida
- Vos hablando a cámara para el gancho`;

describe("parsearGuion", () => {
  it("parte el guion del prompt en sus tres bloques", () => {
    const r = parsearGuion(GUION);

    expect(r.estructurado).toBe(true);
    expect(r.bloques.map((b) => b.fase)).toEqual(["GANCHO", "CUERPO", "CIERRE"]);
    expect(r.bloques.map((b) => b.rango)).toEqual(["0-3 s", "3-22 s", "22-30 s"]);
    expect(r.bloques[0].texto).toBe(
      '"El mejor brunch de Escalante no es el que sale en todas las listas."'
    );
  });

  it("conserva los saltos de línea de adentro de un bloque", () => {
    // Separan lo que se dice de lo que se muestra mientras se dice: unirlos en
    // un párrafo cambia el guion.
    const r = parsearGuion(GUION);
    expect(r.bloques[1].texto.split("\n")).toHaveLength(2);
  });

  it("saca los chips de la cabecera y arma la frase del tono", () => {
    const r = parsearGuion(GUION);
    expect(r.formato).toBe("Reel · 30 s");
    // El modelo devuelve "Cercano" y el chip dice "Tono cercano": la palabra
    // sola no se entiende en 90px.
    expect(r.tono).toBe("Tono cercano");
  });

  it("no repite la palabra tono si el modelo ya la escribió", () => {
    const r = parsearGuion("TONO: Tono directo\n\n[GANCHO 0-2 s]\nHola");
    expect(r.tono).toBe("Tono directo");
  });

  it("junta las tomas que faltan", () => {
    const r = parsearGuion(GUION);
    expect(r.tomas).toEqual([
      "Detalle del corte del huevo, en cámara lenta",
      "Plano del ventanal con la mesa servida",
      "Vos hablando a cámara para el gancho",
    ]);
  });

  it("no mete la cabecera ni las tomas adentro de los bloques", () => {
    const r = parsearGuion(GUION);
    for (const b of r.bloques) {
      expect(b.texto).not.toContain("FORMATO");
      expect(b.texto).not.toContain("TOMAS QUE TE FALTAN");
    }
    // Y no queda nada suelto: todo cayó en su lugar.
    expect(r.texto).toBe("");
  });

  it("acepta viñetas con punto y con asterisco", () => {
    const r = parsearGuion("[GANCHO 0-2 s]\nHola\n\nTOMAS QUE TE FALTAN\n• Una\n* Dos");
    expect(r.tomas).toEqual(["Una", "Dos"]);
  });

  it("cierra la lista de tomas cuando el modelo sigue escribiendo", () => {
    // Un párrafo entero metido como si fuera una toma deja la lista ilegible.
    const r = parsearGuion(
      "[GANCHO 0-2 s]\nHola\n\nTOMAS QUE TE FALTAN\n- Una\nEsto ya es otra cosa que escribió de más."
    );
    expect(r.tomas).toEqual(["Una"]);
    expect(r.texto).toContain("otra cosa");
  });

  it("dibuja un bloque aunque le falte el rango de tiempo", () => {
    const r = parsearGuion("[GANCHO]\nArrancá fuerte");
    expect(r.estructurado).toBe(true);
    expect(r.bloques[0]).toEqual({ fase: "GANCHO", rango: null, texto: "Arrancá fuerte" });
  });

  it("descarta un encabezado que quedó sin texto debajo", () => {
    const r = parsearGuion("[GANCHO 0-3 s]\n\n[CUERPO 3-20 s]\nAcá sí hay algo");
    expect(r.bloques.map((b) => b.fase)).toEqual(["CUERPO"]);
  });

  it("cae a texto plano con un guion del formato viejo", () => {
    // Las filas generadas antes de este cambio: marcas [M:SS] sueltas y una
    // sección con almohadillas. No parsean a bloques y NO se pierden.
    const viejo = `[0:00] (a cámara) Buenas, hoy vengo a La Ceiba.
[0:08] Pedí los huevos benedictinos.

## Qué cambié y por qué
- Le puse un Pattern Interrupt al inicio.`;
    const r = parsearGuion(viejo);

    expect(r.estructurado).toBe(false);
    expect(r.bloques).toEqual([]);
    expect(r.texto).toContain("Buenas, hoy vengo a La Ceiba");
    expect(r.texto).toContain("Pattern Interrupt");
  });

  it("no confunde una marca de tiempo con un encabezado de fase", () => {
    // `[0:08]` entra por el mismo corchete que `[GANCHO 0-3 s]`: si el regex de
    // la fase aceptara dígitos, cada línea del guion viejo sería un bloque.
    const r = parsearGuion("[0:08] Pedí los huevos benedictinos.");
    expect(r.estructurado).toBe(false);
  });

  it("devuelve todo vacío sin romperse con null", () => {
    const r = parsearGuion(null);
    expect(r).toEqual({
      formato: null,
      tono: null,
      bloques: [],
      tomas: [],
      texto: "",
      estructurado: false,
    });
  });
});

describe("nombreDeArchivoDeGuion", () => {
  it("saca acentos y espacios", () => {
    expect(nombreDeArchivoDeGuion("Reel del brunch dominical")).toBe(
      "guion-reel-del-brunch-dominical.txt"
    );
    expect(nombreDeArchivoDeGuion("Cómo grabo un reel")).toBe("guion-como-grabo-un-reel.txt");
  });

  it("no deja un nombre vacío", () => {
    expect(nombreDeArchivoDeGuion("···")).toBe("guion-sin-titulo.txt");
  });
});
