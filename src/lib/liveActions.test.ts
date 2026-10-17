import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../functions/src/matchEngine";
import { LIVE_TYPES } from "../../functions/src/liveLogic";
import { LIVE_AT_BREAK } from "../../functions/src/liveRules";
import { liveLog } from "../pages/admin/live/liveModel";
import { LIVE_ACTIONS, liveLine, type LiveActionType } from "./liveActions";

describe("the live-action catalogue", () => {
  it("only holds types the liveEvent callable accepts, each once", () => {
    const types = LIVE_ACTIONS.map((x) => x.type);
    expect(new Set(types).size).toBe(types.length);
    for (const t of types) expect(LIVE_TYPES).toContain(t);
  });
  it("atBreak is the callable's own rule (functions/src/liveRules.ts)", () => {
    // This older catalogue holds part of la mesa's plays: its break flags must match the callable's rule for those.
    const types = new Set<string>(LIVE_ACTIONS.map((x) => x.type));
    expect(LIVE_ACTIONS.filter((x) => x.atBreak).map((x) => x.type).sort()).toEqual(LIVE_AT_BREAK.filter((t) => types.has(t)).sort());
  });
});

describe("the log line uses the catalogue's words", () => {
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
  it("a play nobody is named for says the button's words", () => {
    expect(liveLine("opponent_goal", "MAD SKY")).toBe(expected.opponent_goal);
    expect(liveLine("chance")).toBe("Ocasión del Piti");
  });
});
