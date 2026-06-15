// EL REGISTRO — match data model + pure event-grouping logic.
// Shared by the featured hero, the ledger rows, the inline ink-line and the
// goal sheet so the event grammar lives in exactly one place.

export type FireDate = { seconds?: number } | string | number | Date | null | undefined;

export interface RawEvent {
  type: string;
  playerId: string;
  assistPlayerId?: string;
}

export interface MatchDoc {
  id: string;
  rival?: string;
  competition?: string;
  date?: FireDate;
  goalsFor?: number;
  goalsAgainst?: number;
  events?: RawEvent[];
  seasonId?: string;
}

const GOAL_TYPES = new Set(["goal", "goal_penalty", "goal_freekick"]);

export type GoalKind = "open" | "penalty" | "freekick";
export interface GoalLine { scorer: string; kind: GoalKind; assist?: string }
export interface ScorerToken {
  name: string;
  count: number;
  penalty: boolean;
  freekick: boolean;
  assists: string[];
}

export interface EventGroups {
  goalLines: GoalLine[]; // per-goal, for the expanded goal sheet
  ownGoals: string[];
  scorerTokens: ScorerToken[]; // aggregated per scorer, for the inline ink-line
  yellow: string[];
  double: string[];
  red: string[];
  woodwork: string[];
  penaltySaved: string[];
  penaltyMissed: string[];
  standaloneAssists: string[];
  lineup: string[];
  goalsLogged: number; // goalLines.length (does not include own goals)
  hasAny: boolean; // any non-"match_played" event exists
}

/** Group a match's raw events into meaning-categories (never time-ordered:
 *  there are no minutes, and order is admin-insertion). */
export function groupEvents(events: RawEvent[] | undefined, names: Record<string, string>): EventGroups {
  const nm = (id?: string): string => (id ? names[id] || "Desconocido" : "");
  const evs = events ?? [];

  const goalLines: GoalLine[] = [];
  const ownGoals: string[] = [];
  const scorerMap = new Map<string, ScorerToken>();
  const yellow: string[] = [];
  const double: string[] = [];
  const red: string[] = [];
  const woodwork: string[] = [];
  const penaltySaved: string[] = [];
  const penaltyMissed: string[] = [];
  const standaloneAssists: string[] = [];
  const lineupSet = new Set<string>();

  for (const e of evs) {
    if (e.playerId) lineupSet.add(e.playerId);
    if (e.assistPlayerId) lineupSet.add(e.assistPlayerId);

    if (GOAL_TYPES.has(e.type)) {
      const kind: GoalKind = e.type === "goal_penalty" ? "penalty" : e.type === "goal_freekick" ? "freekick" : "open";
      const scorer = nm(e.playerId);
      const assist = e.assistPlayerId ? nm(e.assistPlayerId) : undefined;
      goalLines.push({ scorer, kind, assist });
      const tok = scorerMap.get(e.playerId) ?? { name: scorer, count: 0, penalty: false, freekick: false, assists: [] };
      tok.count += 1;
      if (kind === "penalty") tok.penalty = true;
      if (kind === "freekick") tok.freekick = true;
      if (assist && !tok.assists.includes(assist)) tok.assists.push(assist);
      scorerMap.set(e.playerId, tok);
    } else if (e.type === "own_goal") ownGoals.push(nm(e.playerId));
    else if (e.type === "yellow_card") yellow.push(nm(e.playerId));
    else if (e.type === "double_yellow") double.push(nm(e.playerId));
    else if (e.type === "red_card") red.push(nm(e.playerId));
    else if (e.type === "woodwork") woodwork.push(nm(e.playerId));
    else if (e.type === "penalty_saved") penaltySaved.push(nm(e.playerId));
    else if (e.type === "penalty_missed") penaltyMissed.push(nm(e.playerId));
    else if (e.type === "assist") standaloneAssists.push(nm(e.playerId));
    // "match_played" contributes to the lineup only.
  }

  const lineup = Array.from(lineupSet).map(nm).filter(Boolean);
  const hasAny =
    goalLines.length > 0 ||
    ownGoals.length > 0 ||
    yellow.length > 0 ||
    double.length > 0 ||
    red.length > 0 ||
    woodwork.length > 0 ||
    penaltySaved.length > 0 ||
    penaltyMissed.length > 0 ||
    standaloneAssists.length > 0;

  return {
    goalLines,
    ownGoals,
    scorerTokens: Array.from(scorerMap.values()),
    yellow,
    double,
    red,
    woodwork,
    penaltySaved,
    penaltyMissed,
    standaloneAssists,
    lineup,
    goalsLogged: goalLines.length,
    hasAny,
  };
}

export type Outcome = "win" | "draw" | "loss";

export function outcomeOf(gf: number, gc: number): Outcome {
  return gf > gc ? "win" : gf === gc ? "draw" : "loss";
}

export const OUTCOME: Record<Outcome, { word: string; letter: string }> = {
  win: { word: "Victoria", letter: "V" },
  draw: { word: "Empate", letter: "E" },
  loss: { word: "Derrota", letter: "D" },
};

export function toDate(d: FireDate): Date {
  if (d instanceof Date) return d;
  if (d && typeof d === "object" && typeof d.seconds === "number") return new Date(d.seconds * 1000);
  if (typeof d === "string" || typeof d === "number") return new Date(d);
  return new Date(NaN);
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Long capitalized date for the hero, e.g. "Domingo, 10 de mayo de 2026". */
export function formatLongDate(d: FireDate): string {
  const dt = toDate(d);
  if (Number.isNaN(dt.getTime())) return "";
  const s = dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Compact date parts for a register row gutter, e.g. { day: "10", month: "MAY", year: "26" }. */
export function compactDate(d: FireDate): { day: string; month: string; year: string } {
  const dt = toDate(d);
  if (Number.isNaN(dt.getTime())) return { day: "--", month: "", year: "" };
  return {
    day: String(dt.getDate()).padStart(2, "0"),
    month: (MONTHS[dt.getMonth()] ?? "").toUpperCase(),
    year: String(dt.getFullYear()).slice(2),
  };
}
