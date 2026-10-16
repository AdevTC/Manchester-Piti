// La clasificación de la liga (pure; docs/superpowers/specs/2026-10-16-clasificacion-design.md). The captains
// keep the league table by hand or by pasting it from the league's web: `standings/{seasonId}` holds
// `{ competition, jornada, updatedAt, updatedBy, rows, rowsPrev? }` and everyone reads it. Here: the doc's
// mapper, the paste parser, the save's validation (what the rules would refuse) and its hints (what never
// blocks), the payload, and the public words («Vamos 3.º de 12 · 18 pts · J8», «Actualizada el 12 oct»).
import { z } from "zod";
import { madridDate, MONTHS_SHORT } from "./derived/madrid";
import { toMillis } from "./derived/notices";
import { reportDroppedDoc } from "./docTelemetry";

export const STANDINGS_KEY = ["standings"] as const;
/** The caps (the same as firestore.rules). */
export const STANDINGS_LIMITS = { minRows: 2, maxRows: 24, team: 40, competition: 80, jornada: 99 } as const;

export interface StandingRow {
  team: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  pts: number;
  isUs: boolean;
}
export const NUM_KEYS = ["pj", "g", "e", "p", "gf", "gc", "pts"] as const;
export type NumKey = (typeof NUM_KEYS)[number];

export interface Standings {
  /** The season id (the doc id). */
  id: string;
  competition: string;
  jornada: number | null;
  /** ms (0 while the server time is pending). */
  updatedAt: number;
  updatedBy: string;
  rows: StandingRow[];
  /** The table before the last save (the arrows), if kept. */
  rowsPrev?: StandingRow[];
}

// ───────────────────────── reading the doc ─────────────────────────
const int = z.number().int().min(0);
const rowSchema = z.object({ team: z.string().min(1).max(STANDINGS_LIMITS.team), pj: int, g: int, e: int, p: int, gf: int, gc: int, pts: int, isUs: z.boolean() });
const docSchema = z.object({
  competition: z.string().catch(""),
  jornada: z.number().int().min(0).nullable().catch(null),
  updatedAt: z.unknown(),
  updatedBy: z.string().catch(""),
  rows: z.array(rowSchema).min(STANDINGS_LIMITS.minRows).max(STANDINGS_LIMITS.maxRows),
  rowsPrev: z.array(rowSchema).optional().catch(undefined),
});

/** Canonical `["standings"]` mapper: an invalid table is dropped (and reported), never half shown. */
export function mapStandings(id: string, data: unknown): Standings | null {
  const r = docSchema.safeParse(data ?? {});
  if (!r.success || r.data.rows.filter((x) => x.isUs).length !== 1) {
    reportDroppedDoc("standings", id, r.success ? [] : r.error.issues);
    return null;
  }
  const { updatedAt, rowsPrev, ...rest } = r.data;
  return { id, ...rest, updatedAt: toMillis(updatedAt) ?? 0, ...(rowsPrev?.length ? { rowsPrev } : {}) };
}

// ───────────────────────── «Pegar desde la liga» ─────────────────────────
export interface ParsedTable {
  rows: StandingRow[];
  /** The lines that were not read (titles, junk, a row the parser could not make out), as they came; the
   *  header and the «Jornada 8» line were read, so they are not here. */
  skipped: string[];
  /** A «Jornada 8» line, if the paste had one. */
  jornada: number | null;
}

type Col = NumKey | "dg" | "skip";
const HEADER_WORDS: Record<string, Col> = {
  pj: "pj", j: "pj", jug: "pj", jugados: "pj", pts: "pts", pt: "pts", ptos: "pts", puntos: "pts",
  g: "g", pg: "g", v: "g", ganados: "g", e: "e", pe: "e", x: "e", empatados: "e", p: "p", pp: "p", perdidos: "p",
  gf: "gf", f: "gf", "g.f.": "gf", gc: "gc", c: "gc", "g.c.": "gc", ga: "gc", dg: "dg", dif: "dg", df: "dg", "+/-": "dg",
};
const TEAM_WORDS = new Set(["equipo", "equipos", "club", "team", "nombre"]);
const POS_WORDS = new Set(["pos", "pos.", "#", "puesto", "nº", "n.º"]);
const NUM = /^[+-]?\d+$/;
/** A cell of numbers split by single spaces («8 6 1 1 25 8 19»). */
const NUMS = /^[+-]?\d+(?:\s+[+-]?\d+)*$/;
const POSITION = /^\d{1,2}\s*(?:\.|º|°|ª|\.º)?$/;
const LEADING_POSITION = /^\d{1,2}(?:\s*(?:\.º|\.|º|°|ª))?\s+(?=\p{L})/u;
const LETTER = /\p{L}/u;
const MIN_NUMS = NUM_KEYS.length;
/** Lower case, no accents, single spaces: how team names, competitions and header words are compared. */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
// (cells: tabs, two or more spaces, or a CSV's semicolons; a CSV's quotes around a cell are not part of it)
const cellsOf = (line: string) =>
  line
    .split(/\t|;|\s{2,}/)
    .map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim())
    .filter(Boolean);
const headerCol = (w: string): Col | null => (Object.hasOwn(HEADER_WORDS, w) ? HEADER_WORDS[w] : null);

/**
 * A header line's columns after the team («Pos Equipo PJ G E P GF GC Pts» → pj g e p gf gc pts), if it is one.
 * An unknown column after the first known one («San», «Últimos 5») is kept as one to skip.
 */
function headerCols(cells: string[]): Col[] | null {
  const words = cells.flatMap((c) => norm(c).split(" "));
  const teamAt = words.findIndex((w) => TEAM_WORDS.has(w));
  const after = teamAt >= 0 ? words.slice(teamAt + 1) : words.filter((w) => !POS_WORDS.has(w));
  const first = after.findIndex((w) => headerCol(w) !== null);
  if (first < 0 || after.length - first < MIN_NUMS) return null;
  const cols = after.slice(first).map((w) => headerCol(w) ?? "skip");
  return NUM_KEYS.every((k) => cols.includes(k)) ? cols : null;
}

// The orders a league web uses when there is no header: Pts last (with or without DG) or Pts first.
const LAYOUTS: Col[][] = [
  ["pj", "g", "e", "p", "gf", "gc", "dg", "pts"],
  ["pts", "pj", "g", "e", "p", "gf", "gc", "dg"],
  ["pj", "g", "e", "p", "gf", "gc", "pts"],
  ["pts", "pj", "g", "e", "p", "gf", "gc"],
];
type Parsed = Record<Col, number>;
const fits = (r: Parsed, cols: Col[]) => r.g + r.e + r.p === r.pj && (!cols.includes("dg") || r.dg === r.gf - r.gc);
function rowFrom(nums: number[], cols: Col[]): Parsed {
  const r: Parsed = { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, dg: 0, skip: 0 };
  cols.forEach((c, i) => (r[c] = nums[i] ?? 0));
  return r;
}
/** `layout` at `offset` among `n` numbers (the others skipped). */
const placed = (layout: Col[], offset: number, n: number): Col[] => [...Array<Col>(offset).fill("skip"), ...layout, ...Array<Col>(n - offset - layout.length).fill("skip")];

/**
 * The columns of a row's numbers: the header's when it has as many; otherwise the first of the usual orders
 * (in any run of the numbers, so an extra column — a «San» after Pts — is left out) whose arithmetic holds
 * (G + E + P = PJ, DG = GF − GC). `fit` says whether it held; when nothing does, the last seven numbers as
 * PJ G E P GF GC Pts (the last eight with DG when there are eight).
 */
function pickCols(nums: number[], header: Col[] | null): { r: Parsed; fit: boolean } | null {
  const n = nums.length;
  if (n < MIN_NUMS) return null;
  if (header) {
    const known = header.filter((c) => c !== "skip");
    const cols = header.length === n ? header : known.length === n ? known : null;
    if (cols) return { r: rowFrom(nums, cols), fit: true };
  }
  for (const layout of LAYOUTS) {
    for (let offset = 0; offset + layout.length <= n; offset++) {
      const cols = placed(layout, offset, n);
      const r = rowFrom(nums, cols);
      if (fits(r, cols)) return { r, fit: true };
    }
  }
  const fallback = n === 8 ? LAYOUTS[0] : LAYOUTS[2];
  return { r: rowFrom(nums, placed(fallback, n - fallback.length, n)), fit: false };
}

/** Is this our team's name? (the club is «Manchester Piti»; the league may write «MANCHESTER PITI CF»). */
export const looksLikeUs = (team: string) => /\bpiti\b/.test(norm(team));

/**
 * A table copied from a web page, a spreadsheet or a CSV (cells split by tabs, two or more spaces or
 * semicolons) into rows. Header lines name the columns when they can («Pts» first or last, a «DG» column,
 * an extra one to leave out); without one the numbers' own arithmetic picks the order (G + E + P = PJ).
 * Numbers split by single spaces, even glued to the name, are read too. A position in the first column is
 * dropped; titles, blank and junk lines are skipped and listed. Our row is the one called like us, or the
 * one `usTeam` names (the last save's).
 */
export function parseLeagueTable(text: string, usTeam?: string): ParsedTable {
  const out: ParsedTable = { rows: [], skipped: [], jornada: null };
  let header: Col[] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, " ").trim();
    if (!line) continue;
    let cells = cellsOf(line);
    const h = headerCols(cells);
    if (h) {
      header = h;
      continue;
    }
    // (the position: its own cell, or glued to the name «1. Rayo»)
    if (cells.length > 1 && POSITION.test(cells[0]) && !NUMS.test(cells[1])) cells = cells.slice(1);
    const teamAt = cells.findIndex((c) => !NUMS.test(c));
    // (a text cell after the name — a «form» column — is not a number: left out)
    const nums = teamAt >= 0 ? cells.slice(teamAt + 1).flatMap((c) => (NUMS.test(c) ? c.split(/\s+/).map(Number) : [])) : [];
    const words = teamAt >= 0 ? cells[teamAt].split(" ") : [];
    let pick = pickCols(nums, header);
    // (numbers glued to the name by single spaces: peeled off its end, one at a time, until a row fits)
    if (!pick?.fit) {
      const peeled = [...words];
      const more = [...nums];
      while (peeled.length > 1 && NUM.test(peeled[peeled.length - 1])) {
        more.unshift(Number(peeled.pop()));
        const p = pickCols(more, header);
        if (p && (p.fit || !pick)) {
          pick = p;
          words.splice(peeled.length);
          if (p.fit) break;
        }
      }
    }
    const team = words.join(" ").replace(LEADING_POSITION, "").trim().slice(0, STANDINGS_LIMITS.team);
    if (!pick || !LETTER.test(team)) {
      const j = /jornada\s*(\d{1,2})\b/i.exec(line);
      if (j && out.jornada === null) out.jornada = Number(j[1]);
      else out.skipped.push(line);
      continue;
    }
    const r = pick.r;
    out.rows.push({ team, pj: Math.max(0, r.pj), g: Math.max(0, r.g), e: Math.max(0, r.e), p: Math.max(0, r.p), gf: Math.max(0, r.gf), gc: Math.max(0, r.gc), pts: Math.max(0, r.pts), isUs: false });
  }
  const want = usTeam ? norm(usTeam) : "";
  const named = want ? out.rows.findIndex((r) => norm(r.team) === want) : -1;
  const us = named >= 0 ? named : out.rows.findIndex((r) => looksLikeUs(r.team));
  if (us >= 0) out.rows[us].isUs = true;
  return out;
}

/** The jornada a paste brings: its «Jornada 8» line, or else the most matches any team has played (null
 *  without either). A value the captain typed wins over it (the editor decides). */
export function pasteJornada(t: Pick<ParsedTable, "rows" | "jornada">): number | null {
  if (t.jornada !== null) return t.jornada;
  const most = Math.max(0, ...t.rows.map((r) => r.pj));
  return most > 0 ? Math.min(most, STANDINGS_LIMITS.jornada) : null;
}

// ───────────────────────── saving ─────────────────────────
/** What the rules would refuse (the save waits until there is none). */
export function standingsErrors(rows: readonly StandingRow[]): string[] {
  const errs: string[] = [];
  if (rows.length < STANDINGS_LIMITS.minRows) errs.push(`Hacen falta al menos ${STANDINGS_LIMITS.minRows} equipos.`);
  if (rows.length > STANDINGS_LIMITS.maxRows) errs.push(`Caben ${STANDINGS_LIMITS.maxRows} equipos como mucho.`);
  const us = rows.filter((r) => r.isUs).length;
  if (us === 0) errs.push("Marca cuál somos nosotros («Somos nosotros»).");
  if (us > 1) errs.push("Solo un equipo puede ser «nosotros».");
  if (rows.some((r) => !r.team.trim())) errs.push("Cada equipo necesita un nombre.");
  if (rows.some((r) => r.team.length > STANDINGS_LIMITS.team)) errs.push(`Los nombres caben en ${STANDINGS_LIMITS.team} letras.`);
  if (rows.some((r) => NUM_KEYS.some((k) => !Number.isInteger(r[k]) || r[k] < 0))) errs.push("Los números son enteros, de 0 en adelante.");
  return errs;
}

/** A record from the web's own results (the season's played matches). */
export interface WebRecord {
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
}
export interface StandingsHint {
  /** The row it is about (index in `rows`), or null for the table as a whole. */
  row: number | null;
  text: string;
}
/**
 * The consistency hints, which never block saving: a row whose G + E + P is not its PJ, one whose Pts is
 * not 3·G + E (some leagues count otherwise), and our row disagreeing with the web's own results.
 */
export function standingsHints(rows: readonly StandingRow[], web?: WebRecord | null): StandingsHint[] {
  const out: StandingsHint[] = [];
  rows.forEach((r, i) => {
    const name = r.team.trim() || `Fila ${i + 1}`;
    if (r.g + r.e + r.p !== r.pj) out.push({ row: i, text: `${name}: G + E + P (${r.g + r.e + r.p}) ≠ PJ (${r.pj})` });
    if (3 * r.g + r.e !== r.pts) out.push({ row: i, text: `${name}: Pts (${r.pts}) ≠ 3·G + E (${3 * r.g + r.e}) · algunas ligas puntúan distinto` });
  });
  const us = rows.findIndex((r) => r.isUs);
  if (web && us >= 0) {
    const r = rows[us];
    const LABEL: Record<keyof WebRecord, string> = { pj: "PJ", g: "G", e: "E", p: "P", gf: "GF", gc: "GC" };
    const diff = (Object.keys(LABEL) as (keyof WebRecord)[]).filter((k) => r[k] !== web[k]);
    if (diff.length) out.push({ row: us, text: `Nuestra fila no cuadra con los resultados de la web: ${diff.map((k) => `${LABEL[k]} ${r[k]} aquí, ${web[k]} en la web`).join(" · ")}` });
  }
  return out;
}

export interface StandingsInput {
  competition: string;
  jornada: number | null;
  rows: readonly StandingRow[];
}
const cleanRow = (r: StandingRow): StandingRow => ({ team: r.team.trim().slice(0, STANDINGS_LIMITS.team), pj: r.pj, g: r.g, e: r.e, p: r.p, gf: r.gf, gc: r.gc, pts: r.pts, isUs: r.isUs });
/**
 * The doc a save writes (without `updatedAt`, the server's time). `rowsPrev` keeps the table before this
 * save, for the arrows: a new jornada shifts the saved rows into it; a correction within the same jornada
 * keeps the arrows it already had (so fixing a typo doesn't flatten them).
 */
export function standingsFields(input: StandingsInput, uid: string, prev?: Pick<Standings, "rows" | "rowsPrev" | "jornada"> | null) {
  const sameJornada = !!prev && prev.jornada !== null && prev.jornada === input.jornada;
  const rowsPrev = !prev ? undefined : sameJornada ? prev.rowsPrev : prev.rows;
  return {
    competition: input.competition.trim().slice(0, STANDINGS_LIMITS.competition),
    jornada: input.jornada,
    updatedBy: uid,
    rows: input.rows.map(cleanRow),
    ...(rowsPrev?.length ? { rowsPrev: rowsPrev.map(cleanRow) } : {}),
  };
}

// ───────────────────────── the public words ─────────────────────────
/** «3.º». */
export const ordinal = (n: number) => `${n}.º`;
/** Our place in the table (1-based), or null. */
export const ourPlace = (s: Pick<Standings, "rows">) => {
  const i = s.rows.findIndex((r) => r.isUs);
  return i >= 0 ? i + 1 : null;
};
/** «Vamos 3.º de 12 · 18 pts · J8» (no jornada: no «J»). Null without our row. */
export function stripText(s: Pick<Standings, "rows" | "jornada">): string | null {
  const place = ourPlace(s);
  if (place === null) return null;
  const us = s.rows[place - 1];
  return [`Vamos ${ordinal(place)} de ${s.rows.length}`, `${us.pts} ${us.pts === 1 ? "pt" : "pts"}`, s.jornada ? `J${s.jornada}` : ""].filter(Boolean).join(" · ");
}
/** «Actualizada el 12 oct» (Madrid's day), or null while the time is unknown. */
export function updatedText(ms: number): string | null {
  if (!ms) return null;
  const [, m, d] = madridDate(ms).split("-").map(Number);
  return `Actualizada el ${d} ${MONTHS_SHORT[m - 1]}`;
}

export type Move = { dir: "up" | "down"; by: number } | { dir: "same" } | { dir: "new" } | null;
/** Each row's move since the previous save (by team name): up, down, the same, new in the table; null
 *  for every row when there is no previous table. */
export function movesOf(rows: readonly StandingRow[], prev?: readonly StandingRow[]): Move[] {
  if (!prev?.length) return rows.map(() => null);
  const before = new Map(prev.map((r, i) => [norm(r.team), i]));
  return rows.map((r, i) => {
    const was = before.get(norm(r.team));
    if (was === undefined) return { dir: "new" };
    return was > i ? { dir: "up", by: was - i } : was < i ? { dir: "down", by: i - was } : { dir: "same" };
  });
}
/** The move in words, for screen readers and the title («Sube 2 puestos»). */
export function moveText(m: Move): string {
  if (!m) return "";
  if (m.dir === "same") return "Sigue en su puesto";
  if (m.dir === "new") return "Nuevo en la tabla";
  return `${m.dir === "up" ? "Sube" : "Baja"} ${m.by} ${m.by === 1 ? "puesto" : "puestos"}`;
}
