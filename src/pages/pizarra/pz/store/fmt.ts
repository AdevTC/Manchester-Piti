// r14 «La pizarra»: words and numbers as the prototype writes them (PI-store.js `fmt`), in Madrid time.
const TZ = "Europe/Madrid";
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS_L = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const partsFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const madridSeen = new Map<number, { y: number; m: number; d: number; h: number; mi: number; wd: number }>();
/** A moment's wall clock in Madrid. */
export function madrid(ms: number): { y: number; m: number; d: number; h: number; mi: number; wd: number } {
  // (the same few moments — the match, now, the save — are asked on every render of the bar: remembered)
  const hit = madridSeen.get(ms);
  if (hit) return { ...hit };
  const o: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(new Date(ms))) o[p.type] = p.value;
  const r = { y: +o.year, m: +o.month - 1, d: +o.day, h: +o.hour % 24, mi: +o.minute, wd: WD[o.weekday] ?? 0 };
  if (madridSeen.size > 200) madridSeen.clear();
  madridSeen.set(ms, r);
  return { ...r };
}

const pad = (n: number) => String(n).padStart(2, "0");

export const fmt = {
  /** «dom 8 nov». */
  day(ms: number): string {
    const t = madrid(ms);
    return `${DAYS[t.wd]} ${t.d} ${MONTHS[t.m]}`;
  },
  /** «domingo 8 de noviembre». */
  dayLong(ms: number): string {
    const t = madrid(ms);
    return `${DAYS_L[t.wd]} ${t.d} de ${MONTHS_L[t.m]}`;
  },
  /** «18:02». */
  hm(ms: number): string {
    const t = madrid(ms);
    return `${pad(t.h)}:${pad(t.mi)}`;
  },
  /** «6,8» (— for none). */
  nota(n: number | null | undefined): string {
    return n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
  },
  plural(n: number, one: string, many: string): string {
    return `${n} ${n === 1 ? one : many}`;
  },
  /** «A, B y C». */
  list(xs: string[]): string {
    return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
  },
  /** «ahora», «hace 5 min», «a las 18:02», «ayer a las 18:02», «el dom 8 nov». */
  ago(ms: number, now: number): string {
    const d = now - ms;
    if (d < 90000) return "ahora";
    if (d < 3600000) return `hace ${Math.round(d / 60000)} min`;
    if (fmt.day(ms) === fmt.day(now)) return `a las ${fmt.hm(ms)}`;
    if (d < 2 * 86400000) return `ayer a las ${fmt.hm(ms)}`;
    return `el ${fmt.day(ms)}`;
  },
};
