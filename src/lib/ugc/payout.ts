// La marca paga el 100% del presupuesto de la campaña; la agencia se queda
// con un 20% de comisión y le paga al creador el 80% restante. El creador
// nunca ve el monto bruto — en todo lugar donde ve un pago, es el neto.
export const AGENCY_FEE_RATE = 0.2;

export function creatorPayout(budgetAmount: number): number {
  return Math.round(budgetAmount * (1 - AGENCY_FEE_RATE));
}
