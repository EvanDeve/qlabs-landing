import { describe, expect, it } from "vitest";
import { extraerCodigo } from "@/components/ugc/marca/EscanearQR";

/**
 * Lo que el escáner recibe NO es el código: el QR del creador codifica la URL
 * absoluta de validación. Si esta traducción se rompe, el botón de la cámara
 * "funciona" —lee el QR— y la búsqueda contesta "no encontramos ese código",
 * que es el peor de los dos fallos posibles: parece un problema del cupón.
 */
describe("extraerCodigo", () => {
  it("saca el código de la URL de validación", () => {
    expect(extraerCodigo("https://www.qlabsmethod.com/ugc/marca/validar/QL-7F3K-2A")).toBe(
      "QL-7F3K-2A"
    );
  });

  it("ignora el host: un QR emitido en producción se lee en local", () => {
    expect(extraerCodigo("http://localhost:3000/ugc/marca/validar/QL-7F3K-2A")).toBe("QL-7F3K-2A");
    expect(extraerCodigo("https://q-labs-landing.vercel.app/ugc/marca/validar/QL-7F3K-2A")).toBe(
      "QL-7F3K-2A"
    );
  });

  it("descarta lo que sobra después del código", () => {
    expect(extraerCodigo("https://qlabsmethod.com/ugc/marca/validar/QL-7F3K-2A?utm=x")).toBe(
      "QL-7F3K-2A"
    );
    expect(extraerCodigo("https://qlabsmethod.com/ugc/marca/validar/QL-7F3K-2A#top")).toBe(
      "QL-7F3K-2A"
    );
  });

  it("acepta un QR que traiga el código pelado", () => {
    expect(extraerCodigo("QL-7F3K-2A")).toBe("QL-7F3K-2A");
    expect(extraerCodigo("  ql-7f3k-2a  ")).toBe("QL-7F3K-2A");
  });

  it("rechaza un QR que no es de un cupón", () => {
    expect(extraerCodigo("https://instagram.com/vale.creates")).toBeNull();
    expect(extraerCodigo("WIFI:S:LaCasa;T:WPA;P:1234;;")).toBeNull();
    expect(extraerCodigo("")).toBeNull();
  });

  it("no confunde otra pantalla del panel con un código", () => {
    expect(extraerCodigo("https://qlabsmethod.com/ugc/marca/loyalty")).toBeNull();
  });
});
