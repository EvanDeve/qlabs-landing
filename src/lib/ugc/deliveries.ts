export const DELIVERIES_BUCKET = "deliveries";

/**
 * Tope de la entrega del creador.
 *
 * Eran 200 MB, un número que nunca fue alcanzable: el proyecto Supabase está
 * en plan gratis y Storage corta en 50 MB pase lo que pase (medido contra el
 * proyecto en vivo — 49 MB entra, 55 MB devuelve 413). Prometer 200 MB solo
 * servía para que el creador perdiera la subida al final.
 *
 * Para un video que no entre acá está el campo de link: se sube a Drive o
 * WeTransfer y se pega la URL. Si algún día el proyecto pasa a Supabase Pro,
 * el techo sube a 50 GB y este número se puede volver a mover.
 */
export const MAX_DELIVERY_FILE_BYTES = 50 * 1024 * 1024;

export const DELIVERY_SIGNED_URL_TTL_SECONDS = 60 * 10;
