import type { ContentPlatform, StaffRole } from "@/lib/database.types";
import { diasEntre, esDiaHabil } from "./dias-habiles";
import { META_DIARIA, compararParaReparto } from "./reparto";

/*
 * Vista del editor en el Dashboard (spec 003). Funciones puras: los datos los
 * trae edicion-datos.ts y "hoy" (día CR) lo pasa quien llama.
 */

export type VideoDeFila = {
  id: string;
  titulo: string;
  cliente: string | null;
  publishDate: string | null;
  publishTime: string | null;
  createdAt: string;
  plataforma: ContentPlatform;
  grabado: boolean;
};

/** diasParaPublicar negativo = días de atraso; null = sin fecha. */
export type VideoEnFila = VideoDeFila & { diasParaPublicar: number | null };

export type FilaDelEditor = { atrasados: VideoEnFila[]; resto: VideoEnFila[] };

/** RF-13, CL-11: solo el editor activo ve su vista; todos los demás, la de la agencia. */
export function vistaDelDashboard(
  staff: { staff_role: StaffRole; active: boolean } | null
): "editor" | "agencia" {
  return staff?.staff_role === "editor" && staff.active ? "editor" : "agencia";
}

/** RF-05, RF-16, RF-17: en el orden del reparto, con los atrasados aparte (el más viejo primero). */
export function armarFila(videos: VideoDeFila[], hoy: string): FilaDelEditor {
  const fila: FilaDelEditor = { atrasados: [], resto: [] };
  const ordenados = [...videos].sort((a, b) => compararParaReparto(a, b));
  for (const v of ordenados) {
    const diasParaPublicar = v.publishDate ? diasEntre(hoy, v.publishDate) : null;
    const enFila = { ...v, diasParaPublicar };
    if (diasParaPublicar !== null && diasParaPublicar < 0) fila.atrasados.push(enFila);
    else fila.resto.push(enFila);
  }
  return fila;
}

/** RF-19: días hasta la fecha más cercana de la fila; negativo si está atrasada; null sin fechas. */
export function diasDeAdelanto(videos: { publishDate: string | null }[], hoy: string): number | null {
  let primera: string | null = null;
  for (const v of videos) {
    if (v.publishDate && (primera === null || v.publishDate < primera)) primera = v.publishDate;
  }
  return primera === null ? null : diasEntre(hoy, primera);
}

function dias(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}

export function textoAdelanto(d: number | null): string | null {
  if (d === null) return null;
  if (d === 0) return "Al día: el próximo se publica hoy";
  return d > 0 ? `${dias(d)} de adelanto` : `${dias(-d)} de atraso`;
}

/** RF-14, RF-15, CL-13: la meta solo existe en día hábil, y se puede pasar. */
export function avanceDelDia(
  terminados: number,
  hoy: string,
  meta: number = META_DIARIA
): { terminados: number; meta: number | null; texto: string; cumplida: boolean | null } {
  if (!esDiaHabil(hoy)) {
    return {
      terminados,
      meta: null,
      texto: terminados === 0 ? "Hoy no hay meta" : `Terminaste ${terminados} hoy`,
      cumplida: null,
    };
  }
  return { terminados, meta, texto: `Llevás ${terminados} de ${meta}`, cumplida: terminados >= meta };
}

/** RF-20. */
export function textoFilaVacia(disponibles: number): string {
  if (disponibles === 0) return "No tenés videos en tu fila y no hay ninguno disponible para tomar.";
  const cuantos = disponibles === 1 ? "1 disponible" : `${disponibles} disponibles`;
  return `No tenés videos en tu fila. Hay ${cuantos} en Por editar.`;
}
