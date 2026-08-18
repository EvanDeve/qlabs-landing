import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StaffRole } from "@/lib/database.types";
import { diaCR, sumarDias } from "@/lib/ugc/calendar";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";

/**
 * El estado de la agencia, en un solo lugar.
 *
 * Esto vivía suelto dentro del Dashboard (`/ugc/admin/page.tsx`, 493 líneas) y
 * salió de ahí cuando McLovin tuvo que contestar lo mismo por WhatsApp. El
 * motivo de extraerlo y no reescribirlo aparte: "atrasada", "por debajo del
 * ritmo" y "publicados del mes" son definiciones con filo —dependen de
 * `is_done`, de la zona horaria y de si el Hero está archivado— y dos copias se
 * separan sin que nadie lo note. Un reporte de WhatsApp que contradice al
 * tablero es peor que no tener reporte: la gente deja de creerle a los dos.
 *
 * El equipo entra por parámetro y no se consulta acá a propósito: el Dashboard
 * lo lee de la vista `staff_directory` (con la sesión del usuario) y McLovin de
 * `staff_members` (con service-role), porque la vista filtra por
 * `current_app_role() = 'admin'` y con service-role no devuelve nada. El
 * permiso es del que llama, no de este módulo.
 */

/** Arriba de esto, alguien tiene demasiadas piezas activas encima. */
export const TOPE_CARGA = 6;

/**
 * La meta de videos de un Hero para un mes. La comparten el Dashboard y McLovin.
 *
 * Antes era `agency_clients.monthly_target`: un número suelto en el expediente
 * del Hero, escrito una vez y nunca más mirado. Ahora manda el cronograma, que
 * es donde el mes se decide de verdad y lo aprueba el cliente.
 *
 * Tres estados, y los tres significan cosas distintas:
 *
 * - **Sin cronograma del mes → null.** No es "meta cero", es "todavía no se
 *   acordó nada". Mostrar 0 haría que un Hero sin planificar aparezca como si
 *   estuviera cumpliendo perfecto.
 * - **Cronograma pendiente → el conteo vivo de sus videos.** Se está armando,
 *   así que el número se mueve con cada fila. Sirve igual: ya dice cuánto se le
 *   va a pedir al mes.
 * - **Cronograma aprobado → el número sellado.** Es lo que el cliente aceptó, y
 *   no puede bajar porque alguien borre una tarjeta después.
 *
 * ⚠️ El caso raro que hay que respetar: los cronogramas aprobados ANTES de que
 * existiera todo esto (los de julio y agosto de 2026) tienen `target` en null y
 * cero videos cargados. Ésos son "sin meta", no "meta cero" — si no, los seis
 * Heroes de agosto aparecerían cumpliendo una meta de cero.
 */
export function metaDelMes(
  cronograma: { status: string; target: number | null } | undefined,
  videosPlanificados: number
): number | null {
  if (!cronograma) return null;

  if (cronograma.status === "aprobado") {
    if (cronograma.target != null) return cronograma.target;
    return videosPlanificados > 0 ? videosPlanificados : null;
  }

  return videosPlanificados > 0 ? videosPlanificados : null;
}

/**
 * Qué tan mal está un Hero este mes. La comparten el Dashboard y McLovin.
 *
 * Vive acá y no en cada uno porque es un JUICIO, no un dato: el orden de los
 * `else if` decide si "publicó poco pero tiene cronograma" es peor que "publicó
 * bien pero sin cronograma". Con dos copias, el día que alguien afine el umbral
 * en la pantalla, el WhatsApp sigue diciendo lo de antes y los dos números se
 * contradicen sin que nadie sepa cuál creer.
 */
export function riesgoDeHero(datos: {
  publicados: number;
  esperado: number;
  deficit: number;
  cronogramaAprobado: boolean;
}): "alto" | "medio" | "bajo" {
  if (datos.publicados === 0) return "alto";
  if (datos.deficit > datos.esperado * 0.5) return "alto";
  if (!datos.cronogramaAprobado) return "medio";
  if (datos.deficit > 0) return "medio";
  return "bajo";
}

export type MiembroReporte = { profileId: string; nombre: string; rol: StaffRole };

export type HeroReporte = {
  nombre: string;
  meta: number | null;
  publicados: number;
  restantes: number | null;
  /** Meta × (día del mes / días del mes) − publicados. Proyectado, no vencido. */
  deficit: number;
  cronogramaAprobado: boolean;
  riesgo: "alto" | "medio" | "bajo" | null;
};

export type PiezaReporte = { titulo: string; hero: string; fecha: string | null; responsable: string | null };

export type CargaReporte = {
  nombre: string;
  rol: string;
  activas: number;
  sobrecargado: boolean;
  atrasadas: PiezaReporte[];
  estaSemana: PiezaReporte[];
};

export type Reporte = {
  mes: string;
  diasQueQuedan: number;
  metaTotal: number;
  publicadosTotal: number;
  restantesTotal: number;
  esperadoTotal: number;
  cronogramasAprobados: number;
  heroesActivos: number;
  /** Ordenados por riesgo: primero el que peor está. */
  heroes: HeroReporte[];
  atrasadas: PiezaReporte[];
  pendientesAprobacion: number;
  publicanEstaSemana: number;
  sinFecha: number;
  carga: CargaReporte[];
};

export async function getReporte(
  supabase: SupabaseClient<Database>,
  equipo: MiembroReporte[],
  now: Date = new Date()
): Promise<Reporte> {
  // Todo se compara como día de Costa Rica. Ver la migración 20260801000000:
  // con la fecha del servidor (UTC en Vercel), entre las 18:00 y la medianoche
  // de CR el mes y las atrasadas salen corridos un día.
  const hoyCR = diaCR(now);
  const en7DiasCR = diaCR(sumarDias(now, 7));
  const mesCR = hoyCR.slice(0, 7);
  const diaDelMes = Number(hoyCR.slice(8, 10));
  const diasDelMes = new Date(Date.UTC(Number(hoyCR.slice(0, 4)), Number(hoyCR.slice(5, 7)), 0)).getUTCDate();
  const fraccionDelMes = diaDelMes / diasDelMes;

  const [{ data: clientes }, { data: piezasCrudas }, { data: meses }, { data: columnas }, { data: planificados }] =
    await Promise.all([
      supabase.from("agency_clients").select("id, name, archived"),
      supabase.from("content_pieces").select("id, title, brand_id, column_id, owner_id, publish_date"),
      supabase.from("hero_calendar_months").select("hero_id, status, target").eq("month", `${mesCR}-01`),
      supabase.from("content_columns").select("id, is_done, is_pending_approval"),
      // Los videos del cronograma de este mes: son la meta mientras siga
      // pendiente. Ver metaDelMes.
      supabase.from("calendar_month_items").select("hero_id").eq("month", `${mesCR}-01`),
    ]);

  // El filtro de archivados se aplica UNA vez, como en el Dashboard: filtrar
  // caso por caso es cómo un número se queda viejo y contradice a los otros.
  const archivados = new Set((clientes ?? []).filter((c) => c.archived).map((c) => c.id));
  // Sin Hero no hay Hero archivado: una tarea interna se queda en el reporte.
  const piezas = (piezasCrudas ?? []).filter((p) => !p.brand_id || !archivados.has(p.brand_id));
  const heroes = (clientes ?? []).filter((c) => !c.archived);
  const nombreDeHero = new Map((clientes ?? []).map((c) => [c.id, c.name]));
  const nombreDePersona = new Map(equipo.map((m) => [m.profileId, m.nombre]));

  // Qué cuenta como publicado lo declara la columna y NUNCA su nombre: el
  // equipo las renombra y estas cuentas tienen que seguir dando lo mismo.
  const terminadas = new Set((columnas ?? []).filter((c) => c.is_done).map((c) => c.id));
  const deAprobacion = new Set((columnas ?? []).filter((c) => c.is_pending_approval).map((c) => c.id));
  const activas = piezas.filter((p) => !terminadas.has(p.column_id));
  const cronogramaPorHero = new Map((meses ?? []).map((r) => [r.hero_id, r]));

  const planificadosPorHero = new Map<string, number>();
  for (const p of planificados ?? []) {
    planificadosPorHero.set(p.hero_id, (planificadosPorHero.get(p.hero_id) ?? 0) + 1);
  }

  const pieza = (p: (typeof piezas)[number]): PiezaReporte => ({
    titulo: p.title,
    hero: (p.brand_id ? nombreDeHero.get(p.brand_id) : null) ?? "sin Hero",
    fecha: p.publish_date ? diaCR(p.publish_date) : null,
    responsable: p.owner_id ? (nombreDePersona.get(p.owner_id) ?? null) : null,
  });

  const estadoDeHero = heroes.map((hero): HeroReporte => {
    const publicados = piezas.filter(
      (p) =>
        p.brand_id === hero.id &&
        terminadas.has(p.column_id) &&
        p.publish_date &&
        diaCR(p.publish_date).slice(0, 7) === mesCR
    ).length;
    const cronograma = cronogramaPorHero.get(hero.id);
    const cronogramaAprobado = cronograma?.status === "aprobado";
    const meta = metaDelMes(cronograma, planificadosPorHero.get(hero.id) ?? 0);

    if (meta == null) {
      return { nombre: hero.name, meta: null, publicados, restantes: null, deficit: 0, cronogramaAprobado, riesgo: null };
    }

    const esperado = +(meta * fraccionDelMes).toFixed(1);
    const deficit = +(esperado - publicados).toFixed(1);
    const riesgo = riesgoDeHero({ publicados, esperado, deficit, cronogramaAprobado });

    return {
      nombre: hero.name,
      meta,
      publicados,
      restantes: Math.max(meta - publicados, 0),
      deficit,
      cronogramaAprobado,
      riesgo,
    };
  });

  const ordenRiesgo = { alto: 0, medio: 1, bajo: 2 } as const;
  const conMeta = estadoDeHero.filter((h) => h.meta != null);

  const atrasadas = activas.filter((p) => p.publish_date && diaCR(p.publish_date) < hoyCR);
  const estaSemana = piezas.filter(
    (p) => p.publish_date && diaCR(p.publish_date) >= hoyCR && diaCR(p.publish_date) <= en7DiasCR
  );

  const carga = equipo.map((m): CargaReporte => {
    const suyas = activas.filter((p) => p.owner_id === m.profileId);
    return {
      nombre: m.nombre,
      rol: STAFF_ROLE_LABEL[m.rol],
      activas: suyas.length,
      sobrecargado: suyas.length > TOPE_CARGA,
      atrasadas: atrasadas.filter((p) => p.owner_id === m.profileId).map(pieza),
      estaSemana: estaSemana.filter((p) => p.owner_id === m.profileId).map(pieza),
    };
  });

  return {
    mes: now.toLocaleDateString("es-CR", { month: "long", timeZone: "America/Costa_Rica" }),
    diasQueQuedan: diasDelMes - diaDelMes,
    metaTotal: conMeta.reduce((s, h) => s + (h.meta ?? 0), 0),
    publicadosTotal: estadoDeHero.reduce((s, h) => s + h.publicados, 0),
    restantesTotal: conMeta.reduce((s, h) => s + (h.restantes ?? 0), 0),
    esperadoTotal: Math.round(conMeta.reduce((s, h) => s + (h.meta ?? 0), 0) * fraccionDelMes),
    cronogramasAprobados: estadoDeHero.filter((h) => h.cronogramaAprobado).length,
    heroesActivos: heroes.length,
    heroes: [...estadoDeHero].sort(
      (a, b) =>
        (a.riesgo ? ordenRiesgo[a.riesgo] : 3) - (b.riesgo ? ordenRiesgo[b.riesgo] : 3) ||
        a.nombre.localeCompare(b.nombre)
    ),
    atrasadas: atrasadas.map(pieza).sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "")),
    pendientesAprobacion: activas.filter((p) => deAprobacion.has(p.column_id)).length,
    publicanEstaSemana: estaSemana.length,
    sinFecha: activas.filter((p) => !p.publish_date).length,
    carga,
  };
}

/** Cuántas piezas se nombran por bloque. El reporte entero viaja en el prompt. */
const TOPE_LISTA = 12;

function listar(piezas: PiezaReporte[]): string {
  const visibles = piezas.slice(0, TOPE_LISTA).map((p) => `"${p.titulo}" (${p.hero}${p.fecha ? `, ${p.fecha}` : ""})`);
  const resto = piezas.length - visibles.length;
  return visibles.join("; ") + (resto > 0 ? ` y ${resto} más` : "");
}

/**
 * El reporte tal como se lo mostramos al modelo.
 *
 * Se le pasa TODO de una y no se le da forma de respuesta: el director puede
 * preguntar por el estado general, por un Hero o por una persona, y las tres
 * salen de acá sin otra consulta. Los conteos van explícitos —"3 de 9"— para
 * que el modelo no tenga que contar, que es donde se equivoca.
 */
export function describirReporte(r: Reporte): string {
  const bloques: string[] = [];

  bloques.push(
    `EL MES (${r.mes}, quedan ${r.diasQueQuedan} días)
Meta ${r.metaTotal} videos · publicados ${r.publicadosTotal} · faltan ${r.restantesTotal}. A esta altura del mes lo esperado sería ${r.esperadoTotal}.
Cronogramas aprobados: ${r.cronogramasAprobados} de ${r.heroesActivos} Heroes.`
  );

  bloques.push(
    `NÚMEROS DE HOY
Piezas atrasadas: ${r.atrasadas.length} · esperando aprobación del cliente: ${r.pendientesAprobacion} · publican en 7 días: ${r.publicanEstaSemana} · activas sin fecha: ${r.sinFecha}.`
  );

  const porHero = r.heroes.map((h) => {
    if (h.meta == null) return `- ${h.nombre}: sin meta mensual cargada. Publicados este mes: ${h.publicados}.`;
    const cron = h.cronogramaAprobado ? "cronograma aprobado" : "SIN cronograma aprobado";
    const ritmo = h.deficit > 0 ? `va ${h.deficit} por debajo del ritmo` : "al día con el ritmo";
    return `- ${h.nombre}: ${h.publicados}/${h.meta} publicados, faltan ${h.restantes}, ${ritmo}, ${cron}. Riesgo ${h.riesgo}.`;
  });
  bloques.push(`CADA HERO (del que peor está al que mejor)\n${porHero.join("\n")}`);

  if (r.atrasadas.length) bloques.push(`ATRASADAS (${r.atrasadas.length})\n${listar(r.atrasadas)}`);

  const porPersona = r.carga.map((c) => {
    const partes = [`${c.activas} activas`];
    if (c.sobrecargado) partes.push(`SOBRECARGADO, más de ${TOPE_CARGA}`);
    if (c.atrasadas.length) partes.push(`${c.atrasadas.length} atrasadas: ${listar(c.atrasadas)}`);
    if (c.estaSemana.length) partes.push(`publica esta semana: ${listar(c.estaSemana)}`);
    return `- ${c.nombre} (${c.rol}): ${partes.join(" · ")}`;
  });
  bloques.push(`EL EQUIPO\n${porPersona.join("\n")}`);

  return bloques.join("\n\n");
}
