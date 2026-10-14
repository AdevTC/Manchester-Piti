import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../functions/src/matchEngine";
import { LIVE_TYPES, liveProblem } from "../../functions/src/liveLogic";
import { LIVE_AT_BREAK } from "../../functions/src/liveRules";
import { liveLog, pickerView, type PadKind, type PickerContext, type PickerView, type PickState, type Step } from "../pages/admin/live/liveModel";
import { LIVE_ACTIONS, buildLiveEvent, liveAction, liveLine, liveReady, liveTypesOn, type LiveAction, type LiveActionType, type LiveChoices, type LiveEventInput, type LivePad } from "./liveActions";

const ctx: PickerContext = { minute: 31, rival: "MAD SKY", field: ["evans", "tello", "erik", "adrian"], bench: ["kevin", "almachi"], player: (id) => ({ num: "0", name: id.toUpperCase() }) };
const PADS: PadKind[] = ["gol", "tar", "cam", "oca", "cor", "mas"];

/** The events one admin pad can write: its picker walked to every end («Gol rival» writes at once). */
function padEvents(pad: LivePad): LiveEventInput[] {
  if (pad === "rival") return [buildLiveEvent("opponent_goal", {}, 31)];
  const out: LiveEventInput[] = [];
  const walk = (s: PickState) => {
    const v = pickerView(s, ctx);
    const steps: Step[] = [...v.options, ...(v.bench ?? []), ...v.extras].map((o) => o.next);
    for (const n of steps) if ("state" in n) walk(n.state);
    else out.push(n.event);
  };
  walk({ k: pad, st: 1 } as PickState);
  return out;
}
const wizardEvents = () => (["rival", ...PADS] as LivePad[]).flatMap(padEvents);

/** Where the wizard asks for an action's player (and, for an assist or who comes in, the second one). */
function playerStep(act: LiveAction): { first: PickerView; second: PickerView | null } {
  const v = (s: PickState) => pickerView(s, ctx);
  switch (act.pad) {
    case "gol": return { first: v({ k: "gol", st: 1 }), second: v({ k: "gol", st: 2, scorer: "erik" }) };
    case "tar": return { first: v({ k: "tar", st: 2, card: act.type as Extract<PickState, { k: "tar"; st: 2 }>["card"] }), second: null };
    case "mas": return { first: v({ k: "mas", st: 2, type: act.type as Extract<PickState, { k: "mas"; st: 2 }>["type"] }), second: null };
    case "cam": return { first: v({ k: "cam", st: 1 }), second: v({ k: "cam", st: 2, out: "tello" }) };
    case "oca": case "cor": return { first: v({ k: act.pad, st: 2 }), second: null };
    case "rival": throw new Error("«Gol rival» asks nothing");
  }
}

describe("the live-action catalogue", () => {
  it("only holds types the liveEvent callable accepts, each once", () => {
    const types = LIVE_ACTIONS.map((x) => x.type);
    expect(new Set(types).size).toBe(types.length);
    for (const t of types) expect(LIVE_TYPES).toContain(t);
  });
  it("atBreak is the callable's own rule (functions/src/liveRules.ts)", () => {
    expect(LIVE_ACTIONS.filter((x) => x.atBreak).map((x) => x.type).sort()).toEqual([...LIVE_AT_BREAK].sort());
  });
  it("parity: each admin pad writes exactly the catalogue's types behind it", () => {
    for (const pad of ["rival", ...PADS] as LivePad[]) expect([pad, [...new Set(padEvents(pad).map((e) => e.type))].sort()]).toEqual([pad, [...liveTypesOn(pad)].sort()]);
    expect(new Set(wizardEvents().map((e) => e.type)).size).toBe(LIVE_ACTIONS.length);
  });
  it("parity: the wizard asks the catalogue's questions, from the catalogue's pool, with its optional / later player", () => {
    for (const act of LIVE_ACTIONS.filter((x) => x.player !== "none")) {
      const { first, second } = playerStep(act);
      expect([act.type, first.question]).toEqual([act.type, act.ask]);
      expect([act.type, first.bench !== null]).toEqual([act.type, act.pool === "squad"]);
      expect([act.type, first.options.map((o) => o.id)]).toEqual([act.type, ctx.field]);
      expect([act.type, first.extras.some((x) => x.key === "team")]).toEqual([act.type, act.player === "optional"]);
      expect([act.type, first.extras.some((x) => x.key === "later")]).toEqual([act.type, act.player === "later"]);
      expect([act.type, second?.question ?? ""]).toEqual([act.type, act.askSecond]);
    }
  });
  it("every event either UI builds passes the callable's own checks", () => {
    const now = Date.UTC(2026, 9, 14, 10, 31);
    const match = { status: "scheduled", date: now - 31 * 60_000, duration: 50, starters: [...ctx.field], bench: [...ctx.bench] };
    for (const e of wizardEvents()) expect([e.type, liveProblem(match, e, now)]).toEqual([e.type, null]);
    // the Mesa de partido's own shortcuts: a goal «Lo completo luego», a chance or corner of the whole team
    for (const e of [buildLiveEvent("goal", {}, 31), buildLiveEvent("chance", { playerId: null }, 31), buildLiveEvent("corner", { playerId: null }, 31)]) expect(liveProblem(match, e, now)).toBeNull();
  });
});

describe("a write and its log line use the catalogue's words", () => {
  const nameOf = (id: string) => id.toUpperCase();
  const sample: Record<LiveActionType, Omit<MatchEvent, "id" | "type" | "minute">> = {
    goal: { playerId: "erik" }, opponent_goal: {}, opponent_own_goal: {}, yellow_card: { playerId: "tello" }, double_yellow: { playerId: "tello" }, red_card: { playerId: "evans" },
    substitution: { playerId: "tello", inPlayerId: "kevin" }, penalty_saved: { playerId: "evans" }, woodwork: { playerId: "erik" }, penalty_missed: { playerId: "adrian" },
    chance: { playerId: "erik" }, opponent_chance: {}, corner: {}, opponent_corner: {},
  };
  const expected: Record<LiveActionType, string> = {
    goal: "Gol de ERIK", opponent_goal: "Gol de MAD SKY", opponent_own_goal: "Autogol de MAD SKY", yellow_card: "Amarilla a TELLO", double_yellow: "Segunda amarilla a TELLO", red_card: "Roja directa a EVANS",
    substitution: "Cambio: entra KEVIN", penalty_saved: "Penalti parado por EVANS", woodwork: "Al palo: ERIK", penalty_missed: "Penalti fallado por ADRIAN",
    chance: "Ocasión de ERIK", opponent_chance: "Ocasión de MAD SKY", corner: "Córner del Piti", opponent_corner: "Córner de MAD SKY",
  };
  it.each(LIVE_ACTIONS.map((x) => [x.type, x] as const))("%s", (type, act) => {
    const [row] = liveLog([{ id: "e", type, minute: 3, ...sample[type] } as MatchEvent], "MAD SKY", nameOf);
    expect(row.text).toBe(expected[type]);
    // the log label is the catalogue's: its name, or (nobody named) its button label
    expect(row.text.startsWith(act.name) || row.text === act.label).toBe(true);
  });
  it("the wizard's captions say the same as the log", () => {
    const caption = (s: Step) => ("event" in s ? s.caption ?? s.flash : undefined);
    expect(caption(pickerView({ k: "mas", st: 2, type: "woodwork" }, ctx).options[2].next)).toBe(`${expected.woodwork} · 31′`);
    expect(caption(pickerView({ k: "tar", st: 2, card: "red_card" }, ctx).options[0].next)).toBe(`${expected.red_card} · 31′`);
    expect(caption(pickerView({ k: "cam", st: 2, out: "tello" }, ctx).options[0].next)).toBe(`${expected.substitution}, sale TELLO`);
    expect(caption(pickerView({ k: "gol", st: 1 }, ctx).extras[0].next)).toBe(`${expected.opponent_own_goal} · 31′`);
    expect(caption(pickerView({ k: "cor", st: 2 }, ctx).extras[0].next)).toBe(`${expected.corner} · 31′`);
    expect(liveLine("opponent_goal", "MAD SKY")).toBe(expected.opponent_goal); // useLive's «Gol rival» toast
  });
});

// The payloads both UIs sent before the catalogue, as pinned by the characterisation tests
// (src/pages/match/Banda.test.tsx and src/pages/admin/live/liveModel.test.ts).
describe("buildLiveEvent reproduces today's payloads", () => {
  const cases: [string, LiveActionType, LiveChoices, LiveEventInput][] = [
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
  it("only catalogue types compile", () => {
    // @ts-expect-error own_goal is accepted by the callable but is not a live action of either UI
    expect(() => buildLiveEvent("own_goal", {}, 5)).toThrow();
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
