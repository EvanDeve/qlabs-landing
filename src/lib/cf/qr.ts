import QRCode from "qrcode";

/**
 * El QR que la marca muestra en su local: abre la página del cupón en
 * Close Friends (`/cf/unirme/<código>`). Absoluto, porque lo lee la cámara de
 * un teléfono que no sabe desde qué sitio se generó.
 */
export function urlUnirme(codigo: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.qlabsmethod.com";
  return `${base.replace(/\/$/, "")}/cf/unirme/${codigo}`;
}

// Corrección "Q" (25 %) y no "M" como el QR de canje: este se imprime y se pega
// en mesas y cajas, donde se raya, se moja y le da el sol.
const OPCIONES = { errorCorrectionLevel: "Q" as const, margin: 3, color: { dark: "#0a0b10", light: "#ffffff" } };

export function qrUnirmeSvg(codigo: string): Promise<string> {
  return QRCode.toString(urlUnirme(codigo), { ...OPCIONES, type: "svg", width: 240 });
}

/** PNG grande para imprimir: 1200 px aguanta un afiche sin pixelarse. */
export function qrUnirmePng(codigo: string): Promise<Buffer> {
  return QRCode.toBuffer(urlUnirme(codigo), { ...OPCIONES, type: "png", width: 1200 });
}
