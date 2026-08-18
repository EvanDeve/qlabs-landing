import type { PipelineSection } from "@/lib/database.types";

/**
 * Los carriles del tablero, que es lo único que McLovin necesita entender para
 * no mover una tarjeta a donde no va.
 *
 * El tablero corre TRES carriles —`guion`, `video` e `it`— y cada uno tiene sus
 * propias columnas. El editor de tarjetas de Q·OS solo ofrece las columnas del
 * carril donde está la pieza; el chat, en cambio, aceptaba cualquier nombre que
 * existiera en cualquier lado. Con dos columnas llamadas "Terminado" —una de
 * video y otra de IT— eso alcanzaba para mandar un video al carril equivocado
 * con un mensaje de una línea.
 *
 * Vive acá, aparte del webhook, porque es data pura: se puede probar con el
 * tablero real sin levantar nada. Mismo criterio que agenda.ts.
 */

export type ColumnaDelTablero = {
  id: string;
  name: string;
  /** La columna donde una tarjeta se considera cerrada. Hay una por carril… o ninguna. */
  is_done: boolean;
  section: PipelineSection;
};

/**
 * En qué carril está parada una tarjeta.
 *
 * Se resuelve por la columna donde está y no por un campo de la pieza: el carril
 * no es algo que la tarjeta sea, es dónde la pusieron.
 */
export function carrilDe(columnas: ColumnaDelTablero[], columnId: string): PipelineSection | null {
  return columnas.find((c) => c.id === columnId)?.section ?? null;
}

/** Las columnas del carril donde está esa tarjeta, en el orden del tablero. */
export function columnasDelCarril(columnas: ColumnaDelTablero[], columnId: string): ColumnaDelTablero[] {
  const carril = carrilDe(columnas, columnId);
  return carril ? columnas.filter((c) => c.section === carril) : [];
}

export type Destino = { ok: true; columna: ColumnaDelTablero } | { ok: false; nota: string };

/**
 * La columna a la que se puede mover una tarjeta, buscada DENTRO de su carril.
 *
 * Cuando el nombre existe pero en otro carril se dice cuáles sí valen: es la
 * diferencia entre un "no pude" y que la persona sepa qué pedir la próxima vez.
 */
export function columnaDestino(
  columnas: ColumnaDelTablero[],
  columnIdActual: string,
  nombre: string
): Destino {
  const delCarril = columnasDelCarril(columnas, columnIdActual);
  if (!delCarril.length) return { ok: false, nota: "No la moví: no encontré el carril de esa tarjeta." };

  const columna = delCarril.find((c) => c.name.toLowerCase() === nombre.toLowerCase());
  if (columna) return { ok: true, columna };

  return {
    ok: false,
    nota: `No la moví: "${nombre}" no es una columna del carril donde está esa tarjeta. Ahí las columnas son: ${delCarril
      .map((c) => c.name)
      .join(", ")}.`,
  };
}

/**
 * La columna de "terminado" del carril de esa tarjeta.
 *
 * "Hecho" en este tablero es una columna marcada `is_done`, no un estado aparte,
 * y cada carril tiene la suya: guiones cierra en "Cronogramas aprobados" y video
 * en "Publicado".
 *
 * Antes esto recorría el tablero ENTERO desde la posición actual en adelante,
 * con un último recurso que agarraba la última `is_done` de cualquier carril. Con
 * el carril de IT —que hoy no tiene ninguna columna marcada como terminada— eso
 * mandaba sus tarjetas a "Publicado", del carril de video. Cuando el carril no
 * tiene columna final la respuesta correcta es decirlo, no elegir otra.
 */
export function columnaFinalDe(columnas: ColumnaDelTablero[], columnIdActual: string): Destino {
  const delCarril = columnasDelCarril(columnas, columnIdActual);
  const terminada = delCarril.find((c) => c.is_done);
  if (terminada) return { ok: true, columna: terminada };

  const carril = carrilDe(columnas, columnIdActual);
  return {
    ok: false,
    nota: carril
      ? `No pude cerrarla: el carril de ${carril} no tiene ninguna columna marcada como terminada. Eso se marca desde Q·OS, editando la columna.`
      : "No pude cerrarla: no encontré el carril de esa tarjeta.",
  };
}

/**
 * Dónde nace una tarjeta que se anota por chat: la primera columna del carril de
 * video.
 *
 * NO la primera del tablero. El carril de guiones arranca antes por posición, así
 * que un video pedido por WhatsApp nacía en "Cronogramas" —que es para los
 * cronogramas mensuales de un Hero, no para videos sueltos— y no aparecía nunca
 * donde el equipo lo iba a buscar.
 */
export function columnaDeEntrada(columnas: ColumnaDelTablero[]): ColumnaDelTablero | null {
  return columnas.find((c) => c.section === "video") ?? null;
}
