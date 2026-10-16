import { clockReading } from "../../functions/src/matchClock";
// Pure logic for the match page (ficha): the crónica told in chapters from the acta, the pulse of the
// match minute by minute, who was on the pitch when, and the key numbers. Everything comes from the
// events and the ledger the acta already stores.
import { calculateLedger, dateMillis, type MatchEvent, type Participation } from "../../functions/src/matchEngine";
import type { ClubMatch } from "./clubData";
import { eventMinute } from "./partidos";
import { withGuestNames, type MatchGuest } from "./derived/guests";

const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIRS = new Set(["opponent_goal", "own_goal"]);
const byMinute = (a: MatchEvent, b: MatchEvent) => (a.minute ?? 0) - (b.minute ?? 0);

export interface Chapter {
  /** The moment's id: its event's id, or «final» for the final whistle (the reactions are keyed by it). */
  id: string;
  minute: number | null;
  title: string;
  text: string;
  side: "us" | "them" | "end";
  /** Who to show (our scorer, the keeper who saved…), when it's one of ours. */
  playerId?: string;
  /** Every one of ours the chapter names (scorer, assistant, who comes on…): their names become links. */
  people?: string[];
}

/** The match in chapters: every goal (with the score it leaves), saved/missed penalties, red cards, and the final whistle. */
/** A chapter's minute as people read it (lib/partidos eventMinute: live-stamped events in football's minute). */
const shownAt = (e: MatchEvent): number => eventMinute(e) ?? (e.minute as number);

/** `guests`: the match's invitados, named «Rafa (invitado)» (never a raw `guest:g1` nor «Jugador»). */
export function chapters(events: MatchEvent[] | undefined, memberName: (id: string) => string, rival: string, final?: { gf: number; ga: number }, guests?: MatchGuest[]): Chapter[] {
  const nameOf = guests ? withGuestNames({ guests }, memberName) : memberName;
  let gf = 0, ga = 0;
  const out: Chapter[] = [];
  for (const e of [...(events ?? [])].filter((x) => typeof x.minute === "number").sort(byMinute)) {
    const who = e.playerId ? nameOf(e.playerId) : "";
    const people = [...new Set([e.playerId, e.assistPlayerId, e.inPlayerId].filter((id): id is string => !!id))];
    if (OURS.has(e.type)) {
      const tiedBefore = gf === ga;
      gf++;
      const title = gf === 1 && ga === 0 ? "Primero, el Piti" : gf === ga ? "El empate" : gf > ga && tiedBefore ? "Por delante" : gf > ga ? "Más distancia" : "Recortamos";
      const how = e.type === "goal_penalty" ? " de penalti" : e.type === "goal_freekick" ? " de falta" : "";
      const scorer = e.type === "opponent_own_goal" ? `Autogol de ${rival}` : `${who} marca${how}`;
      const assist = e.assistPlayerId ? `, con asistencia de ${nameOf(e.assistPlayerId)}` : "";
      out.push({ id: e.id, minute: shownAt(e), title, text: `${scorer}${assist}. ${gf}–${ga}.`, side: "us", playerId: e.type === "opponent_own_goal" ? undefined : e.playerId, people });
    } else if (THEIRS.has(e.type)) {
      const tiedBefore = gf === ga;
      ga++;
      const title = ga === 1 && gf === 0 ? `Golpe de ${rival}` : ga === gf ? `Empata ${rival}` : ga > gf && tiedBefore ? `${rival} se adelanta` : ga > gf ? `${rival} amplía` : `${rival} recorta`;
      const text = e.type === "own_goal" ? `Gol en propia puerta de ${who}. ${gf}–${ga}.` : `Marca ${rival}. ${gf}–${ga}.`;
      out.push({ id: e.id, minute: shownAt(e), title, text, side: "them", people });
    } else if (e.type === "penalty_saved") {
      out.push({ id: e.id, minute: shownAt(e), title: `${who} para un penalti`, text: `Penalti para ${rival} y ${who} lo detiene. Sigue el ${gf}–${ga}.`, side: "us", playerId: e.playerId, people });
    } else if (e.type === "penalty_missed") {
      out.push({ id: e.id, minute: shownAt(e), title: "Penalti fallado", text: `${who} no acierta desde los once metros. Sigue el ${gf}–${ga}.`, side: "us", playerId: e.playerId, people });
    } else if (e.type === "red_card" || e.type === "double_yellow") {
      out.push({ id: e.id, minute: shownAt(e), title: `Roja para ${who}`, text: e.type === "double_yellow" ? "Expulsión por segunda amarilla." : "Expulsión por roja directa.", side: "them", playerId: e.playerId, people });
    } else if (["chance", "opponent_chance", "corner", "opponent_corner"].includes(e.type)) {
      const theirs = e.type.startsWith("opponent_");
      const corner = e.type.endsWith("corner");
      out.push({ id: e.id, minute: shownAt(e), title: `${corner ? "Córner" : "Ocasión"} ${theirs ? `para ${rival}` : who ? `de ${who}` : "del Piti"}`, text: e.note || `${corner ? "Saque de esquina" : "Ocasión sin gol"}. Sigue el ${gf}–${ga}.`, side: theirs ? "them" : "us", playerId: theirs ? undefined : e.playerId, people });
    } else if (e.type === "substitution") {
      out.push({ id: e.id, minute: shownAt(e), title: `Entra ${e.inPlayerId ? nameOf(e.inPlayerId) : "un suplente"}`, text: `Sale ${who}.`, side: "us", playerId: e.inPlayerId, people });
    }
  }
  if (final) {
    const verdict = final.gf > final.ga ? `Victoria ante ${rival}` : final.gf === final.ga ? `Empate ante ${rival}` : `Derrota ante ${rival}`;
    out.push({ id: "final", minute: null, title: `Final: ${final.gf}–${final.ga}`, text: `${verdict}.`, side: "end" });
  }
  return out;
}

const WEIGHTS: Record<string, ["us" | "them", number]> = {
  goal: ["us", 3], goal_penalty: ["us", 3], goal_freekick: ["us", 3], opponent_own_goal: ["us", 2],
  penalty_received: ["us", 2], woodwork: ["us", 2], penalty_missed: ["us", 1], penalty_saved: ["them", 2],
  opponent_goal: ["them", 3], own_goal: ["them", 3], penalty_committed: ["them", 2],
  yellow_card: ["them", 1], double_yellow: ["them", 2], red_card: ["them", 2],
  chance: ["us", 2], opponent_chance: ["them", 2], corner: ["us", 1], opponent_corner: ["them", 1],
};

/**
 * Who was pushing, minute by minute (0–100 each side), from what the acta records: goals, woodwork,
 * penalties, saves and cards weigh on the minutes around them. `upTo` stops at the live minute.
 */
export function pulse(events: MatchEvent[] | undefined, duration: number, upTo = duration) {
  const raw = Array.from({ length: duration }, () => ({ us: 0.35, them: 0.35 }));
  for (const e of events ?? []) {
    const w = WEIGHTS[e.type];
    if (!w || typeof e.minute !== "number") continue;
    for (let m = 0; m < duration; m++) {
      const v = w[1] * Math.max(0, 1 - Math.abs(m + 1 - e.minute) / 6);
      raw[m][w[0]] += v;
    }
  }
  const max = Math.max(1, ...raw.map((r) => Math.max(r.us, r.them)));
  return raw.map((r, i) => ({ minute: i + 1, us: Math.round((r.us / max) * 100), them: Math.round((r.them / max) * 100), played: i + 1 <= upTo }));
}

export interface StintRow {
  id: string;
  /** Spans in % of the match. */
  spans: { left: number; width: number }[];
  minutes: number;
  /** Goal minutes in % of the match. */
  goals: number[];
}
/** On the pitch and when: one row per player who played, from the ledger's stints. */
export function stintRows(ledger: Record<string, Participation> | undefined, events: MatchEvent[] | undefined, duration: number): StintRow[] {
  const pct = (m: number) => Math.max(0, Math.min(100, (m / duration) * 100));
  return Object.entries(ledger ?? {})
    .filter(([, p]) => p.played)
    .map(([id, p]) => ({
      id,
      spans: p.stints.map((s) => ({ left: pct(s.from), width: pct(s.to - s.from) })),
      minutes: p.minutes,
      goals: (events ?? []).filter((e) => e.playerId === id && /^goal/.test(e.type) && typeof e.minute === "number").map((e) => pct(e.minute!)),
    }))
    .sort((a, b) => b.minutes - a.minutes || (a.spans[0]?.left ?? 0) - (b.spans[0]?.left ?? 0));
}

/** Orientative F7 positions (1-3-2-1) for the starters in their listed order; % of the pitch, attacking up.
 *  The Campo's fallback when nobody has a position (live, old actas, fans before the acta): see
 *  pages/match/campoPositions. */
export const F7_SPOTS: [number, number][] = [
  [50, 89], [20, 68], [50, 72], [80, 68], [32, 43], [68, 43], [50, 17],
];

export interface PlayerLine {
  minutes: number;
  goals: number;
  assists: number;
  cards: number;
  yellowCards: number;
  redCards: number;
}
/** A player's line in this match: the ledger once published, otherwise counted from the events. */
export function playerLine(id: string, ledger: Record<string, Participation> | undefined, events: MatchEvent[] | undefined): PlayerLine {
  const p = ledger?.[id];
  if (p) return { minutes: p.minutes, goals: p.goals, assists: p.assists, cards: p.yellowCards + p.redCards, yellowCards: p.yellowCards, redCards: p.redCards };
  const ev = events ?? [];
  const yellowCards = ev.filter((e) => e.playerId === id && ["yellow_card", "double_yellow"].includes(e.type)).length;
  const redCards = ev.filter((e) => e.playerId === id && ["red_card", "double_yellow"].includes(e.type)).length;
  return {
    minutes: 0,
    goals: ev.filter((e) => e.playerId === id && /^goal/.test(e.type)).length,
    assists: ev.filter((e) => /^goal/.test(e.type) && e.assistPlayerId === id || e.type === "assist" && e.playerId === id).length,
    cards: yellowCards + redCards,
    yellowCards,
    redCards,
  };
}

/** The numbers under the score: saves, woodwork and cards of the Piti in this match. */
export function keyNumbers(events: MatchEvent[] | undefined) {
  const ev = events ?? [];
  const n = (types: string[]) => ev.filter((e) => types.includes(e.type)).length;
  return { saves: n(["penalty_saved"]), woodwork: n(["woodwork"]), cards: n(["yellow_card", "red_card"]) + 2 * n(["double_yellow"]), chances: n(["chance"]), opponentChances: n(["opponent_chance"]), corners: n(["corner"]), opponentCorners: n(["opponent_corner"]) };
}

/** Who is on the pitch now: the starters, after the substitutions and red cards in the acta. */
export function onPitch(starters: string[] | undefined, events: MatchEvent[] | undefined) {
  const bench = [...new Set((events ?? []).flatMap((e) => [e.playerId, e.inPlayerId]).filter((id): id is string => !!id && !(starters ?? []).includes(id)))];
  return calculateLedger({ starters: starters ?? [], bench, notCalled: [], events: events ?? [], duration: 150 }, false, { allowUnattributedGoals: true }).field.filter((id): id is string => id !== null);
}

/** Live minutes use the same stints and dismissals as the server's final ledger. */
export function matchSnapshot(match: Pick<ClubMatch, "starters" | "bench" | "notCalled" | "events" | "duration" | "date" | "liveEndedAt" | "clock" | "durationSeconds">, now: number) {
  const lastMinute = Math.max(0, ...(match.events ?? []).map((e) => e.minute ?? 0));
  const duration = Math.max(match.duration ?? 50, lastMinute);
  const start = dateMillis(match.date);
  const elapsed = match.clock ? clockReading(match.clock, now).elapsedSeconds / 60 : Number.isFinite(start) ? Math.max(0, Math.floor(((match.liveEndedAt ?? now) - start) / 60_000)) : 0;
  return calculateLedger({ starters: match.starters ?? [], bench: match.bench ?? [], notCalled: match.notCalled ?? [], events: match.events ?? [], duration: Math.max(duration, Math.ceil(elapsed)) }, false, { until: match.clock ? elapsed : Math.min(duration, Math.max(elapsed, lastMinute)), allowUnattributedGoals: true });
}
