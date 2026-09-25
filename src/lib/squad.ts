// Domain logic for the public squad page ("Plantilla"): one row per player of the season,
// sorting, search, squad figures and the head-to-head comparison.

const DAY = 86_400_000;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const SIGNS: [number, number, string][] = [
  [1, 20, "Capricornio"], [2, 19, "Acuario"], [3, 21, "Piscis"], [4, 20, "Aries"], [5, 21, "Tauro"], [6, 21, "Géminis"],
  [7, 23, "Cáncer"], [8, 23, "Leo"], [9, 23, "Virgo"], [10, 23, "Libra"], [11, 22, "Escorpio"], [12, 22, "Sagitario"], [13, 1, "Capricornio"],
];

export type MissingField = "cumpleaños" | "altura" | "peso";
export interface SquadRow {
  id: string;
  /** Name on the shirt this season. */
  name: string;
  num: string;
  full: string;
  position?: string;
  age: number | null;
  year: number | null;
  height: number | null;
  weight: number | null;
  birthday: { label: string; days: number } | null;
  sign: string | null;
  missing: MissingField[];
  historic: boolean;
  stats: { played: number; goals: number; assists: number; minutes: number | null };
}
export interface SquadPlayer {
  id: string;
  shirtName?: string;
  firstName?: string;
  lastName?: string;
  number?: number;
  birthDate?: string;
  height?: number;
  weight?: number;
  naturalPosition?: string;
  active?: boolean;
}
export interface SquadStats {
  matchesPlayed: number;
  goals: number;
  assists: number;
  minutes: number;
  tracked: number;
}

function birthParts(birthDate?: string) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}
export function zodiac(month: number, day: number) {
  return SIGNS.find(([m, d]) => month < m || (month === m && day < d))![2];
}
/** "1,83" from 183 cm. */
export function formatHeight(cm: number | null | undefined) {
  return cm ? (cm / 100).toFixed(2).replace(".", ",") : "—";
}
export function missingText(missing: MissingField[]) {
  return missing.length > 1 ? `${missing.slice(0, -1).join(", ")} y ${missing[missing.length - 1]}` : (missing[0] ?? "");
}

export function squadRow(p: SquadPlayer, stats: SquadStats, now: number): SquadRow {
  const today = new Date(now);
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const b = birthParts(p.birthDate);
  let age: number | null = null;
  let birthday: SquadRow["birthday"] = null;
  if (b) {
    const m0 = today.getUTCMonth() + 1;
    age = today.getUTCFullYear() - b.y - (m0 < b.m || (m0 === b.m && today.getUTCDate() < b.d) ? 1 : 0);
    let at = Date.UTC(today.getUTCFullYear(), b.m - 1, b.d);
    if (at < base) at = Date.UTC(today.getUTCFullYear() + 1, b.m - 1, b.d);
    birthday = { label: `${b.d} ${MONTHS[b.m - 1]}`, days: Math.round((at - base) / DAY) };
  }
  const height = p.height || null;
  const weight = p.weight || null;
  const missing: MissingField[] = [];
  if (!b) missing.push("cumpleaños");
  if (!height) missing.push("altura");
  if (!weight) missing.push("peso");
  return {
    id: p.id,
    name: p.shirtName || [p.firstName, p.lastName].filter(Boolean).join(" ") || "Jugador",
    num: p.number != null ? String(p.number) : "",
    full: [p.firstName, p.lastName].filter(Boolean).join(" "),
    position: p.naturalPosition || undefined,
    age: age != null && age >= 0 && age < 110 ? age : null,
    year: b?.y ?? null,
    height,
    weight,
    birthday,
    sign: b ? zodiac(b.m, b.d) : null,
    missing,
    historic: p.active === false,
    stats: { played: stats.matchesPlayed, goals: stats.goals, assists: stats.assists, minutes: stats.tracked ? stats.minutes : null },
  };
}

export type SquadSort = "num" | "name" | "age" | "height";
/** Missing values always sort last; ties fall back to the dorsal. */
export function sortSquad(rows: SquadRow[], sort: SquadSort) {
  const num = (r: SquadRow) => (r.num ? Number(r.num) : 999);
  const key = (r: SquadRow): number | string =>
    sort === "name" ? r.name : sort === "age" ? (r.age == null ? 999 : r.age) : sort === "height" ? (r.height ? -r.height : 999) : num(r);
  return [...rows].sort((a, b) => {
    const x = key(a), y = key(b);
    const c = typeof x === "string" ? x.localeCompare(String(y), "es") : x - Number(y);
    return c || num(a) - num(b) || a.name.localeCompare(b.name, "es");
  });
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function matchesQuery(row: SquadRow, query: string) {
  const q = fold(query.trim());
  return !q || fold(`${row.name} ${row.full}`).includes(q) || row.num === q;
}

export function squadSummary(rows: SquadRow[]) {
  const ages = rows.filter((r) => r.age != null);
  const years = new Map<number, number>();
  for (const r of rows) if (r.year) years.set(r.year, (years.get(r.year) ?? 0) + 1);
  const [quinta] = [...years.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  return {
    size: rows.length,
    avgAge: ages.length ? (ages.reduce((s, r) => s + r.age!, 0) / ages.length).toFixed(1).replace(".", ",") : null,
    agesKnown: ages.length,
    quinta: quinta ? { year: quinta[0], count: quinta[1] } : null,
    incomplete: rows.filter((r) => r.missing.length).length,
  };
}

export type MetricKey = "age" | "height" | "weight" | "played" | "goals" | "assists" | "minutes";
export const PROFILE_METRICS: [MetricKey, string][] = [["age", "Edad"], ["height", "Altura"], ["weight", "Peso"]];
export const SEASON_METRICS: [MetricKey, string][] = [["played", "Partidos"], ["goals", "Goles"], ["assists", "Asist."], ["minutes", "Minutos"]];
const value = (r: SquadRow, k: MetricKey): number | null =>
  k === "age" ? r.age : k === "height" ? r.height : k === "weight" ? r.weight : k === "minutes" ? r.stats.minutes : r.stats[k];
/** Bars start from a sensible floor so small real differences stay visible. */
const FLOOR: Partial<Record<MetricKey, number>> = { age: 17, height: 150, weight: 50 };
export interface Metric {
  key: MetricKey;
  label: string;
  left: string;
  right: string;
  leftPct: number;
  rightPct: number;
  /** Only "more is better" metrics have a winner: never age or weight. */
  leftWins: boolean;
  rightWins: boolean;
}
export function compareMetric(key: MetricKey, label: string, a: SquadRow, b: SquadRow, all: SquadRow[]): Metric {
  const l = value(a, key), r = value(b, key);
  const lo = FLOOR[key] ?? 0;
  const top = Math.max(lo + 1, ...all.map((x) => value(x, key) ?? 0));
  const pct = (v: number | null) => (v == null ? 0 : Math.max(6, Math.round(((v - lo) / (top - lo)) * 100)));
  const fmt = (v: number | null) => (v == null ? "—" : key === "height" ? formatHeight(v) : String(v));
  const ranked = key !== "age" && key !== "weight" && l != null && r != null;
  return { key, label, left: fmt(l), right: fmt(r), leftPct: pct(l), rightPct: pct(r), leftWins: ranked && l! > r!, rightWins: ranked && r! > l! };
}

export function duelVerdict(a: SquadRow, b: SquadRow, withStats: boolean) {
  let text: string;
  if (a.height && b.height && a.height === b.height) text = `Misma altura: ${formatHeight(a.height)} m cada uno.`;
  else if (a.height && b.height) {
    const [hi, lo] = a.height > b.height ? [a, b] : [b, a];
    text = `${hi.name} le saca ${hi.height! - lo.height!} cm a ${lo.name}.`;
  } else text = `A ${a.height ? b.name : a.name} le falta la altura en su ficha; sin ese dato la comparación queda a medias.`;
  if (a.age != null && b.age != null && a.age !== b.age) text += ` ${a.age < b.age ? a.name : b.name} es el más joven de los dos.`;
  if (withStats) {
    const g = a.stats.goals === b.stats.goals
      ? `Empatados a ${a.stats.goals} ${a.stats.goals === 1 ? "gol" : "goles"}.`
      : `${a.stats.goals > b.stats.goals ? a.name : b.name} va por delante en goles (${Math.max(a.stats.goals, b.stats.goals)} a ${Math.min(a.stats.goals, b.stats.goals)}).`;
    text = `${g} ${text}`;
  }
  return text;
}
