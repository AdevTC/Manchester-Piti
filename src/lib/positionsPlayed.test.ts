import { describe, expect, it } from "vitest";
import { calculateLedger, type MatchEvent } from "../../functions/src/matchEngine";
import type { PosCode } from "../../functions/src/positions";
import { backfillPatch, backfillUpdates, keepStoredPositions, positionFields, withPositions, positionsPlayed, type PositionEvents } from "../../functions/src/positionsPlayed";

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

  it("a zero-minute estimated stint never marks the row «estimado»", () => {
    const board = { ...BOARD };
    delete board.g;
    const events = [sub(0, "g", "h")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board, main: MAINS });
    // g (off the board → his main, estimated) leaves at 0: no minutes, so not estimated
    expect(rows.g).toEqual({ positionsPlayed: {}, positionEvents: {}, positionsEstimated: false });
    // h inherits g's estimated EI and plays all 50
    expect(rows.h).toEqual({ positionsPlayed: { EI: 50 }, positionEvents: {}, positionsEstimated: true });
  });

  it("same minute: a card at t by the one coming on at t (listed after the sub) counts at his inherited position", () => {
    const events = [sub(20, "g", "h"), ev("yellow_card", 20, "h"), ev("yellow_card", 20, "g")];
    const L = play(events);
    const rows = positionsPlayed(L.players, events, { board: BOARD, main: MAINS });
    expect(rows.h.positionEvents).toEqual({ DC: { ...none, yellowCards: 1 } });
    // the one going off owns t only through the stint that ends there: his card at t is his DC too
    expect(rows.g.positionEvents).toEqual({ DC: { ...none, yellowCards: 1 } });
  });
});

describe("positionFields (what saveMatchSheet stores on each ledger row)", () => {
  it("omits empty maps and a false «estimado»", () => {
    expect(positionFields({ positionsPlayed: {}, positionEvents: {}, positionsEstimated: false })).toEqual({});
    expect(positionFields({ positionsPlayed: { DC: 20 }, positionEvents: {}, positionsEstimated: false })).toEqual({ positionsPlayed: { DC: 20 } });
    expect(positionFields({ positionsPlayed: { DC: 20 }, positionEvents: { DC: { ...none, goals: 1 } }, positionsEstimated: true })).toEqual({
      positionsPlayed: { DC: 20 },
      positionEvents: { DC: { ...none, goals: 1 } },
      positionsEstimated: true,
    });
  });
});

describe("backfillPatch (relleno de actas antiguas)", () => {
  // the stored board behind BOARD: 2-3-1, slots in order a…g
  const board = { formation: "2-3-1", freeMode: false, slots: STARTERS.map((playerId, i) => ({ playerId, x: 50, y: 10 + i * 10 })) };
  type Patch = NonNullable<ReturnType<typeof backfillPatch>>;
  type Doc = { ledger: Record<string, Record<string, unknown>>; events: MatchEvent[]; system?: string | null };
  const matchOf = (events: MatchEvent[]): Doc => ({ ledger: structuredClone(play(events).players) as unknown as Doc["ledger"], events });
  /** Applies a patch the way Firestore would (null deletes the field). */
  const apply = (m: Doc, patch: Patch): Doc => {
    const out = structuredClone(m);
    out.system = patch.system;
    for (const [pid, keys] of Object.entries(patch.ledger))
      for (const [field, v] of Object.entries(keys)) {
        if (v === null) delete out.ledger[pid][field];
        else out.ledger[pid][field] = v;
      }
    return out;
  };

  it("an old match with a board: exact minutes and actions per position, the system, nothing estimated", () => {
    const events = [sub(20, "g", "h"), ev("goal", 35, "h", { assistPlayerId: "b" })];
    const patch = backfillPatch(matchOf(events), board, MAINS);
    expect(patch).not.toBeNull();
    expect(patch!.system).toBe("2-3-1");
    expect(patch!.ledger.g?.positionsPlayed).toEqual({ DC: 20 });
    expect(patch!.ledger.h?.positionsPlayed).toEqual({ DC: 30 });
    expect(patch!.ledger.h?.positionEvents).toEqual({ DC: { ...none, goals: 1 } });
    expect(patch!.ledger.b?.positionEvents).toEqual({ DFC: { ...none, assists: 1 } });
    expect(Object.values(patch!.ledger).some((keys) => "positionsEstimated" in keys)).toBe(false);
    // the bench and empty maps are never written
    expect(patch!.ledger.i).toBeUndefined();
    expect(patch!.ledger.k).toBeUndefined();
    expect(patch!.ledger.g?.positionEvents).toBeUndefined();
  });

  it("is idempotent: once applied, nothing changes", () => {
    const events = [sub(20, "g", "h"), ev("goal", 35, "h", { assistPlayerId: "b" })];
    const m = matchOf(events);
    const once = apply(m, backfillPatch(m, board, MAINS)!);
    expect(backfillPatch(once, board, MAINS)).toBeNull();
    const estimated = apply(m, backfillPatch(m, null, MAINS)!);
    expect(backfillPatch(estimated, null, MAINS)).toBeNull();
  });

  it("without a board: mains, «estimado» and system null", () => {
    const patch = backfillPatch(matchOf([]), null, MAINS);
    expect(patch!.system).toBeNull();
    expect(patch!.ledger.b?.positionsPlayed).toEqual({ LI: 50 });
    expect(patch!.ledger.b?.positionsEstimated).toBe(true);
  });

  it("a free-mode board is «libre»", () => {
    expect(backfillPatch(matchOf([]), { ...board, freeMode: true }, MAINS)!.system).toBe("libre");
  });

  it("stale keys are removed (null) when the data no longer supports them", () => {
    const m = matchOf([]);
    const estimated = apply(m, backfillPatch(m, null, MAINS)!);
    // a board appeared since: exact codes replace the estimates and «estimado» goes
    const patch = backfillPatch(estimated, board, MAINS)!;
    expect(patch.ledger.b?.positionsPlayed).toEqual({ DFC: 50 });
    expect(patch.ledger.b?.positionsEstimated).toBeNull();
    expect(patch.system).toBe("2-3-1");
    // and with no data at all, every stored key goes
    const gone = backfillPatch(estimated, null, {})!;
    expect(gone.ledger.b?.positionsPlayed).toBeNull();
    expect(gone.ledger.b?.positionsEstimated).toBeNull();
  });

  it("nothing to say (no board, no mains, nothing stored): null; an absent system counts as null", () => {
    expect(backfillPatch(matchOf([]), null, {})).toBeNull();
    expect(backfillPatch({ ...matchOf([]), system: null }, null, {})).toBeNull();
  });

  it("a stored system without a board now goes back to null", () => {
    const patch = backfillPatch({ ...matchOf([]), system: "2-3-1" }, null, {});
    expect(patch).toEqual({ ledger: {}, system: null });
  });

  it("an old match with no ledger or events does not crash", () => {
    expect(backfillPatch({}, board, MAINS)).toEqual({ ledger: {}, system: "2-3-1" });
    expect(backfillPatch({ ledger: null, events: null }, null, MAINS)).toBeNull();
  });
});

describe("backfillUpdates (the patch as update pairs)", () => {
  const DEL = Symbol("delete");
  const make = { path: (...segments: string[]) => segments.join("|"), del: DEL };
  const fresh = () => calculateLedger({ starters: STARTERS, bench: ["h", "i", "k"], notCalled: [], events: [], duration: 50 }).players;

  it("one pair per changed key with a segment path; null deletes; system always goes (null stays null)", () => {
    const { pairs, invalid } = backfillUpdates(
      { ledger: { "p-1_a": { positionsPlayed: { DC: 20 }, positionsEstimated: null }, b: { positionEvents: null } }, system: null },
      make,
    );
    expect(pairs).toEqual([
      ["ledger|p-1_a|positionsPlayed", { DC: 20 }],
      ["ledger|p-1_a|positionsEstimated", DEL],
      ["ledger|b|positionEvents", DEL],
      ["system", null],
    ]);
    expect(invalid).toEqual([]);
  });

  it("a stale estimate turns into a delete once a board covers him", () => {
    const ledger: Record<string, Record<string, unknown>> = {};
    for (const [pid, p] of Object.entries(fresh()))
      ledger[pid] = p.started ? { ...p, positionsPlayed: { [MAINS[pid] ?? "MC"]: 50 }, positionsEstimated: true } : { ...p };
    const slots = STARTERS.map((playerId) => ({ playerId }));
    const patch = backfillPatch({ ledger, events: [] }, { formation: "2-3-1", freeMode: false, slots }, MAINS)!;
    const { pairs } = backfillUpdates(patch, make);
    expect(pairs).toContainEqual(["ledger|b|positionsEstimated", DEL]);
    expect(pairs).toContainEqual(["ledger|b|positionsPlayed", { DFC: 50 }]);
    expect(pairs).toContainEqual(["system", "2-3-1"]);
  });

  it("an unsafe player id is skipped and reported (never a path)", () => {
    const { pairs, invalid } = backfillUpdates(
      { ledger: { "a.b": { positionsPlayed: { DC: 1 } }, "": { positionEvents: null }, ok: { positionsEstimated: true } }, system: "libre" },
      make,
    );
    expect(invalid).toEqual(["a.b", ""]);
    expect(pairs).toEqual([
      ["ledger|ok|positionsEstimated", true],
      ["system", "libre"],
    ]);
  });

  it("backfillPatch leaves unsafe ids out, so they never keep a match «a escribir»", () => {
    const ledger = { "x/y": { ...fresh().b } };
    expect(backfillPatch({ ledger, events: [], system: null }, null, { "x/y": "LI" })).toBeNull();
  });
});

describe("withPositions / keepStoredPositions (saveMatchSheet's ledger)", () => {
  const fresh = () => calculateLedger({ starters: STARTERS, bench: ["h", "i", "k"], notCalled: [], events: [], duration: 50 }).players;

  it("withPositions replaces any position keys with the new rows, omitting empties", () => {
    const players = fresh();
    players.h.positionsEstimated = true;
    withPositions(players, { b: { positionsPlayed: { DFC: 50 }, positionEvents: {}, positionsEstimated: false } });
    expect(players.b.positionsPlayed).toEqual({ DFC: 50 });
    expect("positionEvents" in players.b).toBe(false);
    expect("positionsEstimated" in players.h).toBe(false);
  });

  it("keepStoredPositions copies each player's stored keys, and only those", () => {
    const players = fresh();
    players.c.positionsPlayed = { DFC: 1 }; // anything left over from a retried attempt goes
    keepStoredPositions(players, {
      b: { minutes: 99, positionsPlayed: { LI: 50 }, positionsEstimated: true },
      g: { positionsPlayed: { DC: 20 }, positionEvents: { DC: { ...none, goals: 1 } }, positionsEstimated: false },
      gone: { positionsPlayed: { MC: 3 } },
    });
    expect(players.b).toMatchObject({ minutes: 50, positionsPlayed: { LI: 50 }, positionsEstimated: true });
    expect(players.g.positionEvents).toEqual({ DC: { ...none, goals: 1 } });
    expect("positionsEstimated" in players.g).toBe(false);
    expect("positionsPlayed" in players.c).toBe(false);
    expect("gone" in players).toBe(false);
  });

  it("keepStoredPositions tolerates a missing or odd stored ledger", () => {
    for (const stored of [undefined, null, 5, "x", { b: 7 }]) {
      const players = fresh();
      keepStoredPositions(players, stored);
      expect(Object.values(players).some((p) => "positionsPlayed" in p)).toBe(false);
    }
  });
});
