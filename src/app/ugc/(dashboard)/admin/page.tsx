import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleCalendarMonthAction } from "@/lib/actions/heroes";
import { STAFF_ROLE_LABEL } from "@/lib/ugc/content-meta";
import { QosIcon } from "@/lib/ugc/qos-icons";
import StaffAvatar from "@/components/ugc/admin/StaffAvatar";
import { diaCR, diaCorto, sumarDias } from "@/lib/ugc/calendar";
import { riesgoDeHero, TOPE_CARGA, metaDelMes } from "@/lib/ugc/reporte";
import { mesCR as mesCRDe, parseMes, diasDelMes, nombreDeMes, mesesAlrededor } from "@/lib/ugc/cronograma";
import SelectorDeMes from "@/components/ugc/admin/SelectorDeMes";
import styles from "./qos.module.css";

export const dynamic = "force-dynamic";

// El tope lo define reporte.ts: McLovin dice "SOBRECARGADO" con el mismo número.
const OVERLOAD_THRESHOLD = TOPE_CARGA;

const KPI_COLORS = ["#6d54f3", "#df4650", "#c07414", "#14a06a"];
const KPI_ICONS = ["users", "alert", "check", "calendar"];

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
  // Dashboard —atrasadas, agenda de la semana, carga del equipo— es siempre
  // sobre hoy: son preguntas del presente y un selector ahí no significaría
  // nada.
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
    { data: staffMembers },
    { data: calendarEvents },
    { data: calendarMonths },
    { data: contentColumns },
  ] = await Promise.all([
    supabase.from("agency_clients").select("*"),
    supabase.from("content_pieces").select("*").order("publish_date", { ascending: true }),
    // staff_directory y no staff_members: la tabla quedó cerrada a
    // directores porque guarda teléfonos y opt-in de WhatsApp. La vista
    // expone solo lo que el tablero necesita para pintar responsables.
    supabase.from("staff_directory").select("profile_id, staff_role, color").eq("active", true),
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

  const staffIds = (staffMembers ?? []).map((s) => s.profile_id);
  const { data: staffAccountProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", staffIds)
    : { data: [] };
  const staffNameById = new Map((staffAccountProfiles ?? []).map((p) => [p.id, p.display_name]));
  const staffAvatarById = new Map((staffAccountProfiles ?? []).map((p) => [p.id, p.avatar_url]));

  // ---- Heroes archivados ----
  // El filtro se aplica UNA vez acá y no en cada cálculo, porque todo lo de
  // abajo —KPIs, Pase de servicio, atrasadas, agenda de la semana, carga del
  // equipo— sale de `pieces` y de `heroesManaged`. Filtrar caso por caso es
  // cómo un número se queda sin actualizar y contradice a los otros tres.
  //
  // brandNameByProfileId se arma con TODOS a propósito (arriba): si alguna
  // pieza archivada se llegara a mostrar, tiene que decir de qué marca es.
  const archivedHeroIds = new Set(
    (agencyClients ?? []).filter((c) => c.archived).map((c) => c.id)
  );
  const pieces = (contentPieces ?? []).filter((p) => !archivedHeroIds.has(p.brand_id));
  const columns = contentColumns ?? [];
  const columnById = new Map(columns.map((c) => [c.id, c]));
  // Qué cuenta como publicado y qué como pendiente de aprobación lo declara la
  // columna, NO su nombre: el equipo puede renombrarlas y estas cuentas —de las
  // que salen meta, ritmo y riesgo del Pase de servicio— tienen que seguir
  // dando lo mismo.
  const doneColumnIds = new Set(columns.filter((c) => c.is_done).map((c) => c.id));
  const approvalColumnIds = new Set(
    columns.filter((c) => c.is_pending_approval).map((c) => c.id)
  );
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
        doneColumnIds.has(p.column_id) &&
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
  const approvedCount = heroStats.filter((s) => s.calendarApproved).length;
  const monthName = now.toLocaleDateString("es-CR", { month: "long" });
  const daysLeft = daysInMonth - dayOfMonth;

  // Los tres cuellos de botella cuentan HEROES, no piezas — y comparten lista
  // con "Requiere tu atención", donde cada fila SÍ es una pieza y el número de
  // la derecha es una columna del tablero. Con la misma forma visual, un
  // "Atrasados vs. ritmo · 1" se leía como "un video atrasado".
  //
  // Por eso cada etiqueta empieza con "Heroes" y el contador dice la unidad. Y
  // el de ritmo lleva además el déficit al lado de cada nombre: es un número
  // proyectado (meta × día del mes − publicados), no una fecha vencida, así que
  // sin verlo no hay forma de entender por qué ese Hero está en la lista.
  const bottlenecks = [
    {
      label: "Heroes sin ningún video este mes",
      color: "var(--risk)",
      heroes: withTarget.filter((s) => s.published === 0),
      detalle: null,
    },
    {
      label: "Heroes sin cronograma aprobado",
      color: "var(--warn)",
      heroes: heroStats.filter((s) => !s.calendarApproved),
      detalle: null,
    },
    {
      label: "Heroes por debajo del ritmo del mes",
      color: "var(--warn)",
      heroes: withTarget.filter((s) => s.published > 0 && s.deficit > 0),
      detalle: (s: (typeof heroStats)[number]) =>
        `${s.hero.name} (${s.published}/${s.target}, va ${s.deficit} por debajo)`,
    },
  ].filter((b) => b.heroes.length > 0);

  const overduePieces = activePieces.filter((p) => p.publish_date && diaCR(p.publish_date) < hoyCR);
  const pendingApprovalPieces = activePieces.filter(
    (p) => approvalColumnIds.has(p.column_id)
  );
  const publishingThisWeekPieces = pieces.filter(
    (p) => p.publish_date && diaCR(p.publish_date) >= hoyCR && diaCR(p.publish_date) <= en7DiasCR
  );

  const kpis = [
    { label: "Heroes", value: heroesManaged.length },
    { label: "Piezas atrasadas", value: overduePieces.length },
    { label: "Pend. aprobación", value: pendingApprovalPieces.length },
    { label: "Publican esta semana", value: publishingThisWeekPieces.length },
  ];

  const attentionItems = [
    ...overduePieces.map((p) => ({ piece: p, reason: "Publicación vencida", late: true })),
    ...pendingApprovalPieces
      .filter((p) => !overduePieces.includes(p))
      .map((p) => ({ piece: p, reason: "Esperando aprobación del cliente", late: false })),
  ].sort((a, b) => {
    // Las piezas sin fecha van al final: no hay nada que se les esté venciendo.
    const aDate = a.piece.publish_date ? diaCR(a.piece.publish_date) : "9999-12-31";
    const bDate = b.piece.publish_date ? diaCR(b.piece.publish_date) : "9999-12-31";
    return aDate.localeCompare(bDate);
  });

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

  const teamLoad = (staffMembers ?? []).map((staff) => {
    const count = activePieces.filter((p) => p.owner_id === staff.profile_id).length;
    return {
      profileId: staff.profile_id,
      name: staffNameById.get(staff.profile_id) ?? "Sin nombre",
      role: STAFF_ROLE_LABEL[staff.staff_role],
      color: staff.color,
      avatarUrl: staffAvatarById.get(staff.profile_id) ?? null,
      count,
      overloaded: count > OVERLOAD_THRESHOLD,
    };
  });

  const maxLoad = Math.max(1, ...teamLoad.map((t) => t.count));
  const overloadedStaff = teamLoad.filter((t) => t.overloaded);

  return (
    <div>
      <div className={styles.kpiRow}>
        {kpis.map((kpi, i) => (
          <div key={kpi.label} className={styles.kpi}>
            <div className={styles.kTop}>
              <div className={styles.kIc} style={{ background: `${KPI_COLORS[i]}22`, color: KPI_COLORS[i] }}>
                <QosIcon name={KPI_ICONS[i]} size={16} />
              </div>
              <div className={styles.kLabel}>{kpi.label}</div>
            </div>
            <div className={styles.kNum} style={{ color: KPI_COLORS[i] }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.kpiRow}>
        {[
          {
            label: "Meta del mes",
            value: metaTotal,
            sub: `${withTarget.length} de ${heroesManaged.length} heroes con paquete definido`,
            icon: "flag",
            color: "#6d54f3",
          },
          {
            label: "Publicados",
            value: publishedTotal,
            sub: `ritmo esperado a hoy: ~${expectedTotal}`,
            icon: "check",
            color: "#14a06a",
          },
          {
            label: "Restantes",
            value: remainingTotal,
            sub: `quedan ${daysLeft} días de ${monthName}`,
            icon: "clock",
            color: "#c07414",
          },
          {
            label: "Calendarios aprobados",
            value: `${approvedCount}/${heroesManaged.length}`,
            sub: `cronogramas de ${monthName}`,
            icon: "calendar",
            color: "#2aa5c0",
          },
        ].map((card) => (
          <div key={card.label} className={styles.kpi}>
            <div className={styles.kTop}>
              <div className={styles.kIc} style={{ background: `${card.color}22`, color: card.color }}>
                <QosIcon name={card.icon} size={16} />
              </div>
              <div className={styles.kLabel}>{card.label}</div>
            </div>
            <div className={styles.kNum} style={{ color: card.color }}>
              {card.value}
            </div>
            <div className={styles.kSub}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.dashGrid}>
        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionHeadBig}>Requiere tu atención</h2>
              <span className={`${styles.chip} ${styles.riskRisk}`}>
                {bottlenecks.length + attentionItems.length} items
              </span>
            </div>
            {bottlenecks.map((b) => (
              <div key={b.label} className={styles.attnItem} style={{ cursor: "default" }}>
                <div className={styles.attnBar} style={{ background: b.color }} />
                <div className={styles.attnBody}>
                  <div className={styles.attnTitle}>{b.label}</div>
                  <div className={styles.attnMeta}>
                    {b.heroes.map((s) => b.detalle?.(s) ?? s.hero.name).join(", ")}
                  </div>
                </div>
                <span className={styles.tag}>
                  {b.heroes.length} {b.heroes.length === 1 ? "Hero" : "Heroes"}
                </span>
              </div>
            ))}
            {attentionItems.length > 0 ? (
              attentionItems.map(({ piece, reason, late }) => (
                <Link key={piece.id} href={`/ugc/admin/heroes/${piece.brand_id}`} className={styles.attnItem}>
                  <div className={styles.attnBar} style={{ background: late ? "var(--risk)" : "var(--warn)" }} />
                  <div className={styles.attnBody}>
                    <div className={styles.attnTitle}>{piece.title}</div>
                    <div className={styles.attnMeta}>
                      <span>{brandNameByProfileId.get(piece.brand_id)}</span>
                      <span>·</span>
                      <span style={{ color: late ? "var(--risk)" : "var(--warn)", fontWeight: 600 }}>{reason}</span>
                    </div>
                  </div>
                  <div className={styles.attnRight}>
                    <span className={styles.tag}>{columnById.get(piece.column_id)?.name ?? "—"}</span>
                    <QosIcon name="chevR" size={16} />
                  </div>
                </Link>
              ))
            ) : bottlenecks.length === 0 ? (
              <div className={styles.empty}>Nada pendiente por ahora.</div>
            ) : null}
          </div>

          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2>Estado de las cuentas</h2>
              <div className={styles.sectionHeadAct}>
                <SelectorDeMes
                  meses={mesesAlrededor(now).map((m) => ({ valor: m, label: nombreDeMes(m) }))}
                  actual={monthKey}
                />
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

            <table className={styles.acctTable}>
              <thead>
                <tr>
                  <th>Hero</th>
                  <th>Calendario</th>
                  <th>Publicados</th>
                  <th>Rest.</th>
                  <th>Ritmo</th>
                  <th style={{ textAlign: "right" }}>Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {sortedHeroStats.map(({ hero, target, published, remaining, deficit, calendarApproved, sinCronograma, risk }) => (
                  <tr key={hero.id}>
                    <td>
                      <Link href={`/ugc/admin/heroes/${hero.id}`} className={styles.acctHero}>
                        {hero.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={hero.logo_url} alt={hero.name} className={styles.heroMono} style={{ objectFit: "cover" }} />
                        ) : (
                          <span className={styles.heroMono} style={{ background: staffColorFromString(hero.id) }}>
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
                    <td className={styles.paceCell}>{remaining ?? "—"}</td>
                    <td>
                      {target != null ? (
                        <span className={`${styles.paceCell} ${deficit > 0 ? styles.paceBad : styles.paceOk}`}>
                          {deficit > 0 ? `−${deficit}` : deficit < 0 ? `+${Math.abs(deficit)}` : "a tiempo"}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-3)" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {risk ? (
                        <span
                          className={`${styles.riskPill} ${
                            risk === "alto" ? styles.riskRisk : risk === "medio" ? styles.riskWarn : styles.riskOk
                          }`}
                        >
                          {risk === "alto" ? "Alto" : risk === "medio" ? "Medio" : "Bajo"}
                        </span>
                      ) : (
                        <span className={`${styles.riskPill} ${styles.riskMuted}`}>Sin meta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2>Esta semana</h2>
            </div>
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

          <div className={`${styles.card} ${styles.cardPad}`}>
            <div className={styles.sectionHead}>
              <h2>Carga del equipo</h2>
            </div>
            {teamLoad.map((t) => (
              <div key={t.profileId} className={styles.loadRow}>
                <div className={styles.lrName}>
                  <StaffAvatar name={t.name} avatarUrl={t.avatarUrl} color={t.color} />
                  {t.name}
                </div>
                <div className={styles.loadTrack}>
                  <div
                    className={styles.loadFill}
                    style={{
                      width: `${Math.min(100, (t.count / maxLoad) * 100)}%`,
                      background: t.overloaded ? "var(--risk)" : "var(--b-500)",
                    }}
                  />
                </div>
                <div className={styles.loadVal}>{t.count} piezas</div>
              </div>
            ))}
            {overloadedStaff.length > 0 && (
              <div style={{ fontSize: "11.5px", color: "var(--ink-3)", marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <QosIcon name="alert" size={13} />
                {overloadedStaff.map((t) => t.name).join(", ")} con más de {OVERLOAD_THRESHOLD} piezas activas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function staffColorFromString(input: string): string {
  const palette = ["#6d54f3", "#c0392b", "#2aa5c0", "#3f8f4f", "#b3487f", "#8a5a2b", "#1f9ac9"];
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
