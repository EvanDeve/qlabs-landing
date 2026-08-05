// La marca paga el 100% del presupuesto de la campaña; la agencia se queda
// con un 20% de comisión y le paga al creador el 80% restante.
//
// Desde 2026-08-04 el desglose se muestra a las DOS partes: el creador ve de
// dónde sale su neto y la marca ve cuánto le llega al creador. Antes el
// creador solo veía el neto, sin explicación, y dos números distintos para la
// misma campaña (₡180.000 puestos por la marca, ₡144.000 en la pantalla del
// creador) leían como error o como cobro escondido. Decisión de Evan tras la
// auditoría de Andrés, con el costo asumido: el creador queda sabiendo cuánto
// pagó la marca.
export const AGENCY_FEE_RATE = 0.2;

export function creatorPayout(budgetAmount: number): number {
  return Math.round(budgetAmount * (1 - AGENCY_FEE_RATE));
}

/**
 * Las tres cifras de una campaña, para que las dos partes vean lo mismo.
 *
 * La comisión se calcula por resta y no como `bruto * TASA`: con redondeos
 * separados, las tres cifras podían no cerrar (₡180.001 daba 36.000 + 144.001).
 * Un desglose que no suma destruye justo la confianza que viene a construir.
 */
export function desglosePago(budgetAmount: number): {
  bruto: number;
  comision: number;
  neto: number;
  porcentaje: number;
} {
  const neto = creatorPayout(budgetAmount);
  return {
    bruto: budgetAmount,
    comision: budgetAmount - neto,
    neto,
    porcentaje: Math.round(AGENCY_FEE_RATE * 100),
  };
}
