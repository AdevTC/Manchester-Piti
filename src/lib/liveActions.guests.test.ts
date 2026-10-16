import { describe, expect, it } from "vitest";
import { buildLiveEvent, guestsLast, liveLine, withGuestNames } from "./liveActions";

// Invitados en el acta: the live pickers' order, the names and what a guest's play sends to liveEvent.
const MATCH = { guests: [{ id: "g1", name: "Rafa" }] };

describe("liveActions · invitados", () => {
  it("lists the members first, then the guests, each group in its order", () => {
    expect(guestsLast(["guest:g1", "evans", "guest:g2", "erik"])).toEqual(["evans", "erik", "guest:g1", "guest:g2"]);
  });

  it("names a guest «Rafa (invitado)» and leaves the members to their own name", () => {
    const nameOf = withGuestNames(MATCH, (id) => id.toUpperCase());
    expect(nameOf("guest:g1")).toBe("Rafa (invitado)");
    expect(nameOf("erik")).toBe("ERIK");
    expect(liveLine("goal", nameOf("guest:g1"))).toBe("Gol de Rafa (invitado)");
  });

  it("a guest scorer, a guest assist and a guest coming in travel as guest: references", () => {
    expect(buildLiveEvent("goal", { playerId: "guest:g1", assistPlayerId: "erik" }, 31)).toStrictEqual({ type: "goal", minute: 31, playerId: "guest:g1", assistPlayerId: "erik" });
    expect(buildLiveEvent("goal", { playerId: "erik", assistPlayerId: "guest:g1" }, 12)).toStrictEqual({ type: "goal", minute: 12, playerId: "erik", assistPlayerId: "guest:g1" });
    expect(buildLiveEvent("substitution", { playerId: "tello", inPlayerId: "guest:g1" }, 20)).toStrictEqual({ type: "substitution", minute: 20, playerId: "tello", inPlayerId: "guest:g1" });
  });
});
