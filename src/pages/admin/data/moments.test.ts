import { describe, expect, it } from "vitest";
import { clockText, countdown, countdownShort, hoyHero, matchAfter, matchMoment, type MomentMatch } from "./moments";

const MIN = 60_000;
const KICK = Date.UTC(2026, 10, 8, 11); // Sunday 8 Nov, 12:00 Madrid
const m8: MomentMatch = { id: "m8", date: KICK, duration: 50, status: "scheduled", published: true, draft: false };

describe("matchMoment", () => {
  it("antes → juego (kick-off … duration + 15′) → final → publicado", () => {
    expect(matchMoment(m8, KICK - 1)).toBe("antes");
    expect(matchMoment(m8, KICK)).toBe("juego");
    expect(matchMoment(m8, KICK + 64 * MIN)).toBe("juego");
    expect(matchMoment(m8, KICK + 65 * MIN)).toBe("final");
    expect(matchMoment({ ...m8, status: "finished" }, KICK + 2 * MIN)).toBe("publicado");
    // a draft over a published final acta: still to publish
    expect(matchMoment({ ...m8, status: "finished", draft: true }, KICK + 90 * MIN)).toBe("final");
  });
  it("whistled early leaves «juego»; no date = antes; default duration 50", () => {
    expect(matchMoment(m8, KICK + 20 * MIN, true)).toBe("final");
    expect(matchMoment({ id: "x" }, KICK)).toBe("antes");
    expect(matchMoment({ id: "x", date: KICK }, KICK + 64 * MIN)).toBe("juego");
  });
});

describe("hoyHero", () => {
  const m7: MomentMatch = { id: "m7", date: KICK - 7 * 24 * 60 * MIN, status: "finished", published: true };
  const m9: MomentMatch = { id: "m9", date: KICK + 7 * 24 * 60 * MIN, status: "scheduled", published: true };
  const list = [m9, m7, m8];
  it("the next match before, the live one during, the one just played after (36 h)", () => {
    expect(hoyHero(list, KICK - 26 * 60 * MIN)).toEqual({ match: m8, moment: "antes" });
    expect(hoyHero(list, KICK + 30 * MIN)).toEqual({ match: m8, moment: "juego" });
    expect(hoyHero(list, KICK + 2 * 60 * MIN)).toEqual({ match: m8, moment: "final" });
    expect(hoyHero(list, KICK + 30 * MIN, new Set(["m8"]))).toEqual({ match: m8, moment: "final" });
    expect(hoyHero(list, KICK + 37 * 60 * MIN)).toEqual({ match: m9, moment: "antes" });
  });
  it("a match about to start (12 h) wins over the one just played; cancelled ones never count; off-season = null", () => {
    const soon: MomentMatch = { id: "s", date: KICK + 10 * 60 * MIN, status: "scheduled" };
    expect(hoyHero([m8, soon], KICK + 2 * 60 * MIN)?.match.id).toBe("s");
    expect(hoyHero([{ ...m8, status: "cancelled" }], KICK - MIN)).toBeNull();
    expect(hoyHero([m7], KICK)).toBeNull();
  });
  it("matchAfter: the next one after the hero", () => {
    expect(matchAfter(list, m8, KICK)?.id).toBe("m9");
    expect(matchAfter(list, m9, KICK)).toBeNull();
  });
});

describe("clocks", () => {
  it("countdown / short / match clock", () => {
    const now = KICK - (38 * 60 + 32) * MIN;
    expect(countdown(KICK, now)).toBe("1d 14h 32m");
    expect(countdownShort(KICK, now)).toBe("1d 14h");
    expect(countdown(KICK, KICK - 90 * MIN)).toBe("1h 30m");
    expect(countdown(KICK, KICK + MIN)).toBe("0m");
    expect(clockText(KICK, KICK + (31 * 60 + 12) * 1000)).toBe("31:12");
    expect(clockText(KICK, KICK - 5000)).toBe("0:00");
  });
});
