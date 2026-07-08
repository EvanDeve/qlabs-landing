"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import type { CalendarItem } from "@/lib/ugc/calendar";
import { CALENDAR_EVENT_TYPE_LABEL, CALENDAR_EVENT_TYPE_DOT, CALENDAR_EVENT_TYPE_BG, COSTA_RICA_TZ } from "@/lib/ugc/calendar";
import { QosIcon } from "@/lib/ugc/qos-icons";
import CalendarEventModal from "./CalendarEventModal";
import styles from "@/app/ugc/(dashboard)/admin/qos.module.css";

type ViewMode = "month" | "week" | "day";
type Option = { id: string; name: string };

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarView({
  view,
  refDateStr,
  gridDays,
  itemsByDay,
  brands,
  staff,
}: {
  view: ViewMode;
  refDateStr: string;
  gridDays: string[];
  itemsByDay: Record<string, CalendarItem[]>;
  brands: Option[];
  staff: Option[];
}) {
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showNewForm, setShowNewForm] = useState<string | null>(null);

  const refDate = useMemo(() => new Date(`${refDateStr}T00:00:00`), [refDateStr]);
  const shiftAmount = view === "month" ? 1 : view === "week" ? 7 : 1;
  const shifter = view === "month" ? addMonths : addDays;
  const prevDateStr = format(shifter(refDate, -shiftAmount), "yyyy-MM-dd");
  const nextDateStr = format(shifter(refDate, shiftAmount), "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const title =
    view === "month"
      ? format(refDate, "MMMM yyyy", { locale: es })
      : view === "week"
        ? `Semana del ${format(refDate, "d 'de' MMMM", { locale: es })}`
        : format(refDate, "EEEE d 'de' MMMM", { locale: es });

  return (
    <div>
      <div className={styles.calHead}>
        <h2 className={styles.calMonth}>{title}</h2>
        <div className={styles.calNav}>
          <Link href={`?view=${view}&date=${prevDateStr}`} className={styles.calNavBtn}>
            <QosIcon name="chevL" size={16} />
          </Link>
          <Link href={`?view=${view}&date=${todayStr}`} className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
            Hoy
          </Link>
          <Link href={`?view=${view}&date=${nextDateStr}`} className={styles.calNavBtn}>
            <QosIcon name="chevR" size={16} />
          </Link>
        </div>
        <div className={styles.calViewToggle}>
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <Link
              key={v}
              href={`?view=${v}&date=${refDateStr}`}
              className={`${styles.btn} ${styles.btnSm} ${v === view ? styles.btnPrimary : styles.btnGhost}`}
            >
              {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowNewForm(refDateStr)}
          className={`${styles.btn} ${styles.btnPrimary}`}
          style={{ marginLeft: "auto" }}
        >
          <QosIcon name="plus" size={16} />
          Nuevo evento
        </button>
      </div>

      {view === "month" && (
        <MonthGrid
          refDate={refDate}
          gridDays={gridDays}
          itemsByDay={itemsByDay}
          onSelectItem={setSelectedItem}
          onCreate={setShowNewForm}
        />
      )}
      {(view === "week" || view === "day") && (
        <AgendaColumns days={gridDays} itemsByDay={itemsByDay} onSelectItem={setSelectedItem} onCreate={setShowNewForm} />
      )}

      {selectedItem && (
        <CalendarEventModal item={selectedItem} brands={brands} staff={staff} onClose={() => setSelectedItem(null)} />
      )}
      {showNewForm && (
        <CalendarEventModal
          defaultDate={showNewForm}
          brands={brands}
          staff={staff}
          onClose={() => setShowNewForm(null)}
        />
      )}
    </div>
  );
}

function MonthGrid({
  refDate,
  gridDays,
  itemsByDay,
  onSelectItem,
  onCreate,
}: {
  refDate: Date;
  gridDays: string[];
  itemsByDay: Record<string, CalendarItem[]>;
  onSelectItem: (item: CalendarItem) => void;
  onCreate: (dayStr: string) => void;
}) {
  const currentMonth = format(refDate, "yyyy-MM");
  const todayStr = format(new Date(), "yyyy-MM-dd");

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
          return (
            <div
              key={dayStr}
              onClick={() => onCreate(dayStr)}
              className={`${styles.calCell} ${!inMonth ? styles.calCellOut : ""}`}
            >
              <div className={`${styles.calDaynum} ${isToday ? styles.calDaynumToday : ""} ${!inMonth ? styles.calDaynumOut : ""}`}>
                {Number(dayStr.slice(-2))}
              </div>
              <div>
                {items.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectItem(item);
                    }}
                    className={styles.calEv}
                    style={{
                      background: CALENDAR_EVENT_TYPE_BG[item.type],
                      color: CALENDAR_EVENT_TYPE_DOT[item.type],
                      borderLeft: `3px solid ${CALENDAR_EVENT_TYPE_DOT[item.type]}`,
                    }}
                  >
                    {item.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--ink-3)" }}>
                    +{items.length - 3} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaColumns({
  days,
  itemsByDay,
  onSelectItem,
  onCreate,
}: {
  days: string[];
  itemsByDay: Record<string, CalendarItem[]>;
  onSelectItem: (item: CalendarItem) => void;
  onCreate: (dayStr: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "14px", gridTemplateColumns: days.length > 1 ? "repeat(7, 1fr)" : "1fr" }}>
      {days.map((dayStr) => {
        const items = itemsByDay[dayStr] ?? [];
        const date = new Date(`${dayStr}T00:00:00`);
        return (
          <div key={dayStr} className={styles.agendaCol}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, textTransform: "capitalize" }}>
                {format(date, "EEE d", { locale: es })}
              </span>
              <button type="button" onClick={() => onCreate(dayStr)} className={styles.linkMore}>
                <QosIcon name="plus" size={13} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {items.length > 0 ? (
                items.map((item) => (
                  <button key={item.id} type="button" onClick={() => onSelectItem(item)} className={styles.agendaItem}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className={styles.dot} style={{ background: CALENDAR_EVENT_TYPE_DOT[item.type] }} />
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-2)" }}>
                        {formatInTimeZone(new Date(item.date), COSTA_RICA_TZ, "HH:mm")} ·{" "}
                        {CALENDAR_EVENT_TYPE_LABEL[item.type]}
                      </span>
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: 600 }}>{item.title}</div>
                    {item.brandName && (
                      <div style={{ fontSize: "11.5px", color: "var(--ink-2)" }}>{item.brandName}</div>
                    )}
                  </button>
                ))
              ) : (
                <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>Sin eventos</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
