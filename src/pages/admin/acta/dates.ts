// Club time (Europe/Madrid) for the match fields, pure: the old editor's datetime-local round trip
// (dateInput ⇄ madridTime, DST-safe) and the split date / time fields of «Nuevo partido».
const TZ = "Europe/Madrid";

/** «2026-11-01T10:00» in Madrid for an instant ("" when there is none). */
export function dateInput(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The instant of a Madrid wall-clock «YYYY-MM-DDTHH:mm» (NaN when it doesn't exist or is malformed). */
export function madridTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const base = Date.parse(`${value}Z`);
  if (!Number.isFinite(base)) return NaN;
  let ms = base;
  for (let i = 0; i < 3; i++) ms += base - Date.parse(`${dateInput(ms)}Z`);
  return dateInput(ms) === value ? ms : NaN;
}

/** «2026-11-01» and «10:00» (Madrid) of an instant. */
export function splitDate(ms: number): { date: string; time: string } {
  const v = dateInput(ms);
  return v ? { date: v.slice(0, 10), time: v.slice(11) } : { date: "", time: "" };
}
/** The instant of a Madrid date + time (NaN if either is missing). */
export const joinDate = (date: string, time: string) => (date && time ? madridTime(`${date}T${time}`) : NaN);

/**
 * When «Nuevo partido» proposes the next match: a week after the season's latest match (same time), or
 * the coming Sunday at 11:00 — never in the past.
 */
export function proposeDate(lastDate: number | undefined, now: number): number {
  const WEEK = 7 * 24 * 3600_000;
  if (lastDate !== undefined && Number.isFinite(lastDate)) {
    let t = lastDate + WEEK;
    while (t <= now) t += WEEK;
    return t;
  }
  const today = dateInput(now).slice(0, 10);
  const wd = new Date(`${today}T12:00:00Z`).getUTCDay();
  const add = (7 - wd) % 7 || 7;
  const d = new Date(Date.parse(`${today}T12:00:00Z`) + add * 24 * 3600_000).toISOString().slice(0, 10);
  return madridTime(`${d}T11:00`);
}

/** The current instant (for «Guardado hh:mm» after a save, outside render). */
export const instant = () => Date.now();
