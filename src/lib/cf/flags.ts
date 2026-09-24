/**
 * Los Qs —la moneda interna de Close Friends— están sin definir a propósito
 * (2026-09-24). No hay tablas ni lógica: la pestaña existe y dice
 * "Próximamente". Este flag es el único lugar que la condiciona, para que el
 * día que se definan se prenda desde el entorno sin buscar por el código.
 */
export const FEATURE_QS = process.env.FEATURE_QS === "true";
