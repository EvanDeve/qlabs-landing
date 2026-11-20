import { diaCR, diaCorto } from "./calendar";
import {
  diasHabilesEntre,
  esDiaHabil,
  inicioDeMes,
  inicioDeSemana,
  sumarDiasAlDia,
  ultimosDiasHabiles,
} from "./dias-habiles";
import { diasDeAdelanto } from "./edicion";
import { META_DIARIA } from "./reparto";

/*
 * Panel de editores (spec 003, solo directores). Funciones puras: los datos
 * los trae edicion-datos.ts. Los terminados se atribuyen al responsable ACTUAL
 * del video (RF-29, P-03): reasignar uno viejo cambia el historial (CL-05).
 */

export type EditorDelPanel = { profileId: string; nombre: string };
export type TerminadoRegistrado = { ownerId: string; terminadoAt: string };
export type PeriodoDelPanel = { desde: string; hasta: string; total: number; meta: number; porcentaje: number | null };
export type FilaDelPanel = {
  profileId: string;
  nombre: string;
  hoy: { terminados: number; meta: number | null };
  pendientes: number;
  atrasados: number;
  diasDeAdelanto: number | null;
  historial: { dia: string; terminados: number; llego: boolean }[];
  semanas: PeriodoDelPanel[]; // [actual, anterior]
  meses: PeriodoDelPanel[]; // [actual, anterior]
};

/** Los días que cuentan de un período: desde el inicio de la medición y hasta hoy. */
function diasQueCuentan(desde: string, hasta: string, hoy: string, inicioMedicion: string | null): string[] {
  if (inicioMedicion === null) return [];
  const inicio = desde > inicioMedicion ? desde : inicioMedicion;
  const fin = hasta < hoy ? hasta : hoy;
  return diasHabilesEntre(inicio, fin);
}

/** RF-27, RF-28, RF-32: 8 × días hábiles en [max(desde, inicio), min(hasta, hoy)]. */
export function metaDelPeriodo(
  desde: string,
  hasta: string,
  hoy: string,
  inicioMedicion: string | null,
  meta: number = META_DIARIA
): { diasHabiles: number; meta: number } {
  const diasHabiles = diasQueCuentan(desde, hasta, hoy, inicioMedicion).length;
  return { diasHabiles, meta: diasHabiles * meta };
}

function finDeMes(dia: string): string {
  // El 1 + 31 días siempre cae en el mes siguiente.
  return sumarDiasAlDia(inicioDeMes(sumarDiasAlDia(inicioDeMes(dia), 31)), -1);
}

/** [actual, anterior] de semanas y de meses, como rangos de días. */
function periodos(hoy: string) {
  const lunes = inicioDeSemana(hoy);
  const primero = inicioDeMes(hoy);
  const primeroAnterior = inicioDeMes(sumarDiasAlDia(primero, -1));
  return {
    semanas: [
      { desde: lunes, hasta: sumarDiasAlDia(lunes, 6) },
      { desde: sumarDiasAlDia(lunes, -7), hasta: sumarDiasAlDia(lunes, -1) },
    ],
    meses: [
      { desde: primero, hasta: finDeMes(primero) },
      { desde: primeroAnterior, hasta: sumarDiasAlDia(primero, -1) },
    ],
  };
}

/** RF-25..29, RF-31, RF-32. */
export function resumenDelPanel(entrada: {
  editores: EditorDelPanel[];
  fila: { ownerId: string; publishDate: string | null }[];
  terminados: TerminadoRegistrado[];
  hoy: string;
  inicioMedicion: string | null;
  diasHistorial?: number;
}): FilaDelPanel[] {
  const { editores, fila, terminados, hoy, inicioMedicion, diasHistorial = 10 } = entrada;

  // ownerId → día CR → cantidad
  const porDia = new Map<string, Map<string, number>>();
  for (const t of terminados) {
    const dia = diaCR(t.terminadoAt);
    const delEditor = porDia.get(t.ownerId) ?? new Map<string, number>();
    delEditor.set(dia, (delEditor.get(dia) ?? 0) + 1);
    porDia.set(t.ownerId, delEditor);
  }

  const historialDias = ultimosDiasHabiles(hoy, diasHistorial).filter(
    (d) => inicioMedicion !== null && d >= inicioMedicion
  );
  const { semanas, meses } = periodos(hoy);

  return editores.map(({ profileId, nombre }) => {
    const delEditor = porDia.get(profileId) ?? new Map<string, number>();
    const enDia = (dia: string) => delEditor.get(dia) ?? 0;

    const periodo = ({ desde, hasta }: { desde: string; hasta: string }): PeriodoDelPanel => {
      const dias = diasQueCuentan(desde, hasta, hoy, inicioMedicion);
      const meta = dias.length * META_DIARIA;
      // Se suman todos los días que cuentan (también un sábado trabajado),
      // pero la meta solo pone los hábiles.
      let total = 0;
      if (dias.length > 0) {
        for (const [dia, n] of delEditor) {
          if (dia >= dias[0] && dia <= dias[dias.length - 1]) total += n;
        }
      }
      return { desde, hasta, total, meta, porcentaje: meta > 0 ? Math.round((total / meta) * 100) : null };
    };

    const suFila = fila.filter((v) => v.ownerId === profileId);

    return {
      profileId,
      nombre,
      hoy: { terminados: enDia(hoy), meta: esDiaHabil(hoy) ? META_DIARIA : null },
      pendientes: suFila.length,
      atrasados: suFila.filter((v) => v.publishDate !== null && v.publishDate < hoy).length,
      diasDeAdelanto: diasDeAdelanto(suFila, hoy),
      historial: historialDias.map((dia) => ({ dia, terminados: enDia(dia), llego: enDia(dia) >= META_DIARIA })),
      semanas: semanas.map(periodo),
      meses: meses.map(periodo),
    };
  });
}

/** RF-32. */
export function textoInicioMedicion(inicio: string | null): string {
  if (inicio === null) return "La medición arranca con el primer reparto. Lo terminado antes no cuenta.";
  return `Se mide desde el ${diaCorto(inicio)}. Lo terminado antes no cuenta.`;
}
