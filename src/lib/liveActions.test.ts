import { describe, expect, it } from "vitest";
import { LIVE_TYPES, liveProblem } from "../../functions/src/liveLogic";
import { pickerView, type PadKind, type PickerContext, type PickState, type Step } from "../pages/admin/live/liveModel";
import { LIVE_ACTIONS, buildLiveEvent, liveAction, liveReady, type LiveChoices, type LiveEventInput, type LiveEventType } from "./liveActions";

const ctx: PickerContext = { minute: 31, rival: "MAD SKY", field: ["evans", "tello", "erik", "adrian"], bench: ["kevin", "almachi"], player: (id) => ({ num: "0", name: id.toUpperCase() }) };
const PADS: PadKind[] = ["gol", "tar", "cam", "oca", "cor", "mas"];

/** Every event the En juego wizard can write: each pad's picker walked to its end, plus the «Gol rival» pad. */
function wizardEvents(): LiveEventInput[] {
  const out: LiveEventInput[] = [{ type: "opponent_goal", minute: 31 }];
  const walk = (s: PickState) => {
    const v = pickerView(s, ctx);
    const steps: Step[] = [...v.options, ...(v.bench ?? []), ...v.extras].map((o) => o.next);
    for (const n of steps) if ("state" in n) walk(n.state);
    else out.push(n.event);
  };
  for (const k of PADS) walk({ k, st: 1 } as PickState);
  return out;
}

describe("the live-action catalogue", () => {
  it("only holds types the liveEvent callable accepts, each once", () => {
    const types = LIVE_ACTIONS.map((x) => x.type);
    expect(new Set(types).size).toBe(types.length);
    for (const t of types) expect(LIVE_TYPES).toContain(t);
  });
  it("parity: the En juego wizard writes exactly the catalogue's types (the Mesa de partido renders the same list)", () => {
    const written = new Set(wizardEvents().map((e) => e.type));
    expect([...written].sort()).toEqual(LIVE_ACTIONS.map((x) => x.type).sort());
  });
  it("every event either UI builds passes the callable's own checks", () => {
    const now = Date.UTC(2026, 9, 14, 10, 31);
    const match = { status: "scheduled", date: now - 31 * 60_000, duration: 50, starters: [...ctx.field], bench: [...ctx.bench] };
    for (const e of wizardEvents()) expect([e.type, liveProblem(match, e, now)]).toEqual([e.type, null]);
    // the Mesa de partido's own shortcuts: a goal «Lo completo luego», a chance or corner of the whole team
    for (const e of [buildLiveEvent("goal", {}, 31), buildLiveEvent("chance", { playerId: null }, 31), buildLiveEvent("corner", { playerId: null }, 31)]) expect(liveProblem(match, e, now)).toBeNull();
  });
});

// The payloads both UIs sent before the catalogue, as pinned by the characterisation tests
// (src/pages/match/Banda.test.tsx and src/pages/admin/live/liveModel.test.ts).
describe("buildLiveEvent reproduces today's payloads", () => {
  const cases: [string, LiveEventType, LiveChoices, LiveEventInput][] = [
    ["goal + assist", "goal", { playerId: "erik", assistPlayerId: "adrian" }, { type: "goal", minute: 31, playerId: "erik", assistPlayerId: "adrian" }],
    ["goal, no assist", "goal", { playerId: "erik", assistPlayerId: null }, { type: "goal", minute: 31, playerId: "erik" }],
    ["goal «Lo completo luego»", "goal", {}, { type: "goal", minute: 31 }],
    ["opponent goal", "opponent_goal", {}, { type: "opponent_goal", minute: 31 }],
    ["autogol del rival", "opponent_own_goal", {}, { type: "opponent_own_goal", minute: 31 }],
    ["yellow", "yellow_card", { playerId: "kevin" }, { type: "yellow_card", minute: 31, playerId: "kevin" }],
    ["second yellow", "double_yellow", { playerId: "tello" }, { type: "double_yellow", minute: 31, playerId: "tello" }],
    ["red", "red_card", { playerId: "evans" }, { type: "red_card", minute: 31, playerId: "evans" }],
    ["substitution", "substitution", { playerId: "tello", inPlayerId: "kevin" }, { type: "substitution", minute: 31, playerId: "tello", inPlayerId: "kevin" }],
    ["penalty saved", "penalty_saved", { playerId: "evans" }, { type: "penalty_saved", minute: 31, playerId: "evans" }],
    ["woodwork", "woodwork", { playerId: "erik" }, { type: "woodwork", minute: 31, playerId: "erik" }],
    ["penalty missed", "penalty_missed", { playerId: "adrian" }, { type: "penalty_missed", minute: 31, playerId: "adrian" }],
    ["chance of a player", "chance", { playerId: "erik" }, { type: "chance", minute: 31, playerId: "erik" }],
    ["chance of the team", "chance", { playerId: null }, { type: "chance", minute: 31 }],
    ["opponent chance", "opponent_chance", {}, { type: "opponent_chance", minute: 31 }],
    ["corner of a player", "corner", { playerId: "tello" }, { type: "corner", minute: 31, playerId: "tello" }],
    ["corner of the team", "corner", {}, { type: "corner", minute: 31 }],
    ["opponent corner", "opponent_corner", {}, { type: "opponent_corner", minute: 31 }],
  ];
  it.each(cases)("%s", (_, type, choices, expected) => {
    const built = buildLiveEvent(type, choices, 31);
    expect(built).toStrictEqual(expected);
    expect(JSON.stringify(built)).toBe(JSON.stringify(expected)); // same keys, same order: the same bytes
  });
  it("leaves out what the action does not take, and an assist without its scorer", () => {
    expect(buildLiveEvent("opponent_goal", { playerId: "erik", assistPlayerId: "adrian", inPlayerId: "kevin" }, 5)).toStrictEqual({ type: "opponent_goal", minute: 5 });
    expect(buildLiveEvent("goal", { playerId: null, assistPlayerId: "adrian" }, 5)).toStrictEqual({ type: "goal", minute: 5 });
    expect(buildLiveEvent("yellow_card", { playerId: "erik", inPlayerId: "kevin" }, 5)).toStrictEqual({ type: "yellow_card", minute: 5, playerId: "erik" });
    expect(buildLiveEvent(liveAction("substitution"), { playerId: "tello", assistPlayerId: "x", inPlayerId: "kevin" }, 5)).toStrictEqual({ type: "substitution", minute: 5, playerId: "tello", inPlayerId: "kevin" });
  });
});

describe("liveReady", () => {
  it("asks for what each action needs", () => {
    expect(liveReady(liveAction("goal"), {})).toBe(false);
    expect(liveReady(liveAction("goal"), { later: true })).toBe(true);
    expect(liveReady(liveAction("goal"), { playerId: "erik" })).toBe(true);
    expect(liveReady(liveAction("yellow_card"), {})).toBe(false);
    expect(liveReady(liveAction("substitution"), { playerId: "tello" })).toBe(false);
    expect(liveReady(liveAction("substitution"), { playerId: "tello", inPlayerId: "kevin" })).toBe(true);
    expect(liveReady(liveAction("chance"), {})).toBe(true);
    expect(liveReady(liveAction("opponent_own_goal"), {})).toBe(true);
  });
});
