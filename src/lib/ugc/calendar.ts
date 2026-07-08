import type { CalendarEventType } from "@/lib/database.types";

export const COSTA_RICA_TZ = "America/Costa_Rica";

export type CalendarItem = {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string;
  brandId: string | null;
  brandName: string | null;
  responsibleName: string | null;
  contentPieceId: string | null;
};

export const CALENDAR_EVENT_TYPE_LABEL: Record<CalendarEventType, string> = {
  publicacion: "Publicación",
  grabacion: "Grabación",
  reunion: "Reunión",
  entrega: "Entrega",
};

export const CALENDAR_EVENT_TYPE_DOT: Record<CalendarEventType, string> = {
  publicacion: "var(--st-pub)",
  grabacion: "var(--st-grab)",
  reunion: "var(--st-estr)",
  entrega: "var(--st-aprob)",
};

export const CALENDAR_EVENT_TYPE_BG: Record<CalendarEventType, string> = {
  publicacion: "rgba(20,160,106,.12)",
  grabacion: "rgba(31,154,201,.12)",
  reunion: "rgba(109,84,243,.12)",
  entrega: "rgba(192,116,20,.12)",
};
