// The .ics feed's pure part (calendar.ts): when a match goes in the calendar and how it is marked. An
// aplazado with its new date moves there (confirmed, its reason in the description); without one it
// stays at its old date, tentative, «Aplazado» in the title.
import { dateMillis } from "./matchEngine.js";

export interface CalendarSlot {
  start: number;
  status: "CONFIRMED" | "TENTATIVE";
  /** Prefix for the summary («Aplazado · »), or "". */
  prefix: string;
  /** The description line (the postponement's reason), or "". */
  note: string;
}

const ms = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | null | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : dateMillis(v);
};

/** Where a match sits in the feed (null: no usable date). */
export function calendarSlot(d: { date?: unknown; status?: unknown; postponedTo?: unknown; postponedReason?: unknown }): CalendarSlot | null {
  const reason = typeof d.postponedReason === "string" && d.postponedReason.trim() ? `Aplazado: ${d.postponedReason.trim()}` : "";
  if (d.status === "postponed") {
    const to = d.postponedTo == null ? NaN : ms(d.postponedTo);
    if (Number.isFinite(to)) return { start: to, status: "CONFIRMED", prefix: "", note: reason ? `${reason}. Nueva fecha.` : "Nueva fecha." };
    const start = ms(d.date);
    return Number.isFinite(start) ? { start, status: "TENTATIVE", prefix: "Aplazado · ", note: reason ? `${reason}. Nueva fecha por decidir.` : "Nueva fecha por decidir." } : null;
  }
  const start = ms(d.date);
  return Number.isFinite(start) ? { start, status: "CONFIRMED", prefix: "", note: "" } : null;
}
