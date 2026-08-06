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

/**
 * De la URL pública guardada en `coupons.image_url` a la ruta dentro del
 * bucket, que es lo que Storage pide para borrar.
 *
 * Existe porque la columna guarda la URL completa —así la pantalla la usa
 * directo, sin firmar nada— y para borrar el archivo hace falta el camino
 * relativo. Devuelve null ante cualquier cosa que no sea una URL de este
 * bucket: una imagen puesta a mano apuntando a otro lado no se toca.
 */
export function rutaDeImagen(url: string | null | undefined): string | null {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${COUPON_IMAGE_BUCKET}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  const ruta = url.slice(i + marca.length).split("?")[0];
  return ruta || null;
}
