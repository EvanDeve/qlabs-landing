/**
 * Trae todas las filas de una consulta, de a páginas.
 *
 * PostgREST corta en 1000 filas SIN avisar: la respuesta llega entera y con
 * error null, solo que le faltan filas. `armar(desde, hasta)` tiene que
 * devolver la consulta con `.range(desde, hasta)` y un orden estable (si no,
 * dos páginas pueden repetir o saltear filas).
 *
 *   const filas = await traerTodas((desde, hasta) =>
 *     supabase.from("x").select("id").order("id").range(desde, hasta));
 */
export async function traerTodas<T>(
  armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  tamano = 1000
): Promise<T[]> {
  const todas: T[] = [];
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await armar(desde, desde + tamano - 1);
    if (error) {
      const mensaje = typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
      throw new Error(mensaje);
    }
    const pagina = data ?? [];
    todas.push(...pagina);
    if (pagina.length < tamano) return todas;
  }
}
