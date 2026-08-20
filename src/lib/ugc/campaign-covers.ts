export const CAMPAIGN_COVER_BUCKET = "campaign-covers";

/**
 * 5 MB, el mismo tope que la foto del cupón. Es una foto del plato o del local
 * sacada con el celular: por arriba de esto lo único que se gana es que el feed
 * del creador —que se abre con datos móviles— tarde más en cargar.
 *
 * La subida va DIRECTA del navegador a Storage (`subirArchivoDirecto`), así que
 * no choca con el tope de ~4.5 MB de los Server Actions en Vercel: el archivo
 * nunca pasa por ahí.
 */
export const MAX_CAMPAIGN_COVER_BYTES = 5 * 1024 * 1024;

/**
 * De la URL pública guardada en `campaigns.cover_url` a la ruta dentro del
 * bucket, que es lo que Storage pide para borrar.
 *
 * Devuelve null ante cualquier cosa que no sea una URL de este bucket: una
 * portada apuntada a mano a otro lado no se toca.
 */
export function rutaDePortada(url: string | null | undefined): string | null {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${CAMPAIGN_COVER_BUCKET}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  const ruta = url.slice(i + marca.length).split("?")[0];
  return ruta || null;
}

/**
 * La portada se guarda como URL pública completa, así que el servidor tiene que
 * poder distinguir "la subió esta marca por el formulario" de un string
 * cualquiera metido en el FormData. Sin esto, `cover_url` es un campo de texto
 * libre que termina renderizado como <img src> en el feed de todos.
 */
export function esUrlDePortada(url: string): boolean {
  return rutaDePortada(url) !== null;
}
