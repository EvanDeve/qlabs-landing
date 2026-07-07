// Fórmula v1, simple y transparente: verificación (base) + entregas
// aprobadas + puntualidad. Los pesos son un punto de partida — se pueden
// ajustar más adelante sin cambiar la forma de calcularla.

const VERIFIED_BASE = 30;
const UNVERIFIED_BASE = 10;
const POINTS_PER_APPROVED_DELIVERY = 10;
const MAX_DELIVERY_SCORE = 40;
const MAX_PUNCTUALITY_SCORE = 30;

export function computeTrustScore({
  verified,
  approvedCount,
  onTimeRatio,
}: {
  verified: boolean;
  approvedCount: number;
  onTimeRatio: number | null;
}): number {
  const base = verified ? VERIFIED_BASE : UNVERIFIED_BASE;
  const deliveryScore = Math.min(approvedCount * POINTS_PER_APPROVED_DELIVERY, MAX_DELIVERY_SCORE);
  const punctualityScore = onTimeRatio === null ? 0 : Math.round(MAX_PUNCTUALITY_SCORE * onTimeRatio);
  return Math.min(base + deliveryScore + punctualityScore, 100);
}
