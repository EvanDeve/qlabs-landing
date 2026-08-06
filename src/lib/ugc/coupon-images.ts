export const COUPON_IMAGE_BUCKET = "coupon-images";

/**
 * 5 MB. Es una foto de plato o de local sacada con el celular, no una entrega
 * de video: por arriba de esto lo único que se gana es que el feed del creador
 * tarde más en cargar.
 *
 * La subida va DIRECTA del navegador a Storage (`subirArchivoDirecto`), así que
 * este tope no choca con el límite de ~4.5 MB que tienen los Server Actions en
 * Vercel — el archivo nunca pasa por ahí.
 */
export const MAX_COUPON_IMAGE_BYTES = 5 * 1024 * 1024;
