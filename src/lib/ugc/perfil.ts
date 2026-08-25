/**
 * Tope de la bio del creador.
 *
 * Vive acá y no en el componente porque lo aplican los dos lados: la hoja lo
 * usa para recortar y contar mientras se escribe, y el server action para
 * garantizarlo —que es donde importa, porque el input se puede saltear—.
 *
 * 160 es lo que entra en la tarjeta del perfil público sin cortarse y lo que
 * alguien lee antes de decidir si sigue mirando. Una bio de tres párrafos no
 * la lee nadie.
 */
export const MAX_BIO = 160;
