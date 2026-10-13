import { describe, expect, it } from "vitest";
import { calculateLedger, type MatchEvent } from "../../functions/src/matchEngine";
import type { PosCode } from "../../functions/src/positions";
import { positionsPlayed, type PositionEvents } from "../../functions/src/positionsPlayed";

// a POR · b DFC · c DFC · d MI · e MC · f MD · g DC (the 2-3-1 board); h, i, k on the bench.
const STARTERS = ["a", "b", "c", "d", "e", "f", "g"];
const BOARD: Record<string, PosCode> = { a: "POR", b: "DFC", c: "DFC", d: "MI", e: "MC", f: "MD", g: "DC" };
const MAINS: Record<string, PosCode | null> = { a: "POR", b: "LI", c: "LD", d: "MD", e: "MCO", f: "MI", g: "EI", h: "ED", i: "MCD", k: "LIB" };

let seq = 0;
const ev = (type: MatchEvent["type"], minute: number, playerId?: string, extra: Partial<MatchEvent> = {}): MatchEvent => ({
  id: `e${++seq}`,
  type,
  minute,
  playerId,
  ...extra,
});
const sub = (minute: number, out: string, inn: string, extra: Partial<MatchEvent> = {}) => ev("substitution", minute, out, { inPlayerId: inn, ...extra });

function play(events: MatchEvent[], duration = 50) {
  const ledger = calculateLedger({ starters: STARTERS, bench: ["h", "i", "k"], notCalled: [], events, duration });
  expect(ledger.errors).toEqual([]);
  return ledger;
}

const none: PositionEvents = { goals: 0, assists: 0, yellowCards: 0, redCards: 0 };

describe("positionsPlayed (ha jugado de — minutos y acciones por posición desde el acta)", () => {
  it("a full match with a board: every starter plays his slot's code, nothing estimated, the bench gets no row", () => {
    const L = play([]);
    const rows = positionsPlayed(L.players, [], { board: BOARD, main: MAINS });
    expect(Object.keys(rows).sort()).toEqual(STARTERS);
    expect(rows.b).toEqual({ positionsPlayed: { DFC: 50 }, positionEvents: {}, positionsEstimated: false });
    expect(rows.g.positionsPlayed).toEqual({ DC: 50 });
    expect(rows.h).toBeUndefined();
  });

  it("no board, with mains: starters take their main, estimated; a substitute inherits code and «estimado»", () => {
    const events = [sub(20, "g", "h")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: null, main: MAINS });
    expect(rows.b).toEqual({ positionsPlayed: { LI: 50 }, positionEvents: {}, positionsEstimated: true });
    expect(rows.g.positionsPlayed).toEqual({ EI: 20 });
    expect(rows.h).toEqual({ positionsPlayed: { EI: 30 }, positionEvents: {}, positionsEstimated: true });
  });

  it("a starter missing from the board takes his main (estimated); the rest stay exact", () => {
    const board = { ...BOARD };
    delete board.g;
    const L = play([]);
    const rows = positionsPlayed(L.players, [], { board, main: MAINS });
    expect(rows.g).toEqual({ positionsPlayed: { EI: 50 }, positionEvents: {}, positionsEstimated: true });
    expect(rows.e.positionsEstimated).toBe(false);
  });

  it("a starter with no code: no row, and his substitute takes his own main, estimated", () => {
    const board = { ...BOARD };
    delete board.g;
    const main = { ...MAINS, g: null };
    const events = [sub(30, "g", "i")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board, main });
    expect(rows.g).toBeUndefined();
    expect(rows.i).toEqual({ positionsPlayed: { MCD: 20 }, positionEvents: {}, positionsEstimated: true });
  });

  it("sub chain A→B→C: each substitute inherits the code of who he replaced", () => {
    const events = [sub(10, "g", "h"), sub(30, "h", "i")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.g.positionsPlayed).toEqual({ DC: 10 });
    expect(rows.h).toEqual({ positionsPlayed: { DC: 20 }, positionEvents: {}, positionsEstimated: false });
    expect(rows.i).toEqual({ positionsPlayed: { DC: 20 }, positionEvents: {}, positionsEstimated: false });
  });

  it("rolling: A off at 20 for B, A back at 40 for C — A takes C's code for his second stint", () => {
    const events = [sub(20, "d", "h"), sub(40, "e", "d")];
    const L = play(events);
    expect(L.players.d.stints).toEqual([{ from: 0, to: 20 }, { from: 40, to: 50 }]);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.d.positionsPlayed).toEqual({ MI: 20, MC: 10 });
    expect(rows.h.positionsPlayed).toEqual({ MI: 30 });
    expect(rows.e.positionsPlayed).toEqual({ MC: 40 });
  });

  it("a red card at 30 with no refill: minutes up to 30 and the red at his position; nobody inherits the slot", () => {
    const events = [ev("red_card", 30, "b")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.b).toEqual({ positionsPlayed: { DFC: 30 }, positionEvents: { DFC: { ...none, redCards: 1 } }, positionsEstimated: false });
    expect(Object.keys(rows).sort()).toEqual(STARTERS);
  });

  it("a card shown on the bench is not attributed; his later minutes still count", () => {
    const events = [ev("yellow_card", 15, "h"), sub(30, "g", "h")];
    const L = play(events);
    expect(L.players.h.yellowCards).toBe(1);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.h).toEqual({ positionsPlayed: { DC: 20 }, positionEvents: {}, positionsEstimated: false });
  });

  it("goal and assist split across two positions (and the historic «assist» event counts)", () => {
    const events = [
      ev("goal", 10, "d", { assistPlayerId: "e" }),
      sub(20, "d", "h"),
      sub(40, "e", "d"),
      ev("goal_penalty", 45, "h", { assistPlayerId: "d" }),
      ev("assist", 47, "d"),
    ];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.d.positionEvents).toEqual({ MI: { ...none, goals: 1 }, MC: { ...none, assists: 2 } });
    expect(rows.e.positionEvents).toEqual({ MC: { ...none, assists: 1 } });
    expect(rows.h.positionEvents).toEqual({ MI: { ...none, goals: 1 } });
  });

  it("double_yellow: one more yellow and one red at his position; the first yellow counts too", () => {
    const events = [ev("yellow_card", 10, "c"), ev("double_yellow", 25, "c")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.c).toEqual({ positionsPlayed: { DFC: 25 }, positionEvents: { DFC: { goals: 0, assists: 0, yellowCards: 2, redCards: 1 } }, positionsEstimated: false });
  });

  it("an own goal is never a goal", () => {
    const events = [ev("own_goal", 12, "b"), ev("goal_freekick", 14, "f")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.b.positionEvents).toEqual({});
    expect(rows.f.positionEvents).toEqual({ MD: { ...none, goals: 1 } });
  });

  it("an event at the minute he leaves, or at the final whistle, counts at the stint that ends there", () => {
    const events = [ev("goal", 20, "g"), sub(20, "g", "h"), ev("goal", 50, "h", { assistPlayerId: "b" })];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.g.positionEvents).toEqual({ DC: { ...none, goals: 1 } });
    expect(rows.h.positionEvents).toEqual({ DC: { ...none, goals: 1 } });
    expect(rows.b.positionEvents).toEqual({ DFC: { ...none, assists: 1 } });
  });

  it("Σ minutes by position equals the ledger's minutes (seconds-precise subs), Σ goals and assists equal the ledger's", () => {
    const at = (s: number) => ({ elapsedSeconds: s });
    const events = [
      sub(12, "g", "h", at(737)),
      ev("goal", 13, "h", { ...at(801), assistPlayerId: "f" }),
      sub(23, "d", "i", at(1393)),
      sub(31, "h", "k", at(1861)),
      sub(37, "e", "d", at(2239)),
      ev("goal", 44, "d", { ...at(2650), assistPlayerId: "k" }),
      ev("red_card", 46, "c", at(2771)),
    ];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    for (const [pid, p] of Object.entries(L.players)) {
      if (!p.played) continue;
      const row = rows[pid];
      const minutes = Object.values(row.positionsPlayed).reduce((s, m) => s + (m ?? 0), 0);
      expect(Math.abs(minutes - p.minutes)).toBeLessThanOrEqual(0.02);
      const evs = Object.values(row.positionEvents);
      expect(evs.reduce((s, x) => s + (x?.goals ?? 0), 0)).toBe(p.goals);
      expect(evs.reduce((s, x) => s + (x?.assists ?? 0), 0)).toBe(p.assists);
      for (const m of Object.values(row.positionsPlayed)) expect(Math.round((m ?? 0) * 100) / 100).toBe(m);
    }
    // k entered for h, who had entered for g: punta all the way down the chain
    expect(Object.keys(rows.k.positionsPlayed)).toEqual(["DC"]);
    expect(rows.k.positionEvents).toEqual({ DC: { ...none, assists: 1 } });
  });

  it("a player without a main and no board gets no row", () => {
    const main = { ...MAINS, b: null };
    const L = play([]);
    const rows = positionsPlayed(L.players, [], { board: null, main });
    expect(rows.b).toBeUndefined();
    expect(rows.c.positionsPlayed).toEqual({ LD: 50 });
  });

  it("only codes with minutes > 0 are listed", () => {
    const events = [sub(0, "g", "h")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.h.positionsPlayed).toEqual({ DC: 50 });
    expect(rows.g?.positionsPlayed ?? {}).toEqual({});
  });
});
