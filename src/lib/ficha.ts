// Pure logic for the match page (ficha): the crónica told in chapters from the acta, the pulse of the
// match minute by minute, who was on the pitch when, and the key numbers. Everything comes from the
// events and the ledger the acta already stores.
import type { MatchEvent, Participation } from "../../functions/src/matchEngine";

const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIRS = new Set(["opponent_goal", "own_goal"]);
const byMinute = (a: MatchEvent, b: MatchEvent) => (a.minute ?? 0) - (b.minute ?? 0);

export interface Chapter {
  minute: number | null;
  title: string;
  text: string;
  side: "us" | "them" | "end";
  /** Who to show (our scorer, the keeper who saved…), when it's one of ours. */
  playerId?: string;
}

/** The match in chapters: every goal (with the score it leaves), saved/missed penalties, red cards, and the final whistle. */
export function chapters(events: MatchEvent[] | undefined, nameOf: (id: string) => string, rival: string, final?: { gf: number; ga: number }): Chapter[] {
  let gf = 0, ga = 0;
  const out: Chapter[] = [];
  for (const e of [...(events ?? [])].filter((x) => typeof x.minute === "number").sort(byMinute)) {
    const who = e.playerId ? nameOf(e.playerId) : "";
    if (OURS.has(e.type)) {
      const tiedBefore = gf === ga;
      gf++;
      const title = gf === 1 && ga === 0 ? "Primero, el Piti" : gf === ga ? "El empate" : gf > ga && tiedBefore ? "Por delante" : gf > ga ? "Más distancia" : "Recortamos";
      const how = e.type === "goal_penalty" ? " de penalti" : e.type === "goal_freekick" ? " de falta" : "";
      const scorer = e.type === "opponent_own_goal" ? `Autogol de ${rival}` : `${who} marca${how}`;
      const assist = e.assistPlayerId ? `, con asistencia de ${nameOf(e.assistPlayerId)}` : "";
      out.push({ minute: e.minute!, title, text: `${scorer}${assist}. ${gf}–${ga}.`, side: "us", playerId: e.type === "opponent_own_goal" ? undefined : e.playerId });
    } else if (THEIRS.has(e.type)) {
      const tiedBefore = gf === ga;
      ga++;
      const title = ga === 1 && gf === 0 ? `Golpe de ${rival}` : ga === gf ? `Empata ${rival}` : ga > gf && tiedBefore ? `${rival} se adelanta` : ga > gf ? `${rival} amplía` : `${rival} recorta`;
      const text = e.type === "own_goal" ? `Gol en propia puerta de ${who}. ${gf}–${ga}.` : `Marca ${rival}. ${gf}–${ga}.`;
      out.push({ minute: e.minute!, title, text, side: "them" });
    } else if (e.type === "penalty_saved") {
      out.push({ minute: e.minute!, title: `${who} para un penalti`, text: `Penalti para ${rival} y ${who} lo detiene. Sigue el ${gf}–${ga}.`, side: "us", playerId: e.playerId });
    } else if (e.type === "penalty_missed") {
      out.push({ minute: e.minute!, title: "Penalti fallado", text: `${who} no acierta desde los once metros. Sigue el ${gf}–${ga}.`, side: "us", playerId: e.playerId });
    } else if (e.type === "red_card" || e.type === "double_yellow") {
      out.push({ minute: e.minute!, title: `Roja para ${who}`, text: e.type === "double_yellow" ? "Segunda amarilla: el Piti juega con uno menos." : "Roja directa: el Piti juega con uno menos.", side: "them", playerId: e.playerId });
    }
  }
  if (final) {
    const verdict = final.gf > final.ga ? `Victoria ante ${rival}` : final.gf === final.ga ? `Empate ante ${rival}` : `Derrota ante ${rival}`;
    out.push({ minute: null, title: `Final: ${final.gf}–${final.ga}`, text: `${verdict}.`, side: "end" });
  }
  return out;
}

const WEIGHTS: Record<string, ["us" | "them", number]> = {
  goal: ["us", 3], goal_penalty: ["us", 3], goal_freekick: ["us", 3], opponent_own_goal: ["us", 2],
  penalty_received: ["us", 2], woodwork: ["us", 2], penalty_missed: ["us", 1], penalty_saved: ["them", 2],
  opponent_goal: ["them", 3], own_goal: ["them", 3], penalty_committed: ["them", 2],
  yellow_card: ["them", 1], double_yellow: ["them", 2], red_card: ["them", 2],
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

/** Orientative F7 positions (1-3-2-1) for the starters in their listed order; % of the pitch, attacking up. */
export const F7_SPOTS: [number, number][] = [
  [50, 89], [20, 68], [50, 72], [80, 68], [32, 43], [68, 43], [50, 17],
];

export interface PlayerLine {
  minutes: number;
  goals: number;
  assists: number;
  cards: number;
}
/** A player's line in this match: the ledger once published, otherwise counted from the events. */
export function playerLine(id: string, ledger: Record<string, Participation> | undefined, events: MatchEvent[] | undefined): PlayerLine {
  const p = ledger?.[id];
  if (p) return { minutes: p.minutes, goals: p.goals, assists: p.assists, cards: p.yellowCards + p.redCards };
  const ev = events ?? [];
  return {
    minutes: 0,
    goals: ev.filter((e) => e.playerId === id && /^goal/.test(e.type)).length,
    assists: ev.filter((e) => e.assistPlayerId === id).length,
    cards: ev.filter((e) => e.playerId === id && ["yellow_card", "double_yellow", "red_card"].includes(e.type)).length,
  };
}

/** The numbers under the score: saves, woodwork and cards of the Piti in this match. */
export function keyNumbers(events: MatchEvent[] | undefined) {
  const ev = events ?? [];
  const n = (types: string[]) => ev.filter((e) => types.includes(e.type)).length;
  return { saves: n(["penalty_saved"]), woodwork: n(["woodwork"]), cards: n(["yellow_card", "double_yellow", "red_card"]) };
}
