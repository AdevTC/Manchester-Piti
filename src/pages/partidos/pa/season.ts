// Partidos «Vidrio» (PA- boards), the season the three screens read: production's matches (seasonStrip's states,
// scores and light) in the shape of the board's model — each jornada with its minute-stamped key events, the
// ledger's minutes and stints, the saves, the weather, the MVP vote and the siete — plus the table words the
// boards use (our line, the published table with «si acaba así», «¿y si…?», streaks, scorers, five-minute
// stretches, who is on the pitch). Pure: no React, no Firebase.
import type { ClubMatch } from "../../../lib/clubData";
import type { StandingRow } from "../../../lib/standings";
import { isPendingDup, eventMinute } from "../../../../functions/src/matchEngine";
import { sunPosition, type LightKey } from "../../../lib/derived/sun";
import type { StripSegment } from "../../../lib/derived/vidrio/strip";
import { venueName } from "../../../lib/derived/venue";
import { logoOf } from "../../../lib/derived/rivalLogo";
import { daysBetween, lightLine, paintGradient, paintOf, rivalInitials, type PaintKey } from "../vidrio/model";

export type PState = "jugado" | "directo" | "hoy" | "proximo" | "aplazado" | "pendiente";
export type Letter = "G" | "E" | "P";
/** A key event: g our goal · r theirs · y our yellow · rd our red · ry the rival's card · pc penalty against ·
 *  sv a save · w the woodwork · s a substitution (player out, player in). */
export type EvKind = "g" | "r" | "y" | "rd" | "ry" | "pc" | "sv" | "w" | "s";
export interface Ev {
  min: number;
  k: EvKind;
  who?: string;
  /** The assist (a goal) or the player coming in (a substitution). */
  with?: string;
}
export interface Paint {
  a: PaintKey;
  b: PaintKey;
  m0: number;
  m1: number;
  sun: { x: number; y: number; noon: boolean } | null;
  floods: boolean;
  light: LightKey;
  /** «Sol de mediodía, a 36°», «Atardecer y focos»… */
  line: string;
}
export interface Mvp {
  open: boolean;
  /** Turnout while open (never the tally). */
  votes: number | null;
  of: number | null;
  closes: number | null;
  winners: string[];
}
export interface Raw {
  starters: string[];
  bench: string[];
  min: Record<string, number> | null;
  stints: Record<string, [number, number][]> | null;
  saves: number;
  savesBy: Record<string, number>;
  subs: number;
  wx: { t: number; l: string } | null;
  mvp: Mvp | null;
  narrated: boolean;
  lineup: string[];
  system: string;
  fc: { h: string; t: number; ko: boolean }[] | null;
  postponedReason: string;
  postponedTo: number | null;
}
export interface PMatch {
  j: number;
  id: string;
  match: ClubMatch;
  rival: string;
  ini: string;
  /** The rival's escudo (the newest acta against them that saved one). */
  logo?: string;
  home: boolean;
  at: number;
  venue: string;
  kit: "home" | "away";
  dur: number;
  ev: Ev[];
  state: PState;
  score: { gf: number; ga: number } | null;
  letter: Letter | null;
  minute: number | null;
  provisional: boolean;
  paint: Paint;
  raw: Raw;
}
export interface PSeason {
  now: number;
  matches: PMatch[];
  played: PMatch[];
  live: PMatch | null;
  open: PMatch[];
  next: PMatch | null;
  /** What Jornadas opens on (see focusOf). */
  focus: PMatch | null;
}

const OUR_GOAL = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIR_GOAL = new Set(["opponent_goal", "own_goal"]);
const KIND: Record<string, EvKind> = { yellow_card: "y", double_yellow: "y", red_card: "rd", opponent_yellow: "ry", opponent_red: "ry", penalty_committed: "pc", save: "sv", woodwork: "w", substitution: "s" };

/** The key events of a match, in minute order (the pending duplicates left out, as every score does). */
export function keyEvents(m: ClubMatch): Ev[] {
  const out: Ev[] = [];
  for (const e of m.events ?? []) {
    if (isPendingDup(e)) continue;
    const min = eventMinute(e);
    if (min === null) continue;
    const k: EvKind | undefined = OUR_GOAL.has(e.type) ? "g" : THEIR_GOAL.has(e.type) ? "r" : KIND[e.type];
    if (!k) continue;
    const x: Ev = { min, k };
    if (e.type !== "opponent_own_goal" && e.playerId) x.who = e.playerId;
    if (k === "g" && e.assistPlayerId) x.with = e.assistPlayerId;
    if (k === "s" && e.inPlayerId) x.with = e.inPlayerId;
    out.push(x);
  }
  return out.sort((a, b) => a.min - b.min);
}

function rawOf(m: ClubMatch, extra: { mvp: Mvp | null; fc: Raw["fc"] }): Raw {
  let min: Record<string, number> | null = null;
  let stints: Record<string, [number, number][]> | null = null;
  let saves = 0;
  const savesBy: Record<string, number> = {};
  for (const [id, v] of Object.entries(m.ledger ?? {})) {
    if (v.minutes) {
      (min ??= {})[id] = v.minutes;
      (stints ??= {})[id] = (v.stints ?? []).map((s) => [s.from, s.to]);
    }
    const sv = typeof v.saves === "number" ? v.saves : 0;
    if (sv) {
      saves += sv;
      savesBy[id] = sv;
    }
  }
  const lineup = (m as ClubMatch & { lineup?: unknown }).lineup as { system?: string; slots?: { playerId?: string }[] } | undefined;
  return {
    starters: m.starters ?? [],
    bench: m.bench ?? [],
    min,
    stints,
    saves,
    savesBy,
    subs: (m.events ?? []).filter((e) => e.type === "substitution" && !isPendingDup(e)).length,
    wx: m.weatherAtKickoff && typeof m.weatherAtKickoff.temp === "number" ? { t: Math.round(m.weatherAtKickoff.temp), l: m.weatherAtKickoff.label ?? "" } : null,
    mvp: extra.mvp,
    narrated: !!m.analysisCoverage,
    lineup: (lineup?.slots ?? []).map((s) => s.playerId ?? "").filter(Boolean),
    system: typeof m.system === "string" ? m.system : (lineup?.system ?? ""),
    fc: extra.fc,
    postponedReason: m.postponedReason ?? "",
    postponedTo: typeof m.postponedTo === "number" ? m.postponedTo : null,
  };
}

export interface SeasonInputs {
  segments: readonly StripSegment[];
  now: number;
  /** The live jornada's minute (shownMinute). */
  liveMinute: number | null;
  mvpOf: (m: ClubMatch) => Mvp | null;
  /** The hourly forecast of a match, when known. */
  fcOf?: (m: ClubMatch) => Raw["fc"];
  /** Every rival's escudo (rivalLogos of all the matches, any season). */
  logos?: ReadonlyMap<string, string>;
}

const DAY = 86_400_000;

/** The season at `now`: every dated, not-cancelled jornada of the strip. */
export function seasonOf({ segments, now, liveMinute, mvpOf, fcOf, logos }: SeasonInputs): PSeason {
  const matches: PMatch[] = [];
  segments.forEach((s, i) => {
    if (s.state === "suspendido" || s.at === null) return;
    const m = s.match;
    const p = paintOf(s);
    const ev = keyEvents(m);
    const state: PState = s.state;
    const score = s.score && (state === "jugado" || state === "directo") ? s.score : null;
    const letter: Letter | null = score ? (score.gf > score.ga ? "G" : score.gf === score.ga ? "E" : "P") : null;
    matches.push({
      j: s.jornada ?? i + 1,
      id: s.id,
      match: m,
      rival: s.rival,
      ini: rivalInitials(s.rival, m.rivalInitials),
      logo: logoOf(logos, s.rival),
      home: s.home,
      at: s.at,
      venue: venueName(m.venue || "") || "CDM Palomeras",
      kit: m.kit === "away" ? "away" : m.kit === "home" ? "home" : s.home ? "home" : "away",
      dur: m.duration || 50,
      ev: state === "directo" && liveMinute !== null ? ev.filter((e) => e.min <= liveMinute) : ev,
      state,
      score,
      letter,
      minute: state === "directo" ? liveMinute : null,
      provisional: state === "directo" || s.provisional,
      paint: { ...p, light: s.light?.light ?? "noche", line: lightLine(s) },
      raw: rawOf(m, { mvp: state === "jugado" ? mvpOf(m) : null, fc: fcOf ? fcOf(m) : null }),
    });
  });
  const played = matches.filter((m) => m.state === "jugado" && m.score);
  const live = matches.find((m) => m.state === "directo") ?? null;
  const open = matches.filter((m) => m.state === "hoy" || m.state === "proximo" || m.state === "aplazado");
  const next = matches.find((m) => m.state === "hoy" || m.state === "proximo") ?? null;
  return { now, matches, played, live, open, next, focus: focusOf(matches, live, next, now) };
}

/** What Jornadas opens on: the live jornada, else today's, else the one just played (its acta stays in front until
 *  the day before the next jornada), else the next one, else the last. */
export function focusOf(ms: readonly PMatch[], live: PMatch | null, next: PMatch | null, now: number): PMatch | null {
  if (live) return live;
  const today = ms.find((m) => m.state === "hoy");
  if (today) return today;
  const last = [...ms].reverse().find((m) => (m.state === "jugado" || m.state === "pendiente") && m.at <= now);
  // (from the day before the next one, the next one leads)
  if (last && now - last.at < 7 * DAY && (!next || daysBetween(now, next.at) > 1)) return last;
  return next ?? ms[ms.length - 1] ?? null;
}

/** The sun's height at a kick-off (the cartel, the readout). */
export const elevationAt = (at: number): number => sunPosition(at).elevation;
export const grad = paintGradient;

// ───────────────────────── words ─────────────────────────

export const pluralW = (n: number, s: string, p?: string): string => `${n} ${n === 1 ? s : (p ?? `${s}s`)}`;
export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
export const listW = (a: readonly string[]): string => (a.length <= 1 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} y ${a[a.length - 1]}`);
export const capW = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const slugW = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ───────────────────────── the table ─────────────────────────

export interface TRow {
  team: string;
  us: boolean;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  pts: number;
  pos: number;
  prov?: boolean;
  sim?: boolean;
}

/** Our line from the matches (with the live one when `withLive`). */
export function ourLine(ms: readonly PMatch[], withLive: boolean): TRow {
  const r: TRow = { team: "Manchester Piti", us: true, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, pos: 0 };
  for (const m of ms) {
    if (!m.score || (m.state === "directo" && !withLive)) continue;
    r.pj++;
    r.gf += m.score.gf;
    r.gc += m.score.ga;
    if (m.letter === "G") {
      r.g++;
      r.pts += 3;
    } else if (m.letter === "E") {
      r.e++;
      r.pts++;
    } else r.p++;
  }
  return r;
}
const sortRows = (rows: TRow[]): TRow[] => [...rows].sort((a, b) => b.pts - a.pts || b.gf - b.gc - (a.gf - a.gc) || b.gf - a.gf || a.team.localeCompare(b.team, "es"));

/** The published table; with `withNow` the jornadas it does not count yet (live: «si acaba así»; played after its
 *  jornada) on our row and the rival's, both provisional. */
export function tableOf(rows: readonly StandingRow[] | null, jornada: number | null, se: PSeason, withNow: boolean): TRow[] | null {
  if (!rows) return null;
  const base: TRow[] = rows.map((r) => ({ team: r.team, us: r.isUs, pj: r.pj, g: r.g, e: r.e, p: r.p, gf: r.gf, gc: r.gc, pts: r.pts, pos: 0 }));
  const extra = withNow ? se.matches.filter((m) => m.score && (m.state === "directo" || (m.state === "jugado" && jornada !== null && m.j > jornada))) : [];
  for (const m of extra) {
    if (!m.score) continue;
    for (const r of base) {
      const theirs = !r.us && r.team.trim().toLowerCase() === m.rival.trim().toLowerCase();
      if (!r.us && !theirs) continue;
      const f = r.us ? m.score.gf : m.score.ga;
      const c = r.us ? m.score.ga : m.score.gf;
      r.pj++;
      r.gf += f;
      r.gc += c;
      r.prov = true;
      if (f > c) {
        r.g++;
        r.pts += 3;
      } else if (f === c) {
        r.e++;
        r.pts++;
      } else r.p++;
    }
  }
  return sortRows(base).map((r, i) => ({ ...r, pos: i + 1 }));
}

/** «¿Y si…?»: our row with the picked results (the rest of the league stays). */
export function simulate(rows: readonly TRow[], picks: Readonly<Record<string, Letter | null | undefined>>): TRow[] {
  const out = rows.map((r) => ({ ...r }));
  const us = out.find((r) => r.us);
  if (us)
    for (const l of Object.values(picks)) {
      if (!l) continue;
      us.pj++;
      us.sim = true;
      if (l === "G") {
        us.g++;
        us.pts += 3;
      } else if (l === "E") {
        us.e++;
        us.pts++;
      } else us.p++;
    }
  return sortRows(out).map((r, i) => ({ ...r, pos: i + 1 }));
}

export function streaks(played: readonly PMatch[]) {
  let cur: Letter | null = null;
  let n = 0;
  const best = { G: 0, unb: 0, sc: 0 };
  const run = { G: 0, unb: 0, sc: 0 };
  for (const m of played) {
    if (!m.letter || !m.score) continue;
    if (m.letter === cur) n++;
    else {
      cur = m.letter;
      n = 1;
    }
    run.G = m.letter === "G" ? run.G + 1 : 0;
    best.G = Math.max(best.G, run.G);
    run.unb = m.letter !== "P" ? run.unb + 1 : 0;
    best.unb = Math.max(best.unb, run.unb);
    run.sc = m.score.gf > 0 ? run.sc + 1 : 0;
    best.sc = Math.max(best.sc, run.sc);
  }
  return { cur, n, best, run };
}

export function scorers(ms: readonly PMatch[], known: (id: string) => boolean, nm: (id: string) => string) {
  const g: Record<string, number> = {};
  const a: Record<string, number> = {};
  const first: Record<string, { j: number; min: number }> = {};
  for (const m of ms)
    for (const e of m.ev) {
      if (e.k === "g" && e.who) {
        g[e.who] = (g[e.who] ?? 0) + 1;
        first[e.who] ??= { j: m.j, min: e.min };
        if (e.with) a[e.with] = (a[e.with] ?? 0) + 1;
      }
    }
  const rank = (o: Record<string, number>) =>
    Object.keys(o)
      .filter(known)
      .map((id) => ({ id, v: o[id] }))
      .sort((p, q) => q.v - p.v || nm(p.id).localeCompare(nm(q.id), "es"));
  return { goals: rank(g), assists: rank(a), first };
}

/** Goals by five-minute stretch (ten stretches: a 50′ match). */
export function stretches(ms: readonly PMatch[]) {
  const us = Array<number>(10).fill(0);
  const them = Array<number>(10).fill(0);
  for (const m of ms)
    for (const e of m.ev) {
      const b = Math.max(0, Math.min(9, Math.floor(Math.max(0, e.min - 1) / 5)));
      if (e.k === "g") us[b]++;
      else if (e.k === "r") them[b]++;
    }
  return { us, them };
}

/** Who is on the pitch at a minute: the ledger's stints (rolling subs), else the starters. */
export function onPitch(m: PMatch, minute: number): string[] {
  const st = m.raw.stints;
  if (st) return Object.keys(st).filter((k) => st[k].some(([a, b]) => a <= minute && minute < b));
  return [...m.raw.starters];
}
