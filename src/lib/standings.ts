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
  /** The lines that were not a team's row (headers, titles, junk), as they came. */
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
const POSITION = /^\d{1,2}\s*(?:\.|º|°|ª|\.º)?$/;
const LEADING_POSITION = /^\d{1,2}(?:\s*(?:\.º|\.|º|°|ª))?\s+(?=\p{L})/u;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
const cellsOf = (line: string) => line.split(/\t|\s{2,}/).map((c) => c.trim()).filter(Boolean);

/** A header line's columns after the team («Pos Equipo PJ G E P GF GC Pts» → pj g e p gf gc pts), if it is one. */
function headerCols(cells: string[]): Col[] | null {
  const words = cells.map((c) => norm(c));
  const teamAt = words.findIndex((w) => TEAM_WORDS.has(w));
  const after = teamAt >= 0 ? words.slice(teamAt + 1) : words.filter((w) => !POS_WORDS.has(w));
  if (after.length < 7 || !after.every((w) => w in HEADER_WORDS)) return null;
  const cols = after.map((w) => HEADER_WORDS[w]);
  return NUM_KEYS.every((k) => cols.includes(k)) ? cols : null;
}

// The orders a league web uses when there is no header: Pts last (with or without DG) or Pts first.
const LAYOUTS: Record<number, Col[][]> = {
  7: [["pj", "g", "e", "p", "gf", "gc", "pts"], ["pts", "pj", "g", "e", "p", "gf", "gc"]],
  8: [["pj", "g", "e", "p", "gf", "gc", "dg", "pts"], ["pts", "pj", "g", "e", "p", "gf", "gc", "dg"]],
};
const fits = (r: Record<Col, number>, cols: Col[]) => r.g + r.e + r.p === r.pj && (!cols.includes("dg") || r.dg === r.gf - r.gc);
function rowFrom(team: string, nums: number[], cols: Col[]): Record<Col, number> & { team: string } {
  const r = { team, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, dg: 0, skip: 0 };
  cols.forEach((c, i) => (r[c] = nums[i] ?? 0));
  return r;
}

/** Is this our team's name? (the club is «Manchester Piti»; the league may write «MANCHESTER PITI CF»). */
export const looksLikeUs = (team: string) => /\bpiti\b/.test(norm(team));

/**
 * A table copied from a web page or a spreadsheet (cells split by tabs or by two or more spaces) into rows.
 * Header lines name the columns when they can («Pts» first or last, a «DG» column); without one the
 * numbers' own arithmetic picks the order (G + E + P = PJ). A position in the first column is dropped;
 * titles, blank and junk lines are skipped and listed. Our row is the one called like us, or the one
 * `usTeam` names (the last save's).
 */
export function parseLeagueTable(text: string, usTeam?: string): ParsedTable {
  const out: ParsedTable = { rows: [], skipped: [], jornada: null };
  let header: Col[] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, " ").trim();
    if (!line) continue;
    const j = /jornada\s*(\d{1,2})\b/i.exec(line);
    let cells = cellsOf(line);
    const h = headerCols(cells);
    if (h) {
      header = h;
      out.skipped.push(line);
      continue;
    }
    // (the position: its own cell, or glued to the name «1. Rayo»)
    if (cells.length > 1 && POSITION.test(cells[0]) && !NUM.test(cells[1])) cells = cells.slice(1);
    const teamAt = cells.findIndex((c) => !NUM.test(c));
    // (a text cell after the name — a «form» column — is not a number: left out)
    const nums = teamAt >= 0 ? cells.slice(teamAt + 1).filter((c) => NUM.test(c)).map(Number) : [];
    const team = teamAt >= 0 ? cells[teamAt].replace(LEADING_POSITION, "").trim().slice(0, STANDINGS_LIMITS.team) : "";
    const layouts = header && header.length === nums.length ? [header] : (LAYOUTS[nums.length] ?? []);
    if (!team || !layouts.length) {
      if (j && out.jornada === null) out.jornada = Number(j[1]);
      out.skipped.push(line);
      continue;
    }
    const tries = layouts.map((cols) => ({ cols, r: rowFrom(team, nums, cols) }));
    const pick = tries.find((t) => fits(t.r, t.cols)) ?? tries[0];
    const r = pick.r;
    out.rows.push({ team, pj: Math.max(0, r.pj), g: Math.max(0, r.g), e: Math.max(0, r.e), p: Math.max(0, r.p), gf: Math.max(0, r.gf), gc: Math.max(0, r.gc), pts: Math.max(0, r.pts), isUs: false });
  }
  const want = usTeam ? norm(usTeam) : "";
  const named = want ? out.rows.findIndex((r) => norm(r.team) === want) : -1;
  const us = named >= 0 ? named : out.rows.findIndex((r) => looksLikeUs(r.team));
  if (us >= 0) out.rows[us].isUs = true;
  return out;
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
