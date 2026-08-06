import QRCode from "qrcode";
import type { PointAction } from "@/lib/database.types";

/**
 * Loyalty Loop del lado del código.
 *
 * Lo que NO vive acá: cuántos puntos vale cada acción y a partir de cuántos se
 * sube de nivel. Eso está en `point_rules` y `level_thresholds`, en la base,
 * para poder ajustar la economía con un UPDATE. Duplicar los números en
 * TypeScript sería tener dos verdades y descubrir cuál manda el día que no
 * coincidan.
 *
 * Lo que sí vive acá: cómo se le cuenta todo eso al creador.
 */

export type Nivel = {
  level: number;
  name: string;
  min_points: number;
};

/** El emoji es del demo aprobado. Bronce no lleva: es donde arranca todo el mundo. */
export const EMOJI_NIVEL: Record<number, string> = {
  1: "",
  2: "🥈",
  3: "🥇",
  4: "💎",
};

export const COLOR_NIVEL: Record<number, string> = {
  1: "#a06a3c",
  2: "#7d8794",
  3: "#c07414",
  4: "#6d54f3",
};

/**
 * Dónde está parado el creador. Recibe los umbrales de la base ordenados o no
 * —los ordena— para que quien llame no tenga que acordarse.
 */
export function estadoDeNivel(totalPoints: number, umbrales: Nivel[]) {
  const escalera = [...umbrales].sort((a, b) => a.min_points - b.min_points);
  const actual = escalera.filter((n) => n.min_points <= totalPoints).pop() ?? escalera[0];
  const siguiente = escalera.find((n) => n.min_points > totalPoints) ?? null;

  const faltan = siguiente ? siguiente.min_points - totalPoints : 0;

  // El progreso se mide DENTRO del tramo, no sobre el total: pasar de 500 a 600
  // con Oro en 1500 tiene que verse como un 10 % del tramo, no como un 40 % de
  // la barra entera. En Platino no hay tramo siguiente, así que la barra va
  // llena — es el final de la escalera, no un 100 % inventado.
  const base = actual?.min_points ?? 0;
  const progreso = siguiente
    ? Math.min(100, Math.max(0, ((totalPoints - base) / (siguiente.min_points - base)) * 100))
    : 100;

  return { escalera, actual, siguiente, faltan, progreso };
}

/**
 * Cómo se lee cada acción en el historial. Las claves son las de `point_rules`;
 * si se agrega una regla nueva en la base sin pasar por acá, la pantalla cae en
 * el fallback y muestra la clave cruda en vez de romperse.
 */
export const LABEL_ACCION: Record<PointAction, string> = {
  profile_completed: "Perfil completado al 100%",
  book_upload: "Pieza subida al book",
  application: "Aplicación a promo",
  campaign_selected: "Seleccionado en campaña",
  delivery_approved: "Entrega aprobada",
  rating_5: "Rating 5★",
  rating_4: "Rating 4★",
};

export function labelAccion(action: string): string {
  return LABEL_ACCION[action as PointAction] ?? action;
}

export const LABEL_TIPO_CUPON: Record<string, string> = {
  producto: "Producto",
  servicio: "Servicio",
  evento: "Evento",
};

/**
 * La leyenda de los eventos es fija y no editable por la marca — decisión de
 * producto, no un default. Evita el malentendido caro: el creador llega a una
 * cena de aniversario creyendo que el consumo va incluido.
 */
export const LEYENDA_EVENTO =
  "Incluye entrada al evento. El consumo dentro del evento corre por cuenta del creador.";

/**
 * A dónde apunta el QR. Es la pantalla donde la marca confirma el canje, así
 * que tiene que ser absoluta: el celular que escanea no tiene idea de en qué
 * origen estaba el creador.
 */
export function urlValidacion(code: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.qlabsmethod.com";
  return `${base.replace(/\/$/, "")}/ugc/marca/validar/${code}`;
}

/**
 * El QR como SVG en línea, generado en el servidor.
 *
 * SVG y no PNG a propósito: se ve nítido en cualquier pantalla, pesa menos que
 * la imagen equivalente y no necesita una request aparte —va incrustado en el
 * HTML—. Que se genere en el servidor evita mandar la librería entera al
 * navegador para dibujar un cuadrito.
 *
 * `margin: 2` es el "quiet zone" mínimo del estándar: sin borde blanco
 * alrededor, muchos lectores no encuentran el código.
 */
export async function qrSvg(code: string): Promise<string> {
  return QRCode.toString(urlValidacion(code), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
    color: { dark: "#0a0b10", light: "#ffffff" },
  });
}

/** "vence el 22 de agosto" — para plazos que el creador tiene que recordar. */
export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Costa_Rica",
  });
}

/** "02 ago" — para las filas del historial, donde el año no aporta nada. */
export function fechaCorta(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-CR", { day: "2-digit", month: "short", timeZone: "America/Costa_Rica" })
    .replace(".", "");
}

/**
 * Cuántos días faltan, contando por día de calendario en Costa Rica y no por
 * bloques de 24 h: un cupón que vence mañana a las 9 a.m. tiene que decir
 * "vence mañana", no "vence hoy" porque faltan 19 horas.
 */
export function diasRestantes(iso: string): number {
  const zona = "en-CA"; // formato YYYY-MM-DD, cómodo para comparar
  const dia = (d: Date) => d.toLocaleDateString(zona, { timeZone: "America/Costa_Rica" });
  const hoy = new Date(dia(new Date()));
  const vence = new Date(dia(new Date(iso)));
  return Math.round((vence.getTime() - hoy.getTime()) / 86_400_000);
}
