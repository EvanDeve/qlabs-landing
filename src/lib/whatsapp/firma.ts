import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida la cabecera X-Twilio-Signature de un webhook entrante.
 *
 * Este es EL límite de seguridad del agente conversacional. El webhook mueve
 * piezas del pipeline según lo que dice un WhatsApp; sin verificar la firma,
 * cualquiera que adivine la URL puede hacerse pasar por un miembro del equipo
 * —basta con mandar `From=whatsapp:+506...`— y reprogramar o cerrar lo que
 * quiera. No hay sesión ni cookie que lo frene: la firma es lo único.
 *
 * El algoritmo lo define Twilio: HMAC-SHA1, con el auth token como clave, sobre
 * la URL completa seguida de los pares clave+valor del POST ordenados por
 * clave, concatenados sin separador.
 */
export function firmaValida(opciones: {
  url: string;
  params: Record<string, string>;
  firma: string | null;
  authToken: string;
}): boolean {
  const { url, params, firma, authToken } = opciones;
  if (!firma) return false;

  const cadena = Object.keys(params)
    .sort()
    .reduce((acc, clave) => acc + clave + params[clave], url);

  const esperada = createHmac("sha1", authToken).update(Buffer.from(cadena, "utf-8")).digest("base64");

  // Comparación de tiempo constante: comparar con === filtra el secreto por el
  // tiempo que tarda en cortar, y acá el atacante puede reintentar sin límite.
  const a = Buffer.from(esperada);
  const b = Buffer.from(firma);
  return a.length === b.length && timingSafeEqual(a, b);
}
