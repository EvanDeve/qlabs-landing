import { describe, it, expect } from "vitest";
import {
  parseSegments,
  parseCabecera,
  normalizeVideoUrl,
  detectSourceType,
  isValidUrl,
  segmentsToPlainText,
  segmentsToTimestampedText,
  contarPalabras,
  duracionLegible,
  idiomaLegible,
  nombreDeTranscripcion,
  fuenteLegible,
} from "@/lib/ugc/transcription";

describe("parseSegments", () => {
  it("parsea el formato compacto", () => {
    const r = parseSegments("[0:00] Hola a todos [0:05] Hoy vamos a cocinar");
    expect(r).toEqual([
      { timestamp: "0:00", text: "Hola a todos" },
      { timestamp: "0:05", text: "Hoy vamos a cocinar" },
    ]);
  });

  it("tolera espacios dentro de los corchetes", () => {
    // Caso real: Gemini devolvió "[ 0:00 ]" en una llamada de verdad y el
    // parser viejo no reconocía ni un segmento.
    const r = parseSegments("[ 0:00 ] Acá estamos [ 0:13 ] con los elefantes");
    expect(r).toEqual([
      { timestamp: "0:00", text: "Acá estamos" },
      { timestamp: "0:13", text: "con los elefantes" },
    ]);
  });

  it("parsea saltos de línea entre segmentos", () => {
    const r = parseSegments("[0:00] Primera línea\n[1:20] Segunda línea");
    expect(r).toHaveLength(2);
    expect(r[1]).toEqual({ timestamp: "1:20", text: "Segunda línea" });
  });

  it("guarda el texto como un solo bloque si no hay marcas de tiempo", () => {
    const r = parseSegments("Una transcripción sin timestamps");
    expect(r).toEqual([{ timestamp: "0:00", text: "Una transcripción sin timestamps" }]);
  });

  it("devuelve vacío con texto vacío en vez de un segmento fantasma", () => {
    expect(parseSegments("   ")).toEqual([]);
  });

  it("soporta minutos de más de dos dígitos", () => {
    const r = parseSegments("[12:05] Ya casi terminamos");
    expect(r[0].timestamp).toBe("12:05");
  });
});

describe("normalizeVideoUrl", () => {
  it("convierte el link corto de compartir", () => {
    expect(normalizeVideoUrl("https://youtu.be/jNQXAC9IVRw")).toContain("watch?v=jNQXAC9IVRw");
  });

  it("convierte Shorts, que es de donde sale el contenido vertical", () => {
    expect(normalizeVideoUrl("https://youtube.com/shorts/abc123")).toContain("watch?v=abc123");
  });

  it("le agrega el protocolo si falta", () => {
    expect(normalizeVideoUrl("youtube.com/watch?v=x")).toMatch(/^https:\/\//);
  });

  it("deja intacta una URL que ya está bien", () => {
    const u = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
    expect(normalizeVideoUrl(u)).toBe(u);
  });
});

describe("detectSourceType", () => {
  it("reconoce cada plataforma", () => {
    expect(detectSourceType("https://youtu.be/x")).toBe("youtube");
    expect(detectSourceType("https://www.instagram.com/reel/x")).toBe("instagram");
    expect(detectSourceType("https://www.tiktok.com/@a/video/1")).toBe("tiktok");
    expect(detectSourceType("https://ejemplo.com/v.mp4")).toBe("otro");
  });
});

describe("isValidUrl", () => {
  it("acepta links con y sin protocolo", () => {
    expect(isValidUrl("https://youtube.com/watch?v=x")).toBe(true);
    expect(isValidUrl("youtube.com/watch?v=x")).toBe(true);
  });

  it("rechaza texto suelto, para no gastar una llamada a la API al pedo", () => {
    expect(isValidUrl("hola como estas")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("salidas para copiar", () => {
  const segs = [
    { timestamp: "0:00", text: "Hola" },
    { timestamp: "0:05", text: "Chau" },
  ];

  it("texto plano: solo lo hablado", () => {
    expect(segmentsToPlainText(segs)).toBe("Hola Chau");
  });

  it("con tiempos: una línea por segmento", () => {
    expect(segmentsToTimestampedText(segs)).toBe("[0:00] Hola\n[0:05] Chau");
  });
});


describe("parseCabecera", () => {
  it("saca el título y el idioma, y deja la transcripción limpia", () => {
    const r = parseCabecera("TITULO: Brunch en La Ceiba\nIDIOMA: es\n\n[0:00] Buenas, hoy vengo.");
    expect(r.title).toBe("Brunch en La Ceiba");
    expect(r.language).toBe("es");
    expect(r.cuerpo).toBe("[0:00] Buenas, hoy vengo.");
  });

  it("saca las comillas que el modelo agrega solo", () => {
    expect(parseCabecera('TITULO: "Brunch dominical"').title).toBe("Brunch dominical");
  });

  it("devuelve el texto entero cuando el modelo se olvidó de la cabecera", () => {
    // Es lo que hace que un olvido del título no cueste la transcripción.
    const r = parseCabecera("[0:00] Buenas, hoy vengo.");
    expect(r.title).toBeNull();
    expect(r.language).toBeNull();
    expect(r.cuerpo).toBe("[0:00] Buenas, hoy vengo.");
  });

  it("no deja la cabecera adentro de un audio sin marcas de tiempo", () => {
    // Sin marcas, parseSegments guarda TODO como un bloque único: si la
    // cabecera no se saca antes, el creador ve "TITULO:" en su transcripción.
    const { cuerpo } = parseCabecera("TITULO: Algo\nIDIOMA: en\n\nHello, welcome back.");
    expect(parseSegments(cuerpo)).toEqual([{ timestamp: "0:00", text: "Hello, welcome back." }]);
  });
});

describe("contarPalabras", () => {
  it("suma las palabras de todos los segmentos", () => {
    expect(
      contarPalabras([
        { timestamp: "0:00", text: "Hola a todos" },
        { timestamp: "0:05", text: "hoy cocinamos" },
      ])
    ).toBe(5);
  });

  it("no cuenta los espacios de más", () => {
    expect(contarPalabras([{ timestamp: "0:00", text: "  dos   palabras  " }])).toBe(2);
  });

  it("devuelve cero sin segmentos", () => {
    expect(contarPalabras(null)).toBe(0);
    expect(contarPalabras([])).toBe(0);
  });
});

describe("duracionLegible", () => {
  it("formatea con el segundo en dos dígitos", () => {
    expect(duracionLegible(134)).toBe("2:14");
    expect(duracionLegible(48)).toBe("0:48");
    expect(duracionLegible(242)).toBe("4:02");
  });

  it("no inventa nada cuando no se pudo medir", () => {
    // Es el caso de toda transcripción que vino de un link: el chip no se
    // dibuja en vez de mostrar un cero.
    expect(duracionLegible(null)).toBeNull();
    expect(duracionLegible(0)).toBeNull();
    expect(duracionLegible(Infinity)).toBeNull();
  });
});

describe("idiomaLegible", () => {
  it("nombra los idiomas que conoce", () => {
    expect(idiomaLegible("es")).toBe("Español");
    expect(idiomaLegible("EN")).toBe("Inglés");
  });

  it("muestra el código en mayúsculas si no lo conoce", () => {
    expect(idiomaLegible("ko")).toBe("KO");
  });

  it("devuelve null sin idioma", () => {
    expect(idiomaLegible(null)).toBeNull();
  });
});

describe("nombreDeTranscripcion", () => {
  it("prefiere el título", () => {
    expect(
      nombreDeTranscripcion({ title: "Reel del brunch", file_name: "IMG_0042.mp4" })
    ).toBe("Reel del brunch");
  });

  it("cae al nombre del archivo sin título", () => {
    expect(nombreDeTranscripcion({ title: null, file_name: "foodsy_v1.mp4" })).toBe(
      "foodsy_v1.mp4"
    );
  });

  it("cae al link sin título ni archivo", () => {
    expect(
      nombreDeTranscripcion({ source_url: "https://www.youtube.com/watch?v=abc" })
    ).toBe("youtube.com/watch");
  });

  it("nunca queda vacío", () => {
    expect(nombreDeTranscripcion({})).toBe("Sin nombre");
    expect(nombreDeTranscripcion({ title: "   " })).toBe("Sin nombre");
  });
});

describe("fuenteLegible", () => {
  it("nombra de dónde salió", () => {
    expect(fuenteLegible("upload")).toBe("Archivo");
    expect(fuenteLegible("youtube")).toBe("YouTube");
    expect(fuenteLegible("otro")).toBe("Link");
  });
});
