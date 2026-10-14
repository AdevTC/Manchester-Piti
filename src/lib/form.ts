// The form rating and the per-match pieces it reads (a match's length, goals conceded on the pitch, the
// cards' weight). The pizarra's cromos (pages/pizarra/v2/ratings.ts, which re-exports these) and the
// position stats (positionStats.ts) share it; kept apart so the stats don't pull in the pizarra. Pure.
import type { ClubMatch, MatchEvent } from "./clubData";
import type { Line } from "./positions";

const DEFAULT_DURATION = 50;
/** The form's range: wide enough that differences show on the cromo. */
export const FORM_MIN = 45;
export const FORM_MAX = 95;

/**
 * One player's season, weighted: each team match counts 1, the last RECENT_GAMES count 2 (form is
 * what he has done lately). Sums over the team's matches, played or not (missing one lowers his share).
 */
export interface FormInput {
  /** His natural position (the role decides what counts: goals conceded for POR / DEF). */
  role?: Line;
  /** Σ weight of the team's matches, and Σ weight of those he played. */
  teamW: number;
  playedW: number;
  /** Σ weight · his share of the match's minutes (0–1 each). */
  shareW: number;
  /** Σ weight · minutes he played. */
  minW: number;
  /** Σ weight · goals + assists. */
  gaW: number;
  /** Σ weight · goals the team conceded while he was on the pitch. */
  concW: number;
  /** Σ weight · MVPs. */
  mvpW: number;
  /** Σ weight · cards (a yellow 1, a red or a second yellow 2). */
  cardsW: number;
  /** Σ weight · penalties saved. */
  savesW: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The form rating (FORM_MIN–FORM_MAX), or null before his first match. The formula:
 *
 *   presence = Σw·minutes share / Σw (team matches)                       — is he playing?
 *   attack   = min(1, G+A per 90 / 1.5), per 90 = Σw·(G+A)·90 / (Σw·min + 90)
 *              (90 pseudo-minutes with nothing: a goal in a cameo is not a hat-trick a match)
 *   defence  = 1 − conceded per 90 / 6, per 90 = (Σw·conceded + 3)·90 / (Σw·min + 90)
 *              (the prior: 3 per 90, a neutral 0.5; only for POR / DEF)
 *   role     = POR: defence + 0.15 per penalty saved a match (≤ 1) · DEF: 0.6·defence + 0.4·attack ·
 *              MED / DEL / unknown: attack
 *   mvp      = Σw·MVPs / Σw played · cards = min(1, Σw·cards / Σw played)
 *   rating   = 45 + 50 · clamp(0.35·presence + 0.45·role + 0.20·mvp − 0.15·cards, 0, 1)
 *
 * A regular who plays everything and contributes nothing sits in the low 60s; a scorer in form reaches
 * the high 80s and the MVPs take him to 95; a bench player with a cameo stays near 45.
 */
export function formRating(f: FormInput): number | null {
  if (f.playedW <= 0 || f.teamW <= 0) return null;
  const presence = clamp01(f.shareW / f.teamW);
  const per90 = (x: number) => (x * 90) / (f.minW + 90);
  const attack = clamp01(per90(f.gaW) / 1.5);
  const defence = clamp01(1 - per90(f.concW + 3) / 6);
  const role =
    f.role === "POR" ? clamp01(defence + (0.15 * f.savesW) / f.playedW) : f.role === "DEF" ? 0.6 * defence + 0.4 * attack : attack;
  const mvp = clamp01(f.mvpW / f.playedW);
  const cards = clamp01(f.cardsW / f.playedW);
  const raw = clamp01(0.35 * presence + 0.45 * role + 0.2 * mvp - 0.15 * cards);
  return Math.round(FORM_MIN + (FORM_MAX - FORM_MIN) * raw);
}

/** A match's length in minutes (DEFAULT_DURATION when the acta has none). */
export const durationOf = (m: ClubMatch): number => (typeof m.duration === "number" && m.duration > 0 ? m.duration : DEFAULT_DURATION);
const oppGoals = (m: ClubMatch): MatchEvent[] => (m.events ?? []).filter((e) => e.type === "opponent_goal");

/** When a player was on the pitch in a match: the ledger's stints (null = no stints recorded). */
export function stintsOf(m: ClubMatch, id: string): { from: number; to: number }[] | null {
  const st = m.ledger?.[id]?.stints;
  return st && st.length ? st : null;
}

const inStint = (minute: number, s: { from: number; to: number }, d: number) => minute >= s.from && (minute < s.to || (minute === s.to && s.to >= d));

/** Goals the team conceded while he was on the pitch (the stints; without them, his share of the match). */
export function concededOnPitch(m: ClubMatch, id: string, minutes: number): number {
  const d = durationOf(m);
  const st = stintsOf(m, id);
  const opp = oppGoals(m);
  if (st) return opp.filter((e) => typeof e.minute === "number" && st.some((s) => inStint(e.minute as number, s, d))).length;
  const total = opp.length || (typeof m.goalsAgainst === "number" ? m.goalsAgainst : 0);
  return total * Math.min(1, minutes / d);
}

/** A match's cards as the form reads them: a yellow 1, a sending-off (red or second yellow) 2. */
export function cardPoints(g: { yellowCards: number; redCards: number; doubleYellows: number }): number {
  // (a second yellow is stored as two yellows and a sending-off: it counts once, as the sending-off)
  return Math.max(0, g.yellowCards - 2 * g.doubleYellows) + 2 * Math.max(g.redCards, g.doubleYellows);
}
