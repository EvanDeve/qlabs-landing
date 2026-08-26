import type { ApplicationStatus } from "@/lib/database.types";

/**
 * El riel de 4 pasos de una aplicación, para la pantalla "Mis aplicaciones".
 *
 * Los pasos NO son los ocho estados de `applications`: son los cuatro momentos
 * que le importan al creador. `pending` y `reviewing` viven los dos en el mismo
 * punto del riel (aplicaste, falta que la marca conteste) y los estados de
 * salida —rechazada, cancelada, en disputa— no son un paso más adelante, son
 * un desvío: el riel se congela donde llegó y ningún punto queda "en curso".
 */
export type PasoEstado = "hecho" | "ahora" | "pendiente";
export type Paso = { label: string; estado: PasoEstado };

type Hitos = {
  status: ApplicationStatus;
  accepted_at: string | null;
  delivered_at: string | null;
  approved_at: string | null;
};

/** Estados en los que nada avanza: el riel muestra lo logrado y se queda ahí. */
const DESVIADA: ApplicationStatus[] = ["rejected", "cancelled", "disputed"];

export function pasosDeAplicacion(app: Hitos): Paso[] {
  // La fecha manda sobre el estado: `approved_at` implica que se entregó,
  // aunque una entrega vieja se haya cargado sin pasar por `delivered`.
  const hechos = [
    true,
    Boolean(app.accepted_at) || Boolean(app.delivered_at) || Boolean(app.approved_at),
    Boolean(app.delivered_at) || Boolean(app.approved_at),
    Boolean(app.approved_at),
  ];

  const labels = ["Aplicaste", "Aceptada", hechos[2] ? "Entregaste" : "Entregá", "Aprobación"];
  const ahora = DESVIADA.includes(app.status) ? -1 : hechos.indexOf(false);

  return labels.map((label, i) => ({
    label,
    estado: hechos[i] ? "hecho" : i === ahora ? "ahora" : "pendiente",
  }));
}

/**
 * El mismo riel, pero como lo ve la MARCA.
 *
 * No es `pasosDeAplicacion` con otras etiquetas: es de otra cosa. El del
 * creador describe SU aplicación; este describe la CAMPAÑA, que puede tener
 * varias colaboraciones a la vez. El riel muestra la más avanzada, porque lo
 * que la marca quiere saber de un vistazo es en qué punto está la campaña, no
 * cada persona — para eso están las filas de abajo de la tarjeta.
 *
 * El primer paso es un hecho de la campaña (se publicó) y los otros tres son
 * de las aplicaciones. Mezclarlos es correcto desde este lado: publicás,
 * alguien graba, entrega, y te toca aprobar.
 *
 * "Aprobás vos" es el paso de AHORA cuando ya entregaron: la pelota es de la
 * marca y el riel tiene que decírselo, no felicitarla por la entrega ajena.
 */
export function pasosDeCampana(
  apps: Pick<Hitos, "accepted_at" | "delivered_at" | "approved_at">[]
): Paso[] {
  const alguna = (campo: keyof typeof apps[number]) => apps.some((a) => Boolean(a[campo]));

  const hechos = [
    true,
    // Igual que del lado del creador: la fecha manda sobre el estado, y una
    // aprobada implica que antes se aceptó y se entregó.
    alguna("accepted_at") || alguna("delivered_at") || alguna("approved_at"),
    alguna("delivered_at") || alguna("approved_at"),
    alguna("approved_at"),
  ];

  const labels = ["Publicada", "Grabando", "Entrega", "Aprobás vos"];
  const ahora = hechos.indexOf(false);

  return labels.map((label, i) => ({
    label,
    estado: hechos[i] ? "hecho" : i === ahora ? "ahora" : "pendiente",
  }));
}

/**
 * El tono del pill en esta pantalla, que NO es `APPLICATION_STATUS_STYLE`.
 *
 * El mapa compartido lo usa también el panel de la marca, donde "rechazada" en
 * rojo es la señal correcta: la marca acaba de descartar a alguien. Del lado
 * del creador la misma palabra en rojo lee como un error suyo, y el diseño la
 * pide en gris — una colaboración que no se dio, sin drama. Por eso el tono se
 * decide acá y el mapa de allá queda intacto.
 */
export type TonoAplicacion = "ok" | "curso" | "neutro" | "espera" | "problema" | "cerrada";

export const APLICACION_TONO: Record<ApplicationStatus, TonoAplicacion> = {
  // "Pendiente" en ámbar leía como alerta y no lo es: recién aplicaste. El
  // ámbar queda para "En revisión", donde sí hay alguien mirando del otro lado.
  pending: "neutro",
  reviewing: "espera",
  accepted: "ok",
  delivered: "curso",
  approved: "ok",
  rejected: "cerrada",
  cancelled: "cerrada",
  disputed: "problema",
};

/**
 * Fecha límite de la entrega. No existe como columna: sale de cuándo la marca
 * aceptó más los días de plazo de la campaña. Mismo criterio que el Home —si
 * falta cualquiera de los dos, no hay fecha, y eso NO se muestra como vencido.
 */
export function fechaLimite(acceptedAt: string | null, deadlineDays: number | null): Date | null {
  if (!acceptedAt || !deadlineDays) return null;
  const d = new Date(acceptedAt);
  d.setDate(d.getDate() + deadlineDays);
  return d;
}

export function fechaCorta(d: Date): string {
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = d.toLocaleDateString("es-CR", { month: "short" }).replace(".", "");
  return `${dia} ${mes}`;
}
