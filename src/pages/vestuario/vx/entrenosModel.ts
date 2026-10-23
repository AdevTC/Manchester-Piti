// «¿Cuándo entrenamos?» (/vestuario/entrenos): the pure pieces of the block, the board's rows (vx.tr) out of
// production's training, and the propose form's ranges (day, desde, hasta in the viewer's clock).
import { plural, slotParts, slotStanding, slotTime, type TrainingSlot } from "../../../lib/vestuario";

export interface TrainRow {
  id: string;
  /** «Sábado 24». */
  d: string;
  /** «10:00–11:30 · Campo de siempre» (no place: just the hours). */
  h: string;
  /** «10:00–11:30». */
  t: string;
  /** «5 votos · Más votado». */
  n: string;
  on: boolean;
  past: boolean;
  top: boolean;
  count: number;
  at: number;
}

/** «Sábado 24». */
export const slotDay = (ms: number) => {
  const p = slotParts(ms);
  return `${p.day} ${p.date}`;
};
/** «Sábado 24 oct». */
export const slotDayMonth = (ms: number) => {
  const p = slotParts(ms);
  return `${p.day} ${p.date} ${p.month}`;
};
export const hoursPlace = (s: { at: number; end?: number; place?: string }) => `${slotTime(s)}${s.place ? ` · ${s.place}` : ""}`;

/** The board's rows: each slot with its votes, «Más votado» (or «Ya hay equipo» from 7), mine pressed. */
export function trainRows(slots: TrainingSlot[], votes: { slotIds: string[] }[], mine: readonly string[], now: number): TrainRow[] {
  const st = slotStanding(slots, votes);
  return slots.map((s) => {
    const count = st.counts.get(s.id) ?? 0;
    const tag = st.ready.has(s.id) ? " · Ya hay equipo" : st.top.has(s.id) ? " · Más votado" : "";
    return { id: s.id, d: slotDay(s.at), h: hoursPlace(s), t: slotTime(s), n: `${plural(count, "voto", "votos")}${tag}`, on: mine.includes(s.id), past: s.at <= now, top: st.top.has(s.id), count, at: s.at };
  });
}
/** The slots the proposer (or a captain) can still fix: the future ones, most voted first, then by date. */
export const confirmable = (rows: TrainRow[]) => rows.filter((r) => !r.past).sort((x, y) => y.count - x.count || x.at - y.at);

// ---------- the propose form
const pad = (n: number) => String(n).padStart(2, "0");
export const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const localTime = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export interface Range {
  day: string;
  from: string;
  to: string;
}
export const EMPTY_RANGE: Range = { day: "", from: "", to: "" };
/** A ghost slot («Sábado», «Domingo») prefills its day with 1 h 30 from the suggested start. */
export const firstRange = (first: number | null): Range => (first ? { day: localDay(first), from: localTime(first), to: localTime(first + 90 * 60_000) } : EMPTY_RANGE);
/** A range the backend accepts: complete, ending after it starts. */
export function rangeMs(r: Range) {
  if (!r.day || !r.from || !r.to) return null;
  const at = new Date(`${r.day}T${r.from}`).getTime(),
    end = new Date(`${r.day}T${r.to}`).getTime();
  return end > at ? { at, end } : null;
}
export const started = (r: Range) => !!(r.day || r.from || r.to);
/** What is wrong with a started range (empty: nothing). */
export function rangeProblem(r: Range) {
  if (!started(r) || rangeMs(r)) return "";
  return r.day && r.from && r.to ? "La hora de fin debe ser posterior a la de inicio." : "Completa día, desde y hasta.";
}
/** The form's slots as the callable takes them (null: nothing started, or one is incomplete). */
export function proposal(ranges: Range[], place: string) {
  const used = ranges.filter(started);
  const ms = used.map(rangeMs);
  if (!used.length || ms.some((m) => !m)) return null;
  return ms.map((m) => ({ at: m!.at, end: m!.end, place: place.trim() }));
}
