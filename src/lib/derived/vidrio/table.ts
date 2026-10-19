// «Vidrio» · the league table: the focus mode (the leader … us ±3 …, with «N equipos más arriba/abajo») and
// «¿Y si…?», the table with results of make-believe on our remaining jornadas (and «Si acaba así», the live
// score as if it were final). Pure, on the captains' table (standings/{seasonId}, lib/standings).
//
// What a simulation moves: our row and, for each fixture, the row of the rival we play (matched by name,
// lib/standings norm). The other teams' remaining matches are left as they are — we don't know them — so a
// projected position is «if the rest stood still». A pick is a minimal result for the goal difference:
// G 1–0, E 0–0, P 0–1. Ties are broken by points, goal difference, goals for, and then the league's own
// order (it already settled the tie between those teams, head-to-head or otherwise).
import type { ClubMatch } from "../../clubData";
import { norm, type StandingRow } from "../../standings";
import { seasonStrip, type StripState } from "./strip";

// ───────────────────────── the focus mode ─────────────────────────

type TableLike = Pick<StandingRow, "team" | "pts" | "isUs">;

export interface FocusRow<R> {
  kind: "row";
  /** 1-based, the table's order. */
  pos: number;
  row: R;
  us: boolean;
  /** Level on points with the row above or below. */
  tied: boolean;
}
export interface FocusGap {
  kind: "gap";
  side: "arriba" | "abajo";
  count: number;
  /** «3 equipos más arriba», «1 equipo más abajo». */
  text: string;
}
export type FocusItem<R> = FocusRow<R> | FocusGap;

/** Our row's index: the row named `usTeam` (no accents, any case), else the one marked `isUs`; −1 without. */
export function usIndex(rows: readonly TableLike[], usTeam?: string | null): number {
  const want = usTeam ? norm(usTeam) : "";
  const named = want ? rows.findIndex((r) => norm(r.team) === want) : -1;
  return named >= 0 ? named : rows.findIndex((r) => r.isUs);
}

const gapText = (n: number, side: "arriba" | "abajo") => `${n} ${n === 1 ? "equipo" : "equipos"} más ${side}`;

/**
 * The table in focus mode: the leader, then us with `around` teams on each side (a full window of
 * 2·around + 1 rows, slid inwards at the table's ends), and a gap marker for each run left out. A gap of a
 * single team shows the team instead. A short table (2·around + 3 rows or fewer: the 7-team league) comes
 * whole. Without our row: the top 2·around + 1 and the rest as a gap.
 */
export function tableFocus<R extends TableLike>(rows: readonly R[], usTeam?: string | null, around = 3): FocusItem<R>[] {
  const n = rows.length;
  const us = usIndex(rows, usTeam);
  const item = (i: number): FocusRow<R> => ({
    kind: "row",
    pos: i + 1,
    row: rows[i],
    us: i === us,
    tied: (i > 0 && rows[i - 1].pts === rows[i].pts) || (i < n - 1 && rows[i + 1].pts === rows[i].pts),
  });
  const span = 2 * around + 1;
  if (n <= span + 2) return rows.map((_, i) => item(i));
  let a = us < 0 ? 0 : Math.max(0, us - around);
  let b = Math.min(n - 1, a + span - 1);
  a = Math.max(0, b - span + 1);
  // (a gap of one team takes the room of the team: show it)
  if (a === 2) a = 1;
  if (b === n - 2) b = n - 1;
  const out: FocusItem<R>[] = [];
  if (a > 0) out.push(item(0));
  if (a > 1) out.push({ kind: "gap", side: "arriba", count: a - 1, text: gapText(a - 1, "arriba") });
  for (let i = a; i <= b; i++) out.push(item(i));
  if (b < n - 1) out.push({ kind: "gap", side: "abajo", count: n - 1 - b, text: gapText(n - 1 - b, "abajo") });
  return out;
}

// ───────────────────────── «¿Y si…?» ─────────────────────────

export type PickLetter = "G" | "E" | "P";
export type SimPreset = "nada" | "ritmo" | "victorias" | "empates";
/** The presets in order, with the long label and the short one (1920's ribbon). */
export const SIM_PRESETS: readonly { id: SimPreset; label: string; short: string }[] = [
  { id: "nada", label: "Nada", short: "Nada" },
  { id: "ritmo", label: "Como hasta ahora", short: "Al ritmo" },
  { id: "victorias", label: "Todo victorias", short: "Todo G" },
  { id: "empates", label: "Todo empates", short: "Todo E" },
];

/** One of our jornadas still to play. */
export interface SimFixture {
  /** The match id (picks are keyed by it). */
  id: string;
  jornada: number | null;
  rival: string;
  at: number | null;
  state: Extract<StripState, "hoy" | "proximo" | "aplazado">;
}

/** Our jornadas still to play at `now`, in the order «¿Y si…?» lists them: today's and the upcoming ones by
 *  date, then the postponed ones. Not here: the live one (it is the live projection), a played one waiting
 *  for its acta («pendiente»: it was played) and a cancelled one. */
export function remainingFixtures(matches: readonly ClubMatch[], seasonId: string, now: number): SimFixture[] {
  const segs = seasonStrip(matches, seasonId, now).segments;
  const of = (states: readonly StripState[]) =>
    segs
      .filter((s) => states.includes(s.state))
      .map((s): SimFixture => ({ id: s.id, jornada: s.jornada, rival: s.rival, at: s.at, state: s.state as SimFixture["state"] }));
  return [...of(["hoy", "proximo"]), ...of(["aplazado"])];
}

/** The live score, as the table would take it if it ended now. */
export interface LiveScore {
  rival: string;
  gf: number;
  ga: number;
}

export interface SimRow extends StandingRow {
  /** 1-based, after the simulation. */
  pos: number;
  /** 1-based, in the table as it is. */
  was: number;
  /** Places up (+) or down (−). */
  move: number;
  /** A make-believe result (or the live score) changed this row. */
  touched: boolean;
}

export interface Simulation {
  rows: SimRow[];
  /** Our row (null when the table has none). */
  us: SimRow | null;
  points: number | null;
  position: number | null;
  /** The most points we can end with: the table, the live score, the picks, and every open jornada won. */
  comoMucho: number | null;
  /** The fewest: the table, the live score and the picks, losing every open jornada. */
  comoPoco: number | null;
  /** Fixtures with a pick of the viewer's; filled by the preset; with neither. */
  picked: number;
  filled: number;
  open: number;
  /** The result each fixture got (the viewer's pick, else the preset's). */
  results: Readonly<Record<string, PickLetter>>;
  /** Fixture ids (and "live" for the live score) whose rival is not in the table: only our row moved. */
  unmatched: string[];
  /** Every remaining jornada has a result and we are first: «Campeones, si acaba así». */
  champions: boolean;
}

/**
 * The preset's results for the fixtures without a pick (the picks win): «ritmo» repeats our record so far
 * (wins and draws per match, accumulated over the fixtures in order; with no match played, half won and a
 * fifth drawn), «victorias» every one G, «empates» every one E, «nada» none.
 */
export function presetResults(
  fixtures: readonly Pick<SimFixture, "id">[],
  preset: SimPreset,
  record: Pick<StandingRow, "pj" | "g" | "e"> | null,
  picks: Readonly<Record<string, PickLetter>> = {},
): Record<string, PickLetter> {
  const out: Record<string, PickLetter> = {};
  if (preset === "nada") return out;
  const pj = record?.pj ?? 0;
  const w = pj ? (record?.g ?? 0) / pj : 0.5;
  const d = pj ? (record?.e ?? 0) / pj : 0.2;
  let aw = 0;
  let ad = 0;
  for (const f of fixtures) {
    if (Object.hasOwn(picks, f.id)) continue;
    if (preset === "victorias") out[f.id] = "G";
    else if (preset === "empates") out[f.id] = "E";
    else {
      aw += w;
      ad += d;
      if (aw >= 1 - 1e-9) {
        out[f.id] = "G";
        aw -= 1;
      } else if (ad >= 1 - 1e-9) {
        out[f.id] = "E";
        ad -= 1;
      } else out[f.id] = "P";
    }
  }
  return out;
}

const POINTS: Record<PickLetter, number> = { G: 3, E: 1, P: 0 };
const GOALS: Record<PickLetter, [number, number]> = { G: [1, 0], E: [0, 0], P: [0, 1] };

/**
 * «¿Y si…?»: the table after the live score (`opts.live`, as if final) and a result for each of our
 * remaining `fixtures` — the viewer's `picks` (fixture id → G/E/P), else the `preset`'s. See the file's
 * header for what moves and how ties go. Picks for ids that are not in `fixtures` are ignored.
 */
export function simulateTable(
  rows: readonly StandingRow[],
  fixtures: readonly SimFixture[],
  picks: Readonly<Record<string, PickLetter>> = {},
  preset: SimPreset = "nada",
  opts: { live?: LiveScore | null; usTeam?: string | null } = {},
): Simulation {
  const work = rows.map((r, i) => ({ ...r, was: i + 1, touched: false }));
  const us = usIndex(rows, opts.usTeam);
  const usRow = us >= 0 ? work[us] : null;
  const unmatched: string[] = [];
  const rivalRow = (name: string) => work.find((r, i) => i !== us && norm(r.team) === norm(name)) ?? null;
  const play = (rival: string, gf: number, ga: number, id: string) => {
    const them = rivalRow(rival);
    if (!them) unmatched.push(id);
    for (const [r, f, a] of [[usRow, gf, ga], [them, ga, gf]] as const) {
      if (!r) continue;
      r.pj++;
      r.gf += f;
      r.gc += a;
      if (f > a) r.g++;
      else if (f < a) r.p++;
      else r.e++;
      r.pts += f > a ? 3 : f === a ? 1 : 0;
      r.touched = true;
    }
  };
  if (opts.live) play(opts.live.rival, opts.live.gf, opts.live.ga, "live");
  const base = usRow ? usRow.pts : null;

  const own: Record<string, PickLetter> = {};
  for (const f of fixtures) if (Object.hasOwn(picks, f.id)) own[f.id] = picks[f.id];
  const filled = presetResults(fixtures, preset, us >= 0 ? rows[us] : null, own);
  const results: Record<string, PickLetter> = { ...filled, ...own };
  let ownPoints = 0;
  for (const f of fixtures) {
    const r = results[f.id];
    if (!r) continue;
    if (Object.hasOwn(own, f.id)) ownPoints += POINTS[r];
    play(f.rival, GOALS[r][0], GOALS[r][1], f.id);
  }

  const sorted = [...work].sort((a, b) => b.pts - a.pts || b.gf - b.gc - (a.gf - a.gc) || b.gf - a.gf || a.was - b.was);
  const out: SimRow[] = sorted.map((r, i) => ({ ...r, pos: i + 1, move: r.was - (i + 1) }));
  const mine = out.find((r) => usRow && r.was === usRow.was) ?? null;
  const picked = Object.keys(own).length;
  const notPicked = fixtures.length - picked;
  return {
    rows: out,
    us: mine,
    points: mine ? mine.pts : null,
    position: mine ? mine.pos : null,
    comoMucho: base === null ? null : base + ownPoints + 3 * notPicked,
    comoPoco: base === null ? null : base + ownPoints,
    picked,
    filled: Object.keys(filled).length,
    open: fixtures.length - Object.keys(results).length,
    results,
    unmatched,
    champions: !!mine && mine.pos === 1 && fixtures.length > 0 && fixtures.every((f) => Object.hasOwn(results, f.id)),
  };
}

/** «Si acaba así»: the table with the live score as if it were final (or the table as it is, without one). */
export function projectTable(rows: readonly StandingRow[], live: LiveScore | null, usTeam?: string | null): Simulation {
  return simulateTable(rows, [], {}, "nada", { live, usTeam });
}
