import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleCalendarMonthAction } from "@/lib/actions/heroes";
import { QosIcon } from "@/lib/ugc/qos-icons";
import { coloresDeHeroes } from "@/lib/ugc/content-meta";
import { diaCR, diaCorto, sumarDias } from "@/lib/ugc/calendar";
import { riesgoDeHero, metaDelMes } from "@/lib/ugc/reporte";
// El selector de mes vive en la barra superior (lo monta el layout), no acá.
import { mesCR as mesCRDe, parseMes, diasDelMes, nombreDeMes } from "@/lib/ugc/cronograma";
import styles from "./qos.module.css";

export const dynamic = "force-dynamic";


export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const supabase = await createClient();

  const now = new Date();
  const in7Days = sumarDias(now, 7);

  // Todo se compara como día de Costa Rica en 'yyyy-MM-dd'.
  //
  // Antes esto usaba `new Date(...)` y `now.getFullYear()/getMonth()/getDate()`,
  // que devuelven la fecha de la ZONA DEL SERVIDOR — en Vercel, UTC. Entre las
  // 18:00 y la medianoche de Costa Rica el servidor ya está en el día
  // siguiente, así que el dashboard mostraba el mes y las piezas atrasadas
  // corridos un día todas las tardes. Ver la migración 20260801000000.
  const hoyCR = diaCR(now);
  const en7DiasCR = diaCR(in7Days);

  // El Pase de servicio mira UN mes, elegido con el select. El resto del
  // Dashboard —atrasadas, agenda de la semana— es siempre sobre hoy: son
  // preguntas del presente y un selector ahí no significaría nada.
  const mesActual = mesCRDe(now);
  const monthKey = parseMes((await searchParams).mes) ?? mesActual;
  const esMesActual = monthKey === mesActual;
  const mesCR = monthKey.slice(0, 7);

  const daysInMonth = diasDelMes(monthKey);
  // Un mes ya cerrado se mide entero: a mitad de septiembre, el ritmo esperado
  // de agosto es el 100% de su meta, no la fracción del día de hoy. Con la
  // cuenta del mes en curso, todos los meses pasados saldrían cumpliendo.
  const dayOfMonth = esMesActual ? Number(hoyCR.slice(8, 10)) : daysInMonth;
  const monthFraction = dayOfMonth / daysInMonth;

  const [
    { data: agencyClients },
    { data: contentPieces },
    { data: calendarEvents },
    { data: calendarMonths },
    { data: contentColumns },
  ] = await Promise.all([
    supabase.from("agency_clients").select("*"),
    supabase.from("content_pieces").select("*").order("publish_date", { ascending: true }),
    supabase
      .from("calendar_events")
      .select("*")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", in7Days.toISOString()),
    supabase.from("hero_calendar_months").select("hero_id, status, target").eq("month", monthKey),
    supabase.from("content_columns").select("*").order("position", { ascending: true }),
  ]);

  // Los videos del cronograma del mes elegido: son la meta mientras el
  // cronograma siga pendiente. Ver metaDelMes en reporte.ts.
  const { data: planificados } = await supabase
    .from("calendar_month_items")
    .select("hero_id")
    .eq("month", monthKey);

  const brandNameByProfileId = new Map((agencyClients ?? []).map((c) => [c.id, c.name]));
  // El mismo reparto de colores que usa el filtro del Pipeline, así que un Hero
  // sin logo se ve del mismo color en las dos pantallas.
  const colorPorHero = coloresDeHeroes((agencyClients ?? []).map((c) => c.id));

  // ---- Heroes archivados ----
  // El filtro se aplica UNA vez acá y no en cada cálculo, porque todo lo de
  // abajo —KPIs, Pase de servicio, atrasadas, agenda de la semana— sale de
  // `pieces` y de `heroesManaged`. Filtrar caso por caso es cómo un número se
  // queda sin actualizar y contradice a los otros tres.
  //
  // brandNameByProfileId se arma con TODOS a propósito (arriba): si alguna
  // pieza archivada se llegara a mostrar, tiene que decir de qué marca es.
  const archivedHeroIds = new Set(
    (agencyClients ?? []).filter((c) => c.archived).map((c) => c.id)
  );
  const pieces = (contentPieces ?? []).filter((p) => !p.brand_id || !archivedHeroIds.has(p.brand_id));
  const columns = contentColumns ?? [];
  // Qué cuenta como publicado y qué como pendiente de aprobación lo declara la
  // columna, NO su nombre: el equipo puede renombrarlas y estas cuentas —de las
  // que salen meta, ritmo y riesgo del Pase de servicio— tienen que seguir
  // dando lo mismo.
  const doneColumnIds = new Set(columns.filter((c) => c.is_done).map((c) => c.id));
  // Lo que cuenta como PUBLICADO es la columna final del carril de video y solo
  // esa. Los otros carriles también cierran en una columna is_done, así que sin
  // este corte una tarea de IT terminada —o un cronograma aprobado— entraría en
  // los publicados del mes de su Hero.
  const publishedColumnIds = new Set(
    columns.filter((c) => c.is_done && c.section === "video").map((c) => c.id)
  );
  const approvalColumnIds = new Set(
    columns.filter((c) => c.is_pending_approval).map((c) => c.id)
  );
  // "Terminado" es el video que ya está hecho pero todavía no salió. Se
  // reconoce por `is_ready` y no por el nombre, igual que el resto: la columna
  // se llama así hoy y el equipo puede renombrarla mañana.
  const readyColumnIds = new Set(columns.filter((c) => c.is_ready).map((c) => c.id));
  const activePieces = pieces.filter((p) => !doneColumnIds.has(p.column_id));

  const heroesManaged = (agencyClients ?? []).filter((c) => !c.archived);

  // ---- Pase de servicio: progreso del mes por Hero ----
  const calendarByHeroId = new Map((calendarMonths ?? []).map((r) => [r.hero_id, r]));

  const plannedByHeroId = new Map<string, number>();
  for (const p of planificados ?? []) {
    plannedByHeroId.set(p.hero_id, (plannedByHeroId.get(p.hero_id) ?? 0) + 1);
  }

  const publishedThisMonth = (heroId: string) =>
    pieces.filter(
      (p) =>
        p.brand_id === heroId &&
        publishedColumnIds.has(p.column_id) &&
        p.publish_date &&
        diaCR(p.publish_date).slice(0, 7) === mesCR
    ).length;

  const heroStats = heroesManaged.map((hero) => {
    const published = publishedThisMonth(hero.id);
    const calendar = calendarByHeroId.get(hero.id);
    const calendarApproved = calendar?.status === "aprobado";
    // La meta sale del cronograma, no de un número suelto en el expediente.
    // La fórmula vive en reporte.ts por lo mismo que riesgoDeHero: McLovin
    // responde el mismo número por WhatsApp.
    const target = metaDelMes(calendar, plannedByHeroId.get(hero.id) ?? 0);

    // "No hay cronograma" y "hay cronograma sin aprobar" dejaron de ser lo
    // mismo. Antes daba igual —la meta salía del expediente— pero ahora el
    // cronograma ES la meta, así que su ausencia es el problema a mostrar.
    const sinCronograma = !calendar;

    if (target == null) {
      return { hero, target: null, published, remaining: null, deficit: 0, calendarApproved, sinCronograma, risk: null };
    }

    // Ritmo esperado proporcional al día del mes (meta × día/días del mes).
    const expected = +(target * monthFraction).toFixed(1);
    const deficit = +(expected - published).toFixed(1);

    // La fórmula vive en reporte.ts porque McLovin contesta lo mismo por
    // WhatsApp: con una copia acá, afinar el umbral en esta pantalla dejaría al
    // agente diciendo lo de antes y los dos números se contradicen.
    const risk = riesgoDeHero({ publicados: published, esperado: expected, deficit, cronogramaAprobado: calendarApproved });

    return {
      hero,
      target,
      published,
      remaining: Math.max(target - published, 0),
      deficit,
      calendarApproved,
      sinCronograma,
      risk,
    };
  });

  const riskOrder = { alto: 0, medio: 1, bajo: 2 } as const;
  const sortedHeroStats = [...heroStats].sort(
    (a, b) =>
      (a.risk ? riskOrder[a.risk] : 3) - (b.risk ? riskOrder[b.risk] : 3) || a.hero.name.localeCompare(b.hero.name)
  );

  const withTarget = heroStats.filter((s) => s.target != null);
  const metaTotal = withTarget.reduce((sum, s) => sum + (s.target ?? 0), 0);
  const publishedTotal = heroStats.reduce((sum, s) => sum + s.published, 0);
  const remainingTotal = withTarget.reduce((sum, s) => sum + (s.remaining ?? 0), 0);
  const expectedTotal = Math.round(metaTotal * monthFraction);
  // El mes que se está MIRANDO, no el de hoy. Salía de `now`, así que con el
  // selector puesto en julio los subtítulos y los tooltips seguían diciendo
  // "agosto" al lado de números que sí eran de julio: el número correcto con la
  // etiqueta equivocada es peor que ninguno de los dos.
  const monthName = nombreDeMes(monthKey);
  const daysLeft = daysInMonth - dayOfMonth;

  const overduePieces = activePieces.filter((p) => p.publish_date && diaCR(p.publish_date) < hoyCR);
  const pendingApprovalPieces = activePieces.filter(
    (p) => approvalColumnIds.has(p.column_id)
  );
  const publishingThisWeekPieces = pieces.filter(
    (p) => p.publish_date && diaCR(p.publish_date) >= hoyCR && diaCR(p.publish_date) <= en7DiasCR
  );

  // Videos hechos que todavía no salieron, del mes que se está mirando.
  //
  // Hasta el 2026-08-14 esto era la cola entera, sin fecha: el número no se
  // movía al cambiar de mes y no se podía sumar con "Publicados", que sí es
  // mensual.
  //
  // Un video terminado SIN fecha no cae en ningún mes, así que no entra en el
  // conteo — pero tampoco puede desaparecer: la columna existe justamente para
  // decir "ya está hecho, falta la fecha" (ver `is_ready`). Se cuentan aparte y
  // el KPI los muestra como pendiente, que es lo que son.
  const readyByColumn = pieces.filter((p) => readyColumnIds.has(p.column_id));
  const readyPieces = readyByColumn.filter(
    (p) => p.publish_date && diaCR(p.publish_date).slice(0, 7) === mesCR
  );
  const readySinFecha = readyByColumn.filter((p) => !p.publish_date);

  /**
   * Las ocho tarjetas de números, en un solo array y en orden.
   *
   * Antes eran dos listas con formas distintas —la de arriba sin subtítulo, la
   * de abajo con— y eso ataba el orden: mover una tarjeta de fila significaba
   * moverla de estructura. Unificadas, el orden es solo el del array.
   *
   * La primera fila es lo que está en movimiento y puede necesitar una
   * decisión hoy. La segunda es trabajo que ya no se toca: "terminados",
   * "publicados" y su suma van pegadas a propósito —son estados distintos, uno
   * está hecho y el otro ya salió— y leerlas juntas es lo que dice si hay cola
   * esperando publicación.
   *
   * La CUARTA columna es el mes: "meta" arriba y "restantes" abajo quedan una
   * sobre la otra, que es como se leen.
   */
  const kpis: {
    label: string;
    value: number | string;
    sub: string;
    /** Segunda línea, en ámbar: algo que el número deja afuera y hay que resolver. */
    alert?: string | null;
    icon: string;
    color: string;
  }[] = [
    {
      label: "Piezas atrasadas",
      value: overduePieces.length,
      sub: "la fecha de publicación ya pasó",
      icon: "alert",
      color: "#df4650",
    },
    {
      label: "Pend. aprobación",
      value: pendingApprovalPieces.length,
      sub: "esperando al cliente",
      icon: "clock",
      color: "#c07414",
    },
    {
      label: "Publican esta semana",
      value: publishingThisWeekPieces.length,
      sub: "próximos 7 días",
      icon: "calendar",
      color: "#6d54f3",
    },
    {
      label: "Meta del mes",
      value: metaTotal,
      // "paquete definido" era el lenguaje de monthly_target, que ya no existe:
      // la meta ahora sale del cronograma.
      sub: `${withTarget.length} de ${heroesManaged.length} heroes con cronograma`,
      icon: "flag",
      color: "#6d54f3",
    },

    {
      label: "Videos terminados",
      value: readyPieces.length,
      sub: `hechos en ${monthName}, sin publicar`,
      // Los que no tienen fecha no entran en el número, pero se avisan: son
      // trabajo hecho que hoy no cuenta en ningún lado, y ponerles fecha es lo
      // que los devuelve a la cuenta.
      alert:
        readySinFecha.length > 0
          ? `${readySinFecha.length} terminado${readySinFecha.length === 1 ? "" : "s"} sin fecha`
          : null,
      icon: "film",
      color: "#2aa5c0",
    },
    {
      label: "Publicados",
      value: publishedTotal,
      sub: `ritmo esperado a hoy: ~${expectedTotal}`,
      icon: "check",
      color: "#14a06a",
    },
    {
      // La suma de las dos de al lado, ni más ni menos: es lo que pidió el
      // equipo para saber cuánto hay listo sin importar si ya salió.
      //
      // ⚠️ Las dos NO cuentan sobre el mismo período —"terminados" es la cola
      // entera y "publicados" es del mes del selector—, así que este número
      // tampoco. Se eligió a sabiendas (2026-08-14): que el total cuadre con
      // los dos números que tiene al lado pesa más que la pureza, porque un KPI
      // que no se puede sumar con el dedo es un KPI en el que nadie confía.
      label: "Finalizados",
      value: readyPieces.length + publishedTotal,
      sub: "terminados + publicados",
      icon: "briefcase",
      color: "#5a41e0",
    },
    {
      label: "Restantes",
      value: remainingTotal,
      sub: `quedan ${daysLeft} días de ${monthName}`,
      icon: "clock",
      color: "#c07414",
    },
  ];

  const weekAgendaItems = [
    ...pieces
      .filter((p) => p.publish_date && diaCR(p.publish_date) >= hoyCR && diaCR(p.publish_date) <= en7DiasCR)
      .map((p) => ({ date: p.publish_date as string, title: p.title, type: "Publicación", brandId: p.brand_id })),
    ...pieces
      .filter((p) => p.record_date && diaCR(p.record_date) >= hoyCR && diaCR(p.record_date) <= en7DiasCR)
      .map((p) => ({ date: p.record_date as string, title: p.title, type: "Grabación", brandId: p.brand_id })),
    // Los eventos de un Hero archivado tampoco: la agenda de la semana es lo
    // que hay que hacer, y con un cliente que se fue no hay nada que hacer.
    ...(calendarEvents ?? [])
      .filter((e) => !e.brand_id || !archivedHeroIds.has(e.brand_id))
      .map((e) => ({
        date: e.starts_at,
        title: e.title,
        type: e.type,
        brandId: e.brand_id,
      })),
    // Conviven días sueltos (piezas) e instantes (eventos): se ordena por día
    // de CR, nunca restando los instantes.
  ].sort((a, b) => diaCR(a.date).localeCompare(diaCR(b.date)));

  return (
    /* `dashFull` es el marcador que hace que la pantalla entre en la ventana:
       el layout lo detecta con `:has()` y reparte el alto hasta acá, así que
       lo que scrollea es cada panel y no la página. Mismo patrón que
       `pipeWide` en el Pipeline — el layout no conoce rutas. */
    <div className={styles.dashFull}>
      {/* Una sola grilla sobre `kpis`. La fila la corta el grid a los 4 por
          ancho, no dos contenedores distintos — así reordenar es mover una
          entrada del array y nada más. */}
      <div className={styles.kpiRow}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={styles.kpi}>
            <div className={styles.kTop}>
              <div className={styles.kIc} style={{ background: `${kpi.color}22`, color: kpi.color }}>
                <QosIcon name={kpi.icon} size={16} />
              </div>
              <div className={styles.kLabel}>{kpi.label}</div>
            </div>
            <div className={styles.kNum} style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div className={styles.kSub}>{kpi.sub}</div>
            {kpi.alert && (
              <div className={styles.kAlert}>
                <QosIcon name="alert" size={12} />
                {kpi.alert}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.dashGrid}>
        <div className={`${styles.card} ${styles.cardScroll}`}>
          {/* El encabezado queda fuera del cuerpo que scrollea: si viajara con
              las filas, al bajar la lista se perdería de qué habla la tarjeta. */}
          <div className={styles.cardScrollHead}>
            {/* El selector de mes NO va acá: vive en la barra superior, al lado
                de la campanita. Encuadra la pantalla entera —de qué mes estamos
                hablando— y no es un filtro de esta tarjeta. */}
            <div className={styles.sectionHead}>
              <h2>Estado de las cuentas</h2>
              <div className={styles.sectionHeadAct}>
                <Link href="/ugc/admin/heroes" className={styles.linkMore}>
                  Ver todas
                </Link>
              </div>
            </div>

            {/* Solo cuando se está mirando otro mes: en el mes en curso el
                encabezado ya lo dice y el aviso sería ruido permanente. */}
            {!esMesActual && (
              <p className={styles.formNote} style={{ marginTop: "-6px", marginBottom: "12px" }}>
                Estás viendo <strong style={{ textTransform: "capitalize" }}>{nombreDeMes(monthKey)}</strong>. El
                ritmo se mide sobre el mes completo, no sobre el día de hoy.
              </p>
            )}
          </div>

          <div className={styles.cardScrollBody}>
            <table className={styles.acctTable}>
              <thead>
                <tr>
                  <th>Hero</th>
                  <th>Calendario</th>
                  <th>Publ.</th>
                  <th style={{ textAlign: "right" }}>Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {sortedHeroStats.map(({ hero, target, published, deficit, calendarApproved, sinCronograma, risk }) => (
                  <tr key={hero.id}>
                    <td>
                      <Link href={`/ugc/admin/heroes/${hero.id}`} className={styles.acctHero}>
                        {hero.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hero.logo_url} alt={hero.name} className={styles.heroMono} style={{ objectFit: "cover" }} />
                        ) : (
                          <span className={styles.heroMono} style={{ background: colorPorHero.get(hero.id) }}>
                            {hero.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        {hero.name}
                      </Link>
                    </td>
                    <td>
                      {/* Sin cronograma no hay nada que aprobar: el botón crearía
                          uno vacío y ya aprobado, con meta 0. Lleva a armarlo. */}
                      {sinCronograma ? (
                        <Link
                          href="/ugc/admin/cronogramas"
                          className={`${styles.calBtn} ${styles.calBtnPend}`}
                          title={`${hero.name} no tiene cronograma de ${monthName}`}
                        >
                          <span className={styles.dot} />
                          Sin cronograma
                        </Link>
                      ) : (
                        /* El mes va atado al botón: con el selector puesto, dar
                           por aprobado "el mes actual" mientras se mira agosto
                           tocaría el cronograma equivocado. */
                        <form action={toggleCalendarMonthAction.bind(null, hero.id, monthKey)}>
                          <button
                            type="submit"
                            className={`${styles.calBtn} ${calendarApproved ? styles.calBtnOk : styles.calBtnPend}`}
                            title={`Marcar cronograma de ${monthName} como ${calendarApproved ? "pendiente" : "aprobado"}`}
                          >
                            <span className={styles.dot} />
                            {calendarApproved ? "Aprobado" : "Pendiente"}
                          </button>
                        </form>
                      )}
                    </td>
                    <td className={styles.paceCell}>
                      {published}/{target ?? "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {risk ? (
                        <span
                          className={`${styles.riskPill} ${
                            risk === "alto" ? styles.riskRisk : risk === "medio" ? styles.riskWarn : styles.riskOk
                          }`}
                          /* El ritmo dejó de tener columna propia, pero es de
                             dónde sale este pill: sin el número, un "Medio" no
                             dice por cuánto. Va como tooltip. */
                          title={
                            deficit > 0
                              ? `Va ${deficit} por debajo del ritmo del mes`
                              : deficit < 0
                                ? `Va ${Math.abs(deficit)} por encima del ritmo del mes`
                                : "Al día con el ritmo del mes"
                          }
                        >
                          {risk === "alto" ? "Alto" : risk === "medio" ? "Medio" : "Bajo"}
                        </span>
                      ) : (
                        <span className={`${styles.riskPill} ${styles.riskMuted}`} title="Este Hero todavía no tiene cronograma del mes">
                          Sin meta
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardScroll}`}>
          <div className={styles.cardScrollHead}>
            <div className={styles.sectionHead}>
              <h2>Esta semana</h2>
              {weekAgendaItems.length > 0 && (
                <div className={styles.sectionHeadAct}>
                  <span className={styles.chip}>
                    {weekAgendaItems.length} {weekAgendaItems.length === 1 ? "pieza" : "piezas"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.cardScrollBody}>
            {weekAgendaItems.length > 0 ? (
              weekAgendaItems.map((item, i) => (
                <div key={i} className={styles.weekRow}>
                  <div className={styles.weekWhen}>
                    {diaCorto(item.date)}
                  </div>
                  <span className={styles.weekType} style={{ background: "#6d54f3" }} />
                  <div className={styles.weekBody}>
                    {item.title}
                    <small>
                      {item.type}
                      {item.brandId && ` · ${brandNameByProfileId.get(item.brandId)}`}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No hay eventos en los próximos 7 días.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
