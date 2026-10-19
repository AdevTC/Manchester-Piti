import { describe, expect, it } from "vitest";
import { scoreOf, shownMinute } from "../../partidos";
import { matchdayOf } from "../matchday";
import { LONG_RIVALS, longSeasonFixture, madridMs } from "./fixtures";

describe("the long-season fixture", () => {
  const f = longSeasonFixture();

  it("14 teams, 26 jornadas, each rival twice; J17 at home against Orduña fc", () => {
    expect(f.standings).toHaveLength(14);
    expect(f.matches).toHaveLength(26);
    for (const r of LONG_RIVALS) expect(f.matches.filter((m) => m.rival === r)).toHaveLength(2);
    expect(f.matches[16]).toMatchObject({ id: "j17", rival: "Orduña fc", home: true });
    expect(f.standings.filter((r) => r.isUs)).toHaveLength(1);
  });

  it("tonight is minute 23 of J17, 2–1, with 38 plays", () => {
    const j17 = f.matches[16];
    expect(shownMinute(j17, f.now)).toBe(23);
    expect(scoreOf(j17)).toEqual({ gf: 2, ga: 1 });
    expect(j17.events).toHaveLength(38);
    expect(matchdayOf(f.matches, f.seasonId, f.now)).toMatchObject({ phase: "directo1", jornada: 17, minute: 23, score: { gf: 2, ga: 1 } });
  });

  it("our row matches our results (15 played, 8–2–5, 29–22)", () => {
    const played = f.matches.filter((m) => m.status === "finished");
    expect(played).toHaveLength(15);
    const gf = played.reduce((s, m) => s + (m.goalsFor ?? 0), 0);
    const ga = played.reduce((s, m) => s + (m.goalsAgainst ?? 0), 0);
    expect(f.standings.find((r) => r.isUs)).toMatchObject({ pj: 15, g: 8, e: 2, p: 5, gf, gc: ga, pts: 26 });
  });

  it("is built fresh each call, and Madrid's clock changes are honoured", () => {
    const g = longSeasonFixture();
    g.matches[0].rival = "Otro";
    expect(longSeasonFixture().matches[0].rival).toBe("Chamartín Bohemios");
    expect(madridMs(2026, 10, 18, 19)).toBe(Date.UTC(2026, 9, 18, 17));
    expect(madridMs(2027, 1, 17, 19)).toBe(Date.UTC(2027, 0, 17, 18));
  });
});
