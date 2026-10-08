/**
 * Piezas destacadas del media kit: el creador elige hasta 3 piezas de su book
 * que salen arriba de todo en su kit.
 *
 * Las listas son ids en el orden en que se muestran. El tope también lo
 * garantiza la base (check 1..3 + unique por creador); acá está para avisarle
 * al creador antes de llegar a ella.
 */

export const MAX_DESTACADAS = 3;

/** Destaca si no está, la saca si está. Con 3 ya puestas, no agrega y avisa (RF-02). */
export function alternarDestacada(
  actuales: string[],
  id: string
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (actuales.includes(id)) {
    return { ok: true, ids: actuales.filter((x) => x !== id) };
  }
  if (actuales.length >= MAX_DESTACADAS) {
    return {
      ok: false,
      error: `Podés destacar hasta ${MAX_DESTACADAS} piezas. Quitá una para sumar esta.`,
    };
  }
  return { ok: true, ids: [...actuales, id] };
}

/** Sube o baja una destacada un lugar; en los bordes devuelve la lista igual. */
export function moverDestacada(
  actuales: string[],
  id: string,
  direccion: "antes" | "despues"
): string[] {
  const i = actuales.indexOf(id);
  const j = direccion === "antes" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= actuales.length) return [...actuales];

  const ids = [...actuales];
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}

/** Parte el book en destacadas (por orden_destacada) y el resto (por position), sin repetir (RF-03, RF-04). */
export function separarDestacadas<
  T extends { id: string; position: number; orden_destacada: number | null },
>(items: T[]): { destacadas: T[]; resto: T[] } {
  const destacadas = items
    .filter((p) => p.orden_destacada != null)
    .sort((a, b) => a.orden_destacada! - b.orden_destacada!);
  const resto = items
    .filter((p) => p.orden_destacada == null)
    .sort((a, b) => a.position - b.position);
  return { destacadas, resto };
}
