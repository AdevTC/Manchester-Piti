import { describe, expect, it, vi } from "vitest";
import { matchName, pizarraCommand, webCommand } from "./matchShortcuts";

// The palette's ways out for a match: its name as the pizarra says it («J8 · MAD SKY»), «Ver en la web»
// only once it is in the calendar, and «Abrir la pizarra» onto its official board, in its season.

const m8 = { id: "m8", jornada: 8, rival: "MAD SKY", published: true, seasonId: "t1" };

describe("matchShortcuts", () => {
  it("matchName: the shared jornada label and the rival; the rival alone without a jornada", () => {
    expect(matchName(m8)).toBe("J8 · MAD SKY");
    expect(matchName({ jornada: null, rival: "MAD SKY" })).toBe("MAD SKY");
    expect(matchName({ jornada: null, rival: undefined })).toBe("Rival");
  });

  it("«Abrir la pizarra (J8 · MAD SKY)» goes to the board in the match's season", () => {
    const go = vi.fn();
    const cmd = pizarraCommand(m8, { id: "b8", isOfficial: true, matchId: "m8", updatedAt: 1 }, go);
    expect(cmd.title).toBe("Abrir la pizarra (J8 · MAD SKY)");
    cmd.run();
    expect(go).toHaveBeenCalledWith({ section: "pizarra", tablero: "b8", seasonId: "t1" });
  });

  it("«Ver en la web»: the match's public page; none for a draft not in the calendar", () => {
    const go = vi.fn();
    const cmd = webCommand(m8, go);
    expect(cmd?.title).toBe("Ver en la web");
    cmd?.run();
    expect(go).toHaveBeenCalledWith({ section: "web", matchId: "m8" });
    expect(webCommand({ ...m8, published: false }, go)).toBeNull();
  });
});
