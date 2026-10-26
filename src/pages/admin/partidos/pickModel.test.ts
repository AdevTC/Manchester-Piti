import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { checkEvent, fieldAt, groupOfEvent, KINDS, kindLabel, playerQuestion } from "./pickModel";

const seven = ["a", "b", "c", "d", "e", "f", "g"];
const sheet = (events: MatchEvent[]) => ({ starters: seven, bench: ["h", "i"], notCalled: [], events, duration: 50 });

describe("acta · «Cambio de sitio» in «Lo demás»", () => {
  it("is a kind of «Cambios», next to the change", () => {
    expect(KINDS.cam.map((k) => k.type)).toEqual(["substitution", "position_swap"]);
    expect(groupOfEvent({ type: "position_swap" })).toBe("cam");
    expect(kindLabel("position_swap")).toBe("Cambio de sitio");
    expect(playerQuestion("position_swap")).toBe("Cambio de sitio: ¿quiénes se cambian?");
  });
  it("its two players come from who is on the pitch at that minute (the changes and reds before it)", () => {
    const events: MatchEvent[] = [
      { id: "s1", type: "substitution", minute: 10, playerId: "a", inPlayerId: "h" },
      { id: "r1", type: "red_card", minute: 20, playerId: "b" },
      { id: "w1", type: "position_swap", minute: 25, playerId: "c", inPlayerId: "d" },
    ];
    expect(fieldAt(sheet(events), 5)).toEqual(seven);
    expect(fieldAt(sheet(events), 10)).toEqual(["h", "b", "c", "d", "e", "f", "g"]);
    expect(fieldAt(sheet(events), 30)).toEqual(["h", "c", "d", "e", "f", "g"]);
    // (the play being edited doesn't count: moving the change later puts «a» back on the pitch)
    expect(fieldAt(sheet(events), 15, "s1")).toContain("a");
  });
  it("checks two different players, both on the pitch at the minute", () => {
    const field = fieldAt(sheet([{ id: "s1", type: "substitution", minute: 10, playerId: "a", inPlayerId: "h" }]), 12);
    const check = (player: string, inPlayer: string, minute = "12") => checkEvent({ type: "position_swap", minute, player, inPlayer, duration: 50, field });
    expect(check("", "")).toBe("Elige los dos que se cambian el sitio.");
    expect(check("c", "")).toBe("Elige los dos que se cambian el sitio.");
    expect(check("c", "c")).toBe("Elige los dos que se cambian el sitio.");
    expect(check("a", "c")).toBe("En el minuto 12 los dos tienen que estar en el campo.");
    expect(check("h", "i")).toBe("En el minuto 12 los dos tienen que estar en el campo.");
    expect(check("h", "c")).toBe("");
    expect(check("h", "c", "")).toBe("Pon el minuto (de 0 a 50).");
  });
  it("the change's own checks stay as they were", () => {
    expect(checkEvent({ type: "substitution", minute: "10", player: "a", inPlayer: "", duration: 50 })).toBe("Elige quién entra (otro jugador).");
    expect(checkEvent({ type: "substitution", minute: "10", player: "a", inPlayer: "h", duration: 50 })).toBe("");
  });
});
