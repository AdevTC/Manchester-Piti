// HOY Y PARTIDOS · the boards' SC.fmt in club time (Europe/Madrid): the words a date, an instant or a gap is said with
// in Hoy, the season's table and the stations («dom 8 nov», «mañana», «hace 2 h», «2 d 4 h», «12′»). Pure.
import { madridDate, MONTHS_SHORT } from "../../../../lib/derived/madrid";
import { capital, plural } from "../../../../lib/derived/words";

const TZ = "Europe/Madrid";
const H = 3_600_000;
const D = 86_400_000;
const WD_FMT = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short" });
const WD_LONG = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long" });

/** The Madrid day as a sortable number (20261108). */
export const dayKey = (ms: number): number => Number(madridDate(ms).replace(/-/g, ""));
/** «dom». */
export const dayShort = (ms: number): string => WD_FMT.format(ms).replace(".", "");
/** «domingo». */
export const dayName = (ms: number): string => WD_LONG.format(ms);
/** «8». */
export const dateNum = (ms: number): number => Number(madridDate(ms).slice(8, 10));
/** «nov». */
export const monthShort = (ms: number): string => MONTHS_SHORT[Number(madridDate(ms).slice(5, 7)) - 1] ?? "";
/** «domingo 8 de noviembre» → said shorter, as the boards: «domingo 8 nov». */
export const dayLong = (ms: number): string => `${dayName(ms)} ${dateNum(ms)} ${monthShort(ms)}`;
/** «Domingo 8 nov». */
export const DayLong = (ms: number): string => capital(dayLong(ms));
const MONTH_FMT = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, month: "long" });
/** «Miércoles 28 de octubre» (Hoy's line). */
export const DayFull = (ms: number): string => capital(`${dayName(ms)} ${dateNum(ms)} de ${MONTH_FMT.format(ms)}`);
/** The year in Madrid. */
export const yearOf = (ms: number): number => Number(madridDate(ms).slice(0, 4));

/** «hoy», «mañana», «ayer», «el domingo» (this week), «el 8 nov». */
export function relDay(ms: number, now: number): string {
  const diff = Math.round((Date.UTC(...ymd(ms)) - Date.UTC(...ymd(now))) / D);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff > 1 && diff < 7) return `el ${dayName(ms)}`;
  return `el ${dayShort(ms)} ${dateNum(ms)} ${monthShort(ms)}`;
}
const ymd = (ms: number): [number, number, number] => {
  const [y, m, d] = madridDate(ms).split("-").map(Number);
  return [y, m - 1, d];
};

/** «hace un momento», «hace 12 min», «hace 3 h», «ayer», «hace 4 días». */
export function rel(at: number, now: number): string {
  const d = now - at;
  if (d < 60_000) return "hace un momento";
  if (d < H) return `hace ${Math.round(d / 60_000)} min`;
  if (d < 20 * H) return `hace ${Math.round(d / H)} h`;
  const days = Math.round((Date.UTC(...ymd(now)) - Date.UTC(...ymd(at))) / D);
  if (days <= 1) return "ayer";
  return `hace ${days} días`;
}

/** What is left until `at`: «2 d 4 h», «5 h 20 min», «12 min» («ya» once past). */
export function left(at: number, now: number): string {
  const d = at - now;
  if (d <= 0) return "ya";
  const days = Math.floor(d / D);
  const hours = Math.floor((d % D) / H);
  const mins = Math.floor((d % H) / 60_000);
  if (days >= 2) return `${days} días`;
  if (days) return `${days} d${hours ? ` ${hours} h` : ""}`;
  if (hours) return `${hours} h${mins ? ` ${mins} min` : ""}`;
  return `${Math.max(1, mins)} min`;
}

/** «12′» (a minute of the match; added time as «50+2′» is the caller's). */
export const minute = (m: number | undefined): string => (typeof m === "number" && Number.isFinite(m) ? `${m}′` : "—");

/** «1 gol», «2 goles». */
export { plural };
/** «A, B y C». */
export function list(xs: readonly string[]): string {
  if (xs.length < 2) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}
/** «12,50 €» from cents. */
export const euros = (cents: number): string => `${(cents / 100).toLocaleString("es-ES", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
/** Fold for searching: no accents, lower case, single spaces. */
export const fold = (s: string | undefined): string =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
/** «12 nov» from a Madrid day `YYYY-MM-DD`. */
export function isoDay(s: string): string {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return a ? `${Number(a[3])} ${MONTHS_SHORT[Number(a[2]) - 1]}` : s;
}
