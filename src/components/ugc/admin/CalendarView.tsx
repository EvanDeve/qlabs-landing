"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import type { CalendarItem } from "@/lib/ugc/calendar";
import {
  CALENDAR_EVENT_LABEL_PLURAL,
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_TYPE_LABEL,
  CALENDAR_EVENT_TYPE_DOT,
  CALENDAR_EVENT_TYPE_ICON,
  CARGA_COLOR,
  CARGA_LABEL,
  nivelDeCarga,
  entraEnLaGrilla,
  HORA_INICIO,
  HORA_FIN,
} from "@/lib/ugc/calendar";
import { CONTENT_APPROVAL_LABEL, CONTENT_PLATFORM_LABEL } from "@/lib/ugc/content-meta";
import type { CalendarEventType, ContentApproval } from "@/lib/database.types";
import BrandAvatar from "@/components/ugc/BrandAvatar";
import StaffAvatar from "./StaffAvatar";
import { QosIcon } from "@/lib/ugc/qos-icons";
import CalendarEventModal from "./CalendarEventModal";
import FiltroDropdown from "./FiltroDropdown";
import styles from "@/styles/qos.module.css";

type ViewMode = "month" | "week" | "day";
type Option = { id: string; name: string };

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Cuántos chips entran en una celda antes del "+N más". */
const CHIPS_POR_CELDA = 3;

/**
 * El estado de aprobación en tokens de Q·OS.
 *
 * CONTENT_APPROVAL_STYLE no sirve acá: son clases de Tailwind del landing
 * público, y este panel corre sobre CSS Modules con sus propias variables. Los
 * textos sí se comparten (CONTENT_APPROVAL_LABEL), que es lo que importa que no
 * se desincronice.
 */
const APPROVAL_QOS: Record<ContentApproval, { bg: string; fg: string }> = {
  pendiente: { bg: "var(--surface-3)", fg: "var(--ink-2)" },
  correccion: { bg: "var(--warn-bg)", fg: "var(--warn)" },
  revisado: { bg: "var(--ok-bg)", fg: "var(--ok)" },
};

/**
 * El color del Hero al 12% de opacidad, para el fondo del chip.
 *
 * Va a mano y no con color-mix() porque los colores llegan como hex desde
 * COLORES_HERO y esto se usa en un `style` inline, donde una función CSS que
 * falle deja el chip transparente sin avisar.
 */
function tinte(hex: string, alpha: number): string {
  const limpio = hex.replace("#", "");
  const n = parseInt(limpio.length === 3 ? limpio.replace(/./g, "$&$&") : limpio, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export default function CalendarView({
  view,
  refDateStr,
  gridDays,
  itemsByDay,
  brands,
  staff,
  heroColors,
  tipo,
}: {
  view: ViewMode;
  refDateStr: string;
  gridDays: string[];
  itemsByDay: Record<string, CalendarItem[]>;
  brands: Option[];
  staff: Option[];
  /** id de Hero → color. Viene calculado con la lista COMPLETA, ver la página. */
  heroColors: Record<string, string>;
  /** El tipo que se está mirando solo, o null para el calendario entero. */
  tipo: CalendarEventType | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showNewForm, setShowNewForm] = useState<string | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const refDate = useMemo(() => new Date(`${refDateStr}T00:00:00`), [refDateStr]);
  const shiftAmount = view === "month" ? 1 : view === "week" ? 7 : 1;
  const shifter = view === "month" ? addMonths : addDays;
  const prevDateStr = format(shifter(refDate, -shiftAmount), "yyyy-MM-dd");
  const nextDateStr = format(shifter(refDate, shiftAmount), "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  /**
   * Los links de navegación de la pantalla: vista, fecha y el tipo filtrado.
   *
   * El tipo va SÍ o SÍ, aunque ninguno de estos controles lo cambie: acá el
   * href se arma de cero, así que lo que no se copia se pierde. Sin esta línea,
   * pasar de mes o tocar "Semana" mostraba de vuelta el calendario entero y el
   * filtro parecía apagarse solo.
   */
  function hrefCon(cambios: { view?: ViewMode; date?: string }) {
    const params = new URLSearchParams({
      view: cambios.view ?? view,
      date: cambios.date ?? refDateStr,
    });
    if (tipo) params.set("tipo", tipo);
    return `?${params.toString()}`;
  }

  /**
   * Cambiar el filtro es navegar, igual que en el Pipeline: `replace` y no
   * `push` para no llenar el historial —volver atrás tendría que deshacer
   * filtro por filtro— y `useTransition` para que la pantalla avise que está
   * cargando en vez de quedarse idéntica un instante.
   */
  function elegirTipo(id: string) {
    const params = new URLSearchParams(searchParams);
    // Vacío se BORRA del query en vez de quedar como `?tipo=`: así la URL que
    // alguien comparte dice exactamente qué está filtrado.
    if (id) params.set("tipo", id);
    else params.delete("tipo");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  /**
   * Lo que se dibuja: la grilla y la agenda muestran solo el tipo elegido.
   *
   * OJO con qué recibe cada cosa. Los items filtrados van a las grillas y a la
   * LISTA de la agenda —lo que uno está mirando—, pero los resúmenes de carga
   * (la barra del mes, el badge del día) siguen contando el mes COMPLETO. No es
   * un descuido: los cortes de nivelDeCarga son fijos justamente para que
   * "rojo" signifique lo mismo siempre, y alimentarlos con un subconjunto los
   * rompe —filtrando por grabación, un mes normal mostraría 28 "días libres" y
   * se leería como que el equipo está desocupado, que es falso—.
   */
  const itemsVisibles = useMemo(() => {
    if (!tipo) return itemsByDay;
    const out: Record<string, CalendarItem[]> = {};
    for (const [dia, items] of Object.entries(itemsByDay)) {
      const quedan = items.filter((i) => i.type === tipo);
      if (quedan.length) out[dia] = quedan;
    }
    return out;
  }, [itemsByDay, tipo]);

  /** Cuántos items hay de cada tipo en lo que se está mirando, para el panel. */
  const conteoPorTipo = useMemo(() => {
    const cuenta = new Map<CalendarEventType, number>();
    for (const items of Object.values(itemsByDay)) {
      for (const i of items) cuenta.set(i.type, (cuenta.get(i.type) ?? 0) + 1);
    }
    return cuenta;
  }, [itemsByDay]);

  /**
   * El día que mira el panel de la derecha.
   *
   * `pickedDay` es lo que eligió el usuario y puede quedar viejo: al pasar de
   * mes, el día elegido ya no está en la grilla. Por eso el que manda es este
   * cálculo — si el elegido no está a la vista, cae en hoy (cuando hoy se ve) o
   * en el primer día del mes que se está mirando.
   */
  const activeDay = useMemo(() => {
    if (pickedDay && gridDays.includes(pickedDay)) return pickedDay;
    if (gridDays.includes(todayStr)) return todayStr;
    // El día al que se navegó, antes que el primero de la grilla. Importa en la
    // vista de Día, donde la grilla es UN día: sin esto caía en el 1 del mes y
    // el panel de la derecha mostraba un día distinto al que se está viendo.
    if (gridDays.includes(refDateStr)) return refDateStr;
    return gridDays[0] ?? refDateStr;
  }, [pickedDay, gridDays, todayStr, refDateStr]);

  // La semana se titula con su RANGO, como el mockup ("10–16 agosto 2026"), y no
  // con "Semana del 13": el rango dice de una qué días se están mirando, que es
  // lo que se necesita saber al llegar. Cuando la semana cruza de mes, cada
  // extremo lleva el suyo.
  const title = (() => {
    if (view === "month") return format(refDate, "MMMM yyyy", { locale: es });
    // El día de la semana no va acá sino adentro de la tarjeta, como el mockup:
    // arriba manda la fecha, que es lo que se cambia con las flechas.
    if (view === "day") return format(refDate, "d 'de' MMMM, yyyy", { locale: es });
    const ini = new Date(`${gridDays[0]}T00:00:00`);
    const fin = new Date(`${gridDays[gridDays.length - 1]}T00:00:00`);
    const mismoMes = format(ini, "yyyy-MM") === format(fin, "yyyy-MM");
    return mismoMes
      ? `${format(ini, "d")}–${format(fin, "d MMMM yyyy", { locale: es })}`
      : `${format(ini, "d MMM", { locale: es })} – ${format(fin, "d MMM yyyy", { locale: es })}`;
  })();
  // La mayúscula inicial va acá y no con `text-transform: capitalize`, que
  // capitaliza cada palabra y rompía "13 de agosto" → "13 De Agosto".
  const tituloVisible = title.charAt(0).toUpperCase() + title.slice(1);

  return (
    // `calFit` acota la pantalla a la ventana y hace que scrollee el calendario
    // y no la página. Va en Semana y en Día: son las dos vistas que se recorren
    // por hora, y ahí el encabezado —los días, o los tres números del día— es la
    // referencia que no puede irse de pantalla mientras se baja por el horario.
    // El Mes no: su alto crece con las semanas del mes y ya se lee entero.
    <div
      className={`${styles.calWide} ${view === "month" ? "" : styles.calFit}`}
      style={{ opacity: isPending ? 0.6 : 1 }}
    >
      <div className={styles.calHead}>
        <h2 className={styles.calMonth}>{tituloVisible}</h2>
        <div className={styles.calNav}>
          <Link href={hrefCon({ date: prevDateStr })} className={styles.calNavBtn} aria-label="Anterior">
            <QosIcon name="chevL" size={16} />
          </Link>
          <Link href={hrefCon({ date: todayStr })} className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
            Hoy
          </Link>
          <Link href={hrefCon({ date: nextDateStr })} className={styles.calNavBtn} aria-label="Siguiente">
            <QosIcon name="chevR" size={16} />
          </Link>
        </div>
        {/* Riel segmentado, el mismo de las secciones del Pipeline: son tres
            respuestas a UNA pregunta —con qué zoom miro el mes—, no tres
            acciones sueltas. */}
        <div className={styles.pipeTabs}>
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <Link
              key={v}
              href={hrefCon({ view: v })}
              className={`${styles.pipeTab} ${v === view ? styles.pipeTabOn : ""}`}
            >
              {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
            </Link>
          ))}
        </div>
        {/* Una sola pastilla y no una fila de ellas: la fila de Heroes se sacó
            de acá justamente porque once pastillas se comían ~60px de alto que
            en Semana y Día se lleva la grilla (0dfe4b0). Este control dice qué
            filtra y por qué valor sin ocupar una fila propia. */}
        <FiltroDropdown
          label="Tipo"
          valorLabel={tipo ? CALENDAR_EVENT_TYPE_LABEL[tipo] : "Todos"}
          activo={Boolean(tipo)}
          seleccionado={tipo ?? ""}
          onElegir={elegirTipo}
          opciones={[
            { id: "", label: "Todos" },
            ...CALENDAR_EVENT_TYPES.map((t) => ({
              id: t,
              // El conteo va en la opción para no tener que elegir a ciegas: sin
              // él, filtrar por un tipo que este mes no tiene deja la pantalla
              // vacía y parece que el filtro se rompió.
              label: `${CALENDAR_EVENT_TYPE_LABEL[t]} (${conteoPorTipo.get(t) ?? 0})`,
              color: CALENDAR_EVENT_TYPE_DOT[t],
            })),
          ]}
        />
        <button
          type="button"
          onClick={() => setShowNewForm(activeDay)}
          className={`${styles.btn} ${styles.btnPrimary}`}
          style={{ marginLeft: "auto" }}
        >
          <QosIcon name="plus" size={16} />
          Nuevo evento
        </button>
      </div>

      {view === "month" || view === "week" ? (
        <div className={styles.calLayout}>
          {view === "month" ? (
            <MonthGrid
              refDateStr={refDateStr}
              gridDays={gridDays}
              itemsByDay={itemsVisibles}
              heroColors={heroColors}
              activeDay={activeDay}
              todayStr={todayStr}
              onPickDay={setPickedDay}
              onSelectItem={setSelectedItem}
              onCreate={setShowNewForm}
            />
          ) : (
            <WeekGrid
              gridDays={gridDays}
              itemsByDay={itemsVisibles}
              heroColors={heroColors}
              activeDay={activeDay}
              todayStr={todayStr}
              onPickDay={setPickedDay}
              onSelectItem={setSelectedItem}
              onCreate={setShowNewForm}
            />
          )}
          <aside className={styles.calRail}>
            <AgendaDelDia
              dayStr={activeDay}
              items={itemsVisibles[activeDay] ?? []}
              itemsDelDia={itemsByDay[activeDay] ?? []}
              tipo={tipo}
              heroColors={heroColors}
              onSelectItem={setSelectedItem}
            />
            <CargaDelMes refDateStr={refDateStr} itemsByDay={itemsByDay} onPickDay={setPickedDay} />
          </aside>
        </div>
      ) : (
        <div className={styles.calLayout}>
          <DayView
            dayStr={activeDay}
            items={itemsVisibles[activeDay] ?? []}
            heroColors={heroColors}
            onSelectItem={setSelectedItem}
            onCreate={setShowNewForm}
          />
          <aside className={styles.calRail}>
            <AgendaDelDia
              dayStr={activeDay}
              items={itemsVisibles[activeDay] ?? []}
              itemsDelDia={itemsByDay[activeDay] ?? []}
              tipo={tipo}
              heroColors={heroColors}
              onSelectItem={setSelectedItem}
            />
            <CargaDelMes refDateStr={refDateStr} itemsByDay={itemsByDay} onPickDay={setPickedDay} />
          </aside>
        </div>
      )}

      {selectedItem && (
        <CalendarEventModal item={selectedItem} brands={brands} staff={staff} onClose={() => setSelectedItem(null)} />
      )}
      {showNewForm && (
        <CalendarEventModal
          defaultDate={showNewForm}
          defaultType={tipo ?? undefined}
          brands={brands}
          staff={staff}
          onClose={() => setShowNewForm(null)}
        />
      )}
    </div>
  );
}

function MonthGrid({
  refDateStr,
  gridDays,
  itemsByDay,
  heroColors,
  activeDay,
  todayStr,
  onPickDay,
  onSelectItem,
  onCreate,
}: {
  refDateStr: string;
  gridDays: string[];
  itemsByDay: Record<string, CalendarItem[]>;
  heroColors: Record<string, string>;
  activeDay: string;
  todayStr: string;
  onPickDay: (dayStr: string) => void;
  onSelectItem: (item: CalendarItem) => void;
  onCreate: (dayStr: string) => void;
}) {
  const currentMonth = refDateStr.slice(0, 7);

  // El ancho de la barrita de carga es relativo al día más cargado que se ve, y
  // el COLOR es de corte fijo (nivelDeCarga). Los dos juntos: el color dice si
  // el día está lleno en términos absolutos, el largo deja comparar de un
  // vistazo dos días del mismo mes.
  const maxDia = Math.max(1, ...gridDays.map((d) => (itemsByDay[d] ?? []).length));

  return (
    <div className={styles.calGrid}>
      <div className={styles.calDow}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className={styles.calBody}>
        {gridDays.map((dayStr) => {
          const items = itemsByDay[dayStr] ?? [];
          const inMonth = dayStr.startsWith(currentMonth);
          const isToday = dayStr === todayStr;
          const isActive = dayStr === activeDay;
          const nivel = nivelDeCarga(items.length);
          return (
            <div
              key={dayStr}
              onClick={() => onPickDay(dayStr)}
              className={`${styles.calCell} ${!inMonth ? styles.calCellOut : ""} ${isActive ? styles.calCellSel : ""}`}
            >
              <div className={styles.calCellTop}>
                {nivel === "llena" && <span className={styles.calFullTag}>Lleno</span>}
                {isToday && <span className={styles.calTodayTag}>Hoy</span>}
                <div
                  className={`${styles.calDaynum} ${isToday ? styles.calDaynumToday : ""} ${!inMonth ? styles.calDaynumOut : ""}`}
                >
                  {Number(dayStr.slice(-2))}
                </div>
              </div>
              <div>
                {items.slice(0, CHIPS_POR_CELDA).map((item) => {
                  // Los eventos sin Hero —una reunión interna— caen al color del
                  // tipo: no tienen paleta propia y dejarlos grises los borraría.
                  const color = (item.brandId && heroColors[item.brandId]) || CALENDAR_EVENT_TYPE_DOT[item.type];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem(item);
                      }}
                      className={styles.calEv}
                      // --ev-color lo lee el :hover para dibujar el anillo en
                      // el color del Hero. Antes eso salía de `currentColor`,
                      // que servía cuando el TEXTO del chip iba coloreado; ahora
                      // el texto es tinta —varios Heroes de la paleta son
                      // amarillos o naranjas y sobre un fondo al 12% no se
                      // leían— así que el color viaja aparte.
                      style={
                        {
                          background: tinte(color, 0.12),
                          borderLeft: `3px solid ${color}`,
                          "--ev-color": color,
                        } as React.CSSProperties
                      }
                      // El chip corta el nombre con ellipsis, así que el título
                      // completo tiene que estar en algún lado que no obligue a
                      // abrir la pieza.
                      title={[item.brandName, CALENDAR_EVENT_TYPE_LABEL[item.type], item.hora, item.title]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      <span className={styles.calEvIcon} style={{ color }}>
                        <QosIcon name={CALENDAR_EVENT_TYPE_ICON[item.type]} size={11} />
                      </span>
                      {/* La hora solo si existe de verdad. Medido: 100 de los
                          129 items de agosto no tienen ninguna, así que un
                          hueco fijo dejaría casi todos los chips con un espacio
                          vacío al frente. */}
                      {item.hora && <span className={styles.calEvHora}>{item.hora}</span>}
                      <span className={styles.calEvName}>{item.brandName ?? item.title}</span>
                    </button>
                  );
                })}
                {items.length > CHIPS_POR_CELDA && (
                  <span className={styles.calMas}>+{items.length - CHIPS_POR_CELDA} más</span>
                )}
              </div>

              {/* Crear quedó en un botón propio porque el clic en la celda pasó
                  a elegir el día. Aparece al pasar el mouse y en la esquina de
                  abajo, que es la parte de la celda que casi nunca tiene chips. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreate(dayStr);
                }}
                className={styles.calAdd}
                title="Nuevo evento este día"
                aria-label={`Nuevo evento el ${dayStr}`}
              >
                <QosIcon name="plus" size={13} />
              </button>

              {nivel !== "libre" && (
                <span
                  className={styles.calLoad}
                  style={{
                    width: `${Math.round((items.length / maxDia) * 100)}%`,
                    background: CARGA_COLOR[nivel],
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   VISTA DE SEMANA
   ============================================================ */

/** Alto de una hora de la grilla, en px. Manda todo el cálculo de posiciones. */
const ALTO_HORA = 56;
/**
 * Alto de un bloque de evento: 34 de los 56 de la hora.
 *
 * A pedido de Evan (2026-08-15): "los cards en el calendario deben de verse más
 * pequeñitos, recuerda que los detalles se ven a la derecha donde vienen
 * listados los eventos del día". Por eso el bloque dice solo DOS cosas —a qué
 * hora y de qué Hero— y se le sacó la línea del título: el título completo está
 * en el tooltip y en el panel de la derecha, que es donde él lo va a buscar.
 * Antes medía 52 de 56 con tres líneas y la grilla se leía como un muro de
 * tarjetas en vez de como un horario.
 */
const ALTO_EVENTO = 34;
/** Chips que entran en la banda "Sin hora" antes del "+N más". */
const CHIPS_SIN_HORA = 3;

const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);

/** "8 am", "12 pm", "3 pm" — el formato del mockup para la regla de la izquierda. */
function etiquetaHora(h: number): string {
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Reparte los items de un día entre la grilla y la banda de arriba.
 *
 * A la banda van dos cosas distintas que comparten problema —no tienen lugar en
 * la grilla—: los que no tienen hora (36 de los 49 items de la semana del 10 al
 * 16 de agosto, medido) y los que la tienen pero caen fuera de 8–20. Estos
 * últimos son hoy los 3 eventos de madrugada de agosto, que están mal por el bug
 * de zona horaria de `calendar-events.ts`; mandarlos a la banda con su hora a la
 * vista es lo que impide que el bug se vuelva invisible.
 *
 * Los que sí entran se apilan: si un bloque arranca antes de que termine el
 * anterior, se lo empuja justo abajo en vez de superponerlo. Es lo que eligió
 * Evan sobre partir la columna en dos. El costo, dicho: dos eventos de la misma
 * hora se dibujan uno más abajo que el otro, así que el segundo parece más
 * tarde de lo que es. Por eso el bloque muestra SIEMPRE su hora escrita.
 */
function repartirDia(items: CalendarItem[]) {
  const banda: CalendarItem[] = [];
  const enGrilla: { item: CalendarItem; top: number }[] = [];

  const conHora = items.filter((i) => entraEnLaGrilla(i.hora)).sort((a, b) => a.hora!.localeCompare(b.hora!));

  for (const item of items) if (!conHora.includes(item)) banda.push(item);

  let finAnterior = -Infinity;
  for (const item of conHora) {
    const propio = ((aMinutos(item.hora!) - HORA_INICIO * 60) / 60) * ALTO_HORA;
    const top = Math.max(propio, finAnterior);
    enGrilla.push({ item, top });
    finAnterior = top + ALTO_EVENTO + 2;
  }

  return { banda, enGrilla };
}

function WeekGrid({
  gridDays,
  itemsByDay,
  heroColors,
  activeDay,
  todayStr,
  onPickDay,
  onSelectItem,
  onCreate,
}: {
  gridDays: string[];
  itemsByDay: Record<string, CalendarItem[]>;
  heroColors: Record<string, string>;
  activeDay: string;
  todayStr: string;
  onPickDay: (dayStr: string) => void;
  onSelectItem: (item: CalendarItem) => void;
  onCreate: (cuando: string) => void;
}) {
  const porDia = useMemo(
    () => Object.fromEntries(gridDays.map((d) => [d, repartirDia(itemsByDay[d] ?? [])])),
    [gridDays, itemsByDay]
  );

  const colorDe = (item: CalendarItem) =>
    (item.brandId && heroColors[item.brandId]) || CALENDAR_EVENT_TYPE_DOT[item.type];

  return (
    <div className={styles.calWeek}>
      <div className={styles.calWeekHead}>
        <div className={styles.calWeekGutterCell} />
        {gridDays.map((dayStr) => {
          const total = (itemsByDay[dayStr] ?? []).length;
          const date = new Date(`${dayStr}T00:00:00`);
          return (
            <button
              key={dayStr}
              type="button"
              onClick={() => onPickDay(dayStr)}
              className={`${styles.calWeekDay} ${dayStr === activeDay ? styles.calWeekDayOn : ""}`}
            >
              <span className={styles.calWeekDow}>{format(date, "EEE", { locale: es })}</span>
              <span className={styles.calWeekDate}>
                <span className={dayStr === todayStr ? styles.calDaynumToday : undefined}>
                  {Number(dayStr.slice(-2))}
                </span>
                {/* El contador cuenta el día ENTERO, banda incluida: si contara
                    solo lo de la grilla, un martes con ocho piezas sin hora
                    diría 0 y sería justo el día que hay que mirar. */}
                {total > 0 && <span className={styles.calWeekCount}>{total}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.calWeekAllDay}>
        <div className={styles.calWeekGutterCell}>
          <span className={styles.calWeekGutterTag}>Sin hora</span>
        </div>
        {gridDays.map((dayStr) => {
          const { banda } = porDia[dayStr];
          return (
            <div
              key={dayStr}
              className={`${styles.calWeekAllDayCell} ${dayStr === activeDay ? styles.calWeekColOn : ""}`}
            >
              {banda.slice(0, CHIPS_SIN_HORA).map((item) => {
                const color = colorDe(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className={styles.calEv}
                    style={
                      {
                        background: tinte(color, 0.12),
                        borderLeft: `3px solid ${color}`,
                        "--ev-color": color,
                      } as React.CSSProperties
                    }
                    title={[item.brandName, CALENDAR_EVENT_TYPE_LABEL[item.type], item.hora, item.title]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    <span className={styles.calEvIcon} style={{ color }}>
                      <QosIcon name={CALENDAR_EVENT_TYPE_ICON[item.type]} size={11} />
                    </span>
                    {/* Un item de la banda normalmente no tiene hora. Cuando la
                        tiene es porque cayó fuera de 8–20, y entonces la hora es
                        justo el dato que explica por qué está acá. */}
                    {item.hora && <span className={styles.calEvHora}>{item.hora}</span>}
                    <span className={styles.calEvName}>{item.brandName ?? item.title}</span>
                  </button>
                );
              })}
              {banda.length > CHIPS_SIN_HORA && (
                <button type="button" onClick={() => onPickDay(dayStr)} className={styles.calWeekMas}>
                  +{banda.length - CHIPS_SIN_HORA} más
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.calWeekBody}>
        <div className={styles.calWeekGutterCell}>
          {HORAS.map((h) => (
            <div key={h} className={styles.calWeekHour} style={{ height: ALTO_HORA }}>
              <span>{etiquetaHora(h)}</span>
            </div>
          ))}
        </div>
        {gridDays.map((dayStr) => (
          <div
            key={dayStr}
            className={`${styles.calWeekCol} ${dayStr === activeDay ? styles.calWeekColOn : ""}`}
          >
            {HORAS.map((h) => (
              <button
                key={h}
                type="button"
                className={styles.calWeekSlot}
                style={{ height: ALTO_HORA }}
                onClick={() => onCreate(`${dayStr}T${String(h).padStart(2, "0")}:00`)}
                aria-label={`Nuevo evento el ${dayStr} a las ${h}:00`}
              />
            ))}
            {porDia[dayStr].enGrilla.map(({ item, top }) => {
              const color = colorDe(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={styles.calWeekEv}
                  style={
                    {
                      top,
                      height: ALTO_EVENTO,
                      background: tinte(color, 0.12),
                      borderLeft: `3px solid ${color}`,
                      "--ev-color": color,
                    } as React.CSSProperties
                  }
                  title={[item.brandName, CALENDAR_EVENT_TYPE_LABEL[item.type], item.hora, item.title]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <span className={styles.calWeekEvTop}>
                    <QosIcon name={CALENDAR_EVENT_TYPE_ICON[item.type]} size={10} />
                    {/* La hora va escrita SIEMPRE, aunque la altura del bloque
                        ya la insinúe: con los choques apilados el segundo evento
                        se dibuja más abajo que su hora real, así que el texto es
                        lo único que no miente. */}
                    <span className={styles.calEvHora}>{item.hora}</span>
                  </span>
                  <span className={styles.calWeekEvHero}>{item.brandName ?? item.title}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   VISTA DE DÍA
   ============================================================ */

function DayView({
  dayStr,
  items,
  heroColors,
  onSelectItem,
  onCreate,
}: {
  dayStr: string;
  items: CalendarItem[];
  heroColors: Record<string, string>;
  onSelectItem: (item: CalendarItem) => void;
  onCreate: (cuando: string) => void;
}) {
  const date = new Date(`${dayStr}T00:00:00`);

  /**
   * Los tres números del encabezado se cuentan SOLO sobre las publicaciones,
   * igual que el subtítulo que los precede. Una grabación no se publica en
   * ningún lado, así que sumarla a "reels" contaría dos veces la misma pieza:
   * la grabación y la publicación del mismo video salen del mismo `platform`.
   */
  const publicaciones = items.filter((i) => i.type === "publicacion");
  const reels = publicaciones.filter((i) => i.platform === "reels").length;
  // "posts" es todo lo que no es reel: instagram y tiktok. Van juntos porque en
  // todo agosto hay 30 de instagram contra 1 de tiktok, y una tarjeta con un
  // número que casi siempre dice 0 ocupa lugar sin decir nada.
  const posts = publicaciones.filter((i) => i.platform && i.platform !== "reels").length;
  // Pendiente + Corrección: "lo que todavía te falta de este día" (decisión de
  // Evan, 2026-08-15). Corrección sola casi siempre daría 0 —6 piezas en todo
  // agosto contra 41 pendientes— y pendiente sola dejaría afuera justo las que
  // volvieron con cambios.
  const porRevisar = publicaciones.filter(
    (i) => i.approval === "pendiente" || i.approval === "correccion"
  ).length;

  const sinHora = items.filter((i) => !entraEnLaGrilla(i.hora));
  const porHora = new Map<number, CalendarItem[]>();
  for (const item of items) {
    if (!entraEnLaGrilla(item.hora)) continue;
    const h = Number(item.hora!.slice(0, 2));
    const fila = porHora.get(h) ?? [];
    fila.push(item);
    porHora.set(h, fila);
  }
  for (const fila of porHora.values()) fila.sort((a, b) => a.hora!.localeCompare(b.hora!));

  const fila = (item: CalendarItem) => {
    const color = (item.brandId && heroColors[item.brandId]) || CALENDAR_EVENT_TYPE_DOT[item.type];
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectItem(item)}
        className={styles.calDayItem}
        style={{ background: tinte(color, 0.09), borderLeft: `3px solid ${color}` }}
      >
        <BrandAvatar
          name={item.brandName ?? item.title}
          logoUrl={item.brandLogoUrl}
          size={34}
          radius={9}
          fit="contain"
          color={color}
        />
        <span className={styles.calDayItemBody}>
          <span className={styles.calDayItemTitle}>
            {item.title}
            {item.brandName ? ` — ${item.brandName}` : ""}
          </span>
          <span className={styles.calDayItemMeta}>
            <QosIcon name={CALENDAR_EVENT_TYPE_ICON[item.type]} size={12} />
            {[
              item.hora,
              item.type === "publicacion" ? null : CALENDAR_EVENT_TYPE_LABEL[item.type],
              item.platform ? CONTENT_PLATFORM_LABEL[item.platform] : null,
              item.responsibleName,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {item.approval && (
          <span
            className={styles.calAgTag}
            style={{ background: APPROVAL_QOS[item.approval].bg, color: APPROVAL_QOS[item.approval].fg }}
          >
            {CONTENT_APPROVAL_LABEL[item.approval]}
          </span>
        )}
        <QosIcon name="chevR" size={15} />
      </button>
    );
  };

  return (
    <div className={styles.calDay}>
      <div className={styles.calDayHead}>
        <div className={styles.calDayBadge}>
          <span>{format(date, "d", { locale: es })}</span>
          <span>{format(date, "MMM", { locale: es })}</span>
        </div>
        <div className={styles.calDayTitles}>
          <h3>{format(date, "EEEE", { locale: es })}</h3>
          <p>
            {publicaciones.length === 1
              ? "1 publicación agendada"
              : `${publicaciones.length} publicaciones agendadas`}
          </p>
        </div>
        <div className={styles.calDayStats}>
          <div className={styles.calDayStat}>
            <strong>{reels}</strong>
            <span>reels</span>
          </div>
          <div className={styles.calDayStat}>
            <strong>{posts}</strong>
            <span>posts</span>
          </div>
          <div className={styles.calDayStat}>
            <strong style={{ color: porRevisar > 0 ? "var(--warn)" : undefined }}>{porRevisar}</strong>
            <span>por revisar</span>
          </div>
        </div>
      </div>

      <div className={styles.calDayBody}>
        {/* La misma banda que la semana, con el mismo motivo: la mayoría de las
            publicaciones no tiene hora. El 12 de agosto son las 8 de 8, así que
            sin esta fila el día se veía completamente vacío. */}
        {sinHora.length > 0 && (
          <div className={styles.calDayRow}>
            <div className={styles.calDayHourCell}>
              <span className={styles.calWeekGutterTag}>Sin hora</span>
            </div>
            <div className={styles.calDayRowItems}>{sinHora.map(fila)}</div>
          </div>
        )}
        {HORAS.map((h) => {
          const deLaHora = porHora.get(h) ?? [];
          return (
            <div key={h} className={styles.calDayRow}>
              <div className={styles.calDayHourCell}>{etiquetaHora(h)}</div>
              {deLaHora.length > 0 ? (
                <div className={styles.calDayRowItems}>{deLaHora.map(fila)}</div>
              ) : (
                // La hora vacía sigue siendo clickeable: es el "crear a las 3 pm"
                // de la semana, y el guion le da algo que mirar para que no
                // parezca que la fila se rompió.
                <button
                  type="button"
                  onClick={() => onCreate(`${dayStr}T${String(h).padStart(2, "0")}:00`)}
                  className={styles.calDayEmpty}
                  aria-label={`Nuevo evento a las ${h}:00`}
                >
                  —
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaDelDia({
  dayStr,
  items,
  itemsDelDia,
  tipo,
  heroColors,
  onSelectItem,
}: {
  dayStr: string;
  /** Los que se listan: ya filtrados por tipo. */
  items: CalendarItem[];
  /**
   * TODOS los del día, filtro incluido o no. Los dos resúmenes de arriba salen
   * de acá y no de `items` a propósito: describen el día, no lo que se está
   * mirando. Contando solo lo filtrado, un jueves con 16 publicaciones diría
   * "Sin publicaciones · Día libre" apenas alguien filtra por grabación.
   */
  itemsDelDia: CalendarItem[];
  tipo: CalendarEventType | null;
  heroColors: Record<string, string>;
  onSelectItem: (item: CalendarItem) => void;
}) {
  const date = new Date(`${dayStr}T00:00:00`);
  const nivel = nivelDeCarga(itemsDelDia.length);
  const publicaciones = itemsDelDia.filter((i) => i.type === "publicacion").length;

  return (
    <section className={styles.card}>
      <div className={styles.cardPad}>
        <div className={styles.pipeFiltersTag}>Agenda</div>
        <div className={styles.calAgendaDate}>
          <strong>{format(date, "d MMM", { locale: es })}</strong>
          <span>{format(date, "EEEE", { locale: es })}</span>
        </div>
        <div className={styles.calAgendaChips}>
          <span className={styles.chip}>
            {/* Las dos formas enteras: el plural de "publicación" pierde la
                tilde, así que pegarle "es" al singular da "publicaciónes". */}
            {publicaciones === 0
              ? "Sin publicaciones"
              : `${publicaciones} ${publicaciones === 1 ? "publicación" : "publicaciones"}`}
          </span>
          <span
            className={styles.badgeSt}
            style={{ background: "var(--surface-3)", color: CARGA_COLOR[nivel] }}
          >
            <span className={styles.dot} style={{ background: CARGA_COLOR[nivel] }} />
            {CARGA_LABEL[nivel]}
          </span>
        </div>

        <div className={styles.calAgList}>
          {items.length === 0 ? (
            <p className={styles.calEmpty}>
              {tipo
                ? `Sin ${CALENDAR_EVENT_LABEL_PLURAL[tipo]} este día${
                    itemsDelDia.length ? `, pero sí ${itemsDelDia.length} item${itemsDelDia.length === 1 ? "" : "s"} de otro tipo.` : "."
                  }`
                : "Nada agendado este día."}
            </p>
          ) : (
            items.map((item) => {
              const color = (item.brandId && heroColors[item.brandId]) || CALENDAR_EVENT_TYPE_DOT[item.type];
              return (
                <button key={item.id} type="button" onClick={() => onSelectItem(item)} className={styles.calAgItem}>
                  <BrandAvatar
                    name={item.brandName ?? item.title}
                    logoUrl={item.brandLogoUrl}
                    size={32}
                    radius={9}
                    fit="contain"
                    // El respaldo de iniciales toma el color del Hero para que
                    // el avatar, el punto del filtro y el chip de la grilla
                    // digan lo mismo. Sin esto usaría su degradado por hash, que
                    // solo tiene 5 variantes para 10 Heroes sin logo.
                    color={color}
                  />
                  <div className={styles.calAgBody}>
                    <div className={styles.calAgTitle}>{item.title}</div>
                    {/* "08:40 · Publicación · Instagram" no entra en una línea
                        con el rail en su piso de 300px, y "Publicación" es justo
                        lo que ya dice el ícono de al lado. Se calla SOLO en las
                        publicaciones, que son 116 de los 129 items del mes; una
                        grabación o una reunión conservan la palabra, porque ahí
                        el ícono solo no alcanza para distinguirlas de la
                        publicación de la misma pieza, que va el mismo día. */}
                    <div className={styles.calAgMeta}>
                      <QosIcon name={CALENDAR_EVENT_TYPE_ICON[item.type]} size={12} />
                      {[
                        item.hora,
                        item.type === "publicacion" ? null : CALENDAR_EVENT_TYPE_LABEL[item.type],
                        item.platform ? CONTENT_PLATFORM_LABEL[item.platform] : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {item.brandName && <div className={styles.calAgHero}>{item.brandName}</div>}
                    {item.responsibleName && (
                      <div className={styles.calAgResp}>
                        <StaffAvatar
                          name={item.responsibleName}
                          avatarUrl={item.responsibleAvatarUrl}
                          color={item.responsibleColor ?? "var(--b-500)"}
                        />
                        {item.responsibleName}
                      </div>
                    )}
                  </div>
                  {item.approval && (
                    <span
                      className={styles.calAgTag}
                      style={{
                        background: APPROVAL_QOS[item.approval].bg,
                        color: APPROVAL_QOS[item.approval].fg,
                      }}
                    >
                      {CONTENT_APPROVAL_LABEL[item.approval]}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function CargaDelMes({
  refDateStr,
  itemsByDay,
  onPickDay,
}: {
  refDateStr: string;
  itemsByDay: Record<string, CalendarItem[]>;
  onPickDay: (dayStr: string) => void;
}) {
  const mes = refDateStr.slice(0, 7);
  const dias = useMemo(() => {
    const [anio, m] = mes.split("-").map(Number);
    // Día 0 del mes siguiente = el último del actual. En UTC para que no se
    // corra un día, igual que diaCorto.
    const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
    return Array.from({ length: ultimo }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
  }, [mes]);

  const conteos = dias.map((d) => (itemsByDay[d] ?? []).length);
  const total = conteos.reduce((a, b) => a + b, 0);
  const pico = Math.max(0, ...conteos);
  const libres = conteos.filter((n) => n === 0).length;

  return (
    <section className={styles.card}>
      <div className={styles.cardPad}>
        <div className={styles.pipeFiltersTag}>Carga del mes</div>
        <div className={styles.calChart}>
          {dias.map((d, i) => {
            const nivel = nivelDeCarga(conteos[i]);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onPickDay(d)}
                className={styles.calChartCol}
                title={`${format(new Date(`${d}T00:00:00`), "d 'de' MMMM", { locale: es })} · ${conteos[i]} ${conteos[i] === 1 ? "item" : "items"}`}
              >
                <span
                  className={styles.calChartBar}
                  style={{
                    // El piso de 3% es para que un día vacío siga siendo una
                    // columna clickeable y no una franja de 0px.
                    height: `${pico ? Math.max(3, (conteos[i] / pico) * 100) : 3}%`,
                    background: nivel === "libre" ? "var(--line)" : CARGA_COLOR[nivel],
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className={styles.calChartAxis}>
          <span>{format(new Date(`${mes}-01T00:00:00`), "d MMM", { locale: es })}</span>
          <span>15</span>
          <span>{dias.length}</span>
        </div>
        <div className={styles.calStats}>
          <div className={styles.calStat}>
            <strong>{total}</strong>
            <span>este mes</span>
          </div>
          <div className={styles.calStat}>
            <strong>{pico}</strong>
            {/* "día más cargado" a secas se lee como una cuenta de días en
                cuanto el número baja a 1 —"1 día más cargado"—, y es una cuenta
                de items. Con "en el" queda bien en singular y en plural. */}
            <span>en el día más cargado</span>
          </div>
          <div className={styles.calStat}>
            <strong style={{ color: libres === 0 ? "var(--risk)" : undefined }}>{libres}</strong>
            <span>{libres === 1 ? "día libre" : "días libres"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
