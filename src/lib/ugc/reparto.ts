/*
 * Reparto de la mañana (spec 003). Función pura: recibe el estado y devuelve
 * qué tarjeta va a quién. La aplica la rpc aplicar_reparto_de_edicion, que
 * además saltea las que alguien tomó entre la lectura y la escritura.
 */

/** Videos pendientes que cada editor tiene que tener en su fila al arrancar el día. */
export const META_DIARIA = 8;

export type VideoParaReparto = {
  id: string;
  publishDate: string | null; // 'yyyy-MM-dd'
  publishTime: string | null; // 'HH:mm' o 'HH:mm:ss'
  createdAt: string;
};

/** En el orden fijo de desempate. */
export type EditorParaReparto = { profileId: string; pendientes: number };

export type Asignacion = { pieceId: string; ownerId: string };

function compararNulosAlFinal(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/**
 * RF-05: fecha de publicación ascendente (así los atrasados salen primero solos)
 * y los sin fecha al final. Desempata la hora (sin hora al final), la creación y el id.
 */
export function compararParaReparto(a: VideoParaReparto, b: VideoParaReparto): number {
  return (
    compararNulosAlFinal(a.publishDate, b.publishDate) ||
    compararNulosAlFinal(a.publishTime, b.publishTime) ||
    compararNulosAlFinal(a.createdAt, b.createdAt) ||
    compararNulosAlFinal(a.id, b.id)
  );
}

/**
 * RF-06, RF-07, RF-09: completa a cada editor hasta `meta` pendientes. Cada video
 * va al que en ese momento tiene menos; si empatan, al primero del array.
 * Ordena los disponibles por dentro y no muta las entradas.
 */
export function repartir(
  editores: EditorParaReparto[],
  disponibles: VideoParaReparto[],
  meta: number = META_DIARIA
): Asignacion[] {
  const carga = editores.map((e) => ({ profileId: e.profileId, pendientes: e.pendientes }));
  const ordenados = [...disponibles].sort(compararParaReparto);
  const asignaciones: Asignacion[] = [];

  for (const v of ordenados) {
    let elegido: (typeof carga)[number] | null = null;
    for (const e of carga) {
      if (e.pendientes >= meta) continue;
      if (elegido === null || e.pendientes < elegido.pendientes) elegido = e;
    }
    if (elegido === null) break; // todos llenos
    asignaciones.push({ pieceId: v.id, ownerId: elegido.profileId });
    elegido.pendientes += 1;
  }

  return asignaciones;
}
