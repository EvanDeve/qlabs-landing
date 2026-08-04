/**
 * Deja una URL escrita a mano en algo guardable, o null si no hay nada.
 *
 * Nadie escribe "https://" cuando le piden el sitio web: escribe
 * "cafeteriaelroble.cr". Guardar eso tal cual tiene dos consecuencias feas y
 * las dos aparecieron de verdad:
 *
 * 1. Un <input type="url"> con ese valor deja el formulario inválido para
 *    siempre. El navegador no envía y no dice nada visible, así que "Guardar"
 *    parece un botón roto — le pasó al perfil del negocio.
 * 2. Un link sin esquema en un href se lee como ruta relativa y lleva a
 *    /ugc/marca/cafeteriaelroble.cr en vez de al sitio.
 *
 * Se descartan los esquemas que no son http(s) —javascript:, data:— para no
 * dejar un link ejecutable guardado en la base.
 */
export function normalizarUrl(raw: string | null | undefined): string | null {
  const valor = (raw ?? "").trim();
  if (!valor) return null;
  const conEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(valor) ? valor : `https://${valor}`;
  try {
    const url = new URL(conEsquema);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
