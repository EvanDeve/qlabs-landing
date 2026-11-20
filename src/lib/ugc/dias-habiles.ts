import { fromZonedTime } from "date-fns-tz";
import { COSTA_RICA_TZ } from "./calendar";

/*
 * Días hábiles (spec 003). Todo trabaja con días de calendario de Costa Rica
 * en formato 'yyyy-MM-dd' (los que da diaCR). Nada de new Date() adentro: quien
 * llama decide qué es "hoy". La aritmética va en UTC a mediodía para que la
 * zona horaria del server no corra el día.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function aFecha(dia: string): Date {
  const [anio, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, d, 12));
}

function aDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function diaDeLaSemana(dia: string): number {
  return aFecha(dia).getUTCDay();
}

/** Lunes a viernes. Sin feriados. */
export function esDiaHabil(dia: string): boolean {
  const d = diaDeLaSemana(dia);
  return d !== 0 && d !== 6;
}

export function sumarDiasAlDia(dia: string, dias: number): string {
  return aDia(new Date(aFecha(dia).getTime() + dias * MS_POR_DIA));
}

/** hasta − desde, en días de calendario. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / MS_POR_DIA);
}

/** Los días hábiles de desde a hasta, ambos incluidos. [] si desde > hasta. */
export function diasHabilesEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let dia = desde; dia <= hasta; dia = sumarDiasAlDia(dia, 1)) {
    if (esDiaHabil(dia)) dias.push(dia);
  }
  return dias;
}

/** Los últimos n días hábiles, hoy incluido si es hábil. El más nuevo primero. */
export function ultimosDiasHabiles(hoy: string, n: number): string[] {
  const dias: string[] = [];
  for (let dia = hoy; dias.length < n; dia = sumarDiasAlDia(dia, -1)) {
    if (esDiaHabil(dia)) dias.push(dia);
  }
  return dias;
}

/** El lunes de la semana del día (un domingo da el lunes anterior). */
export function inicioDeSemana(dia: string): string {
  const desdeElLunes = (diaDeLaSemana(dia) + 6) % 7;
  return sumarDiasAlDia(dia, -desdeElLunes);
}

/** 'yyyy-MM-01'. */
export function inicioDeMes(dia: string): string {
  return `${dia.slice(0, 7)}-01`;
}

/** [00:00 CR del día, 00:00 CR del siguiente) en ISO, para filtrar timestamptz. */
export function rangoUtcDelDia(dia: string): { desde: string; hasta: string } {
  return {
    desde: fromZonedTime(`${dia}T00:00:00`, COSTA_RICA_TZ).toISOString(),
    hasta: fromZonedTime(`${sumarDiasAlDia(dia, 1)}T00:00:00`, COSTA_RICA_TZ).toISOString(),
  };
}
