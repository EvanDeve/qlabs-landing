/**
 * Las dos fuentes de apuntes de un video del cronograma, y cuál gana.
 *
 * Los apuntes viven en DOS campos: `calendar_month_items.notes` (lo que se
 * escribió al armar el mes) y `content_pieces.notes` (lo que el equipo anota en
 * la tarjeta del pipeline). La separación es a propósito —propuesta contra
 * trabajo real— y por eso no se fusionan; lo que no puede pasar es que cada
 * pantalla decida por su cuenta cuál mostrar. Esa decisión vive acá.
 */

/**
 * Los apuntes de un video: los de la tarjeta del pipeline si ya es tarjeta, y
 * si no, las notas de producción del propio cronograma.
 *
 * El orden importa y no es arbitrario. Los dos campos dicen lo mismo —si va
 * grabación o voice over— pero viven en momentos distintos: la tarjeta nace
 * recién cuando el cliente aprueba, así que antes de eso lo único que hay son
 * las notas del cronograma. Medido contra producción el 2026-08-26: 93 de 104
 * videos tienen notas del cronograma y solo 32 son tarjeta. Con la tarjeta
 * primero, después de aprobado gana lo último que escribió el equipo sobre el
 * tablero, que es donde lo sigue afinando.
 */
export function apuntesDe(notasDelCronograma: string | null, apuntesDeLaTarjeta: string | null | undefined): string | null {
  return apuntesDeLaTarjeta?.trim() || notasDelCronograma?.trim() || null;
}
