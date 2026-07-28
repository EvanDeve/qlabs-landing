import { describe, it, expect } from "vitest";
import {
  parseSegments,
  normalizeVideoUrl,
  detectSourceType,
  isValidUrl,
  segmentsToPlainText,
  segmentsToTimestampedText,
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
