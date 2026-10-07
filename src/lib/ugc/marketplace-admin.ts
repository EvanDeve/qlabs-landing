/**
 * Las pestañas y el buscador de /admin/marketplace. Funciones puras: la página
 * las usa para leer el query y filtrar lo que ya trajo de la base.
 */

export const PESTANAS_MARKETPLACE = [
  { id: "creadores", label: "Creadores" },
  { id: "marcas", label: "Marcas" },
  { id: "campanas", label: "Campañas" },
  { id: "aplicaciones", label: "Aplicaciones" },
] as const;

export type PestanaMarketplace = (typeof PESTANAS_MARKETPLACE)[number]["id"];

/** Creadores por defecto: es donde más se verifica. */
export function leerPestana(valor: string | undefined): PestanaMarketplace {
  return PESTANAS_MARKETPLACE.find((p) => p.id === valor)?.id ?? "creadores";
}

/**
 * Un estado del query solo vale si es uno de los de esa pestaña. Si no —un
 * link viejo, o el estado de otra pestaña que quedó pegado—, se ignora en vez
 * de dejar la lista vacía sin explicación.
 */
export function leerEstado<T extends string>(valor: string | undefined, validos: readonly T[]): T | null {
  return validos.find((v) => v === valor) ?? null;
}

/** Sin tildes, sin mayúsculas, sin espacios de más: "Café" encuentra "cafe". */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Si la fila coincide con lo buscado. Cada palabra tiene que aparecer en
 * alguno de los campos, no todas en el mismo: "zonna reel" encuentra la
 * campaña "Reel de brunch" de Zonna. El "@" del handle no cuenta, así que
 * "@vale" y "vale" buscan lo mismo.
 */
export function coincide(busqueda: string, campos: (string | null | undefined)[]): boolean {
  const palabras = normalizarBusqueda(busqueda.replace(/@/g, " ")).split(" ").filter(Boolean);
  if (palabras.length === 0) return true;
  const texto = campos
    .filter(Boolean)
    .map((c) => normalizarBusqueda(c!.replace(/@/g, "")))
    .join(" ");
  return palabras.every((p) => texto.includes(p));
}

/** La ficha del creador en Q·OS. Un solo lugar arma la URL: la linkean varias pantallas. */
export function rutaFichaCreador(profileId: string): string {
  return `/admin/marketplace/creador/${profileId}`;
}
