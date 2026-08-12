import { diaCR } from "@/lib/ugc/calendar";

/**
 * Los meses del cronograma, como día 1 en formato 'yyyy-MM-01'.
 *
 * Todo lo que tenga que ver con "qué mes es" pasa por acá y no por
 * `new Date().getMonth()`. El motivo es el de siempre en este proyecto: el
 * servidor corre en UTC y Costa Rica es UTC-6, así que el 31 de agosto a las
 * 7 de la noche de CR el servidor ya cree que es septiembre. Un cronograma
 * aprobado con esa cuenta se guardaba en el mes equivocado.
 *
 * Ver la migración 20260801000000 y [[reference-fechas-dia-vs-instante]].
 */

/** El mes de Costa Rica de una fecha, como 'yyyy-MM-01'. */
export function mesCR(fecha: string | Date = new Date()): string {
  return `${diaCR(fecha).slice(0, 7)}-01`;
}

/** Suma (o resta) meses a un 'yyyy-MM-01' sin pasar por Date ni por zonas. */
export function sumarMeses(mes: string, cantidad: number): string {
  const anio = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7));
  // -1 para trabajar en base 0, donde el módulo se porta bien con los saltos de
  // año, y +1 al volver a escribirlo.
  const total = anio * 12 + (numero - 1) + cantidad;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

const NOMBRES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** '2026-09-01' → 'septiembre 2026'. */
export function nombreDeMes(mes: string): string {
  return `${NOMBRES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
}

/** Cuántos días tiene el mes. `Date.UTC(año, mes, 0)` es el "día 0" del siguiente. */
export function diasDelMes(mes: string): number {
  return new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
}

/** Los días del mes como 'yyyy-MM-dd', para poblar un selector de fecha. */
export function diasDe(mes: string): string[] {
  return Array.from({ length: diasDelMes(mes) }, (_, i) => `${mes.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);
}

/**
 * Valida un mes que llegó de la URL antes de mandarlo a Postgres.
 *
 * Sin esto, un `/cronogramas/<hero>/septiembre` escrito a mano hace fallar la
 * consulta entera y la pantalla sale vacía sin decir por qué. Se exige además
 * el día 1, que es el check que la tabla ya tiene.
 */
export function parseMes(valor: string | undefined): string | null {
  return valor && /^\d{4}-\d{2}-01$/.test(valor) && Number(valor.slice(5, 7)) >= 1 && Number(valor.slice(5, 7)) <= 12
    ? valor
    : null;
}

/**
 * La ventana de meses que ofrece el selector: de un año atrás a tres adelante.
 *
 * Hacia atrás porque el Dashboard mira meses cerrados; hacia adelante porque un
 * cronograma se arma antes de que empiece el mes —ese es todo el punto— y con
 * el mes actual como tope no se podría armar septiembre en agosto.
 */
export function mesesAlrededor(ahora: Date = new Date()): string[] {
  const actual = mesCR(ahora);
  return Array.from({ length: 17 }, (_, i) => sumarMeses(actual, i - 13));
}

/** La hora 'HH:mm:ss' de Postgres como 'HH:mm', que es lo que espera un input. */
export function horaCorta(hora: string | null): string {
  return hora?.slice(0, 5) ?? "";
}
