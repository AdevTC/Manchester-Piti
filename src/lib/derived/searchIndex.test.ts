import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../clubData";
import { flattenGroups, searchEntries } from "./search";
import { buildSearchIndex, sectionEntries, type SearchIndexInput } from "./searchIndex";

const NOW = Date.UTC(2026, 9, 16, 10);
const day = (d: number) => new Date(Date.UTC(2026, 9, d, 16)).toISOString();
const played = (id: string, d: number, rival: string, gf = 2, ga = 1): ClubMatch => ({ id, seasonId: "t1", date: day(d), rival, status: "finished", goalsFor: gf, goalsAgainst: ga });

const input = (over: Partial<SearchIndexInput> = {}): SearchIndexInput => ({
  players: [
    { id: "hugo", shirtName: "HUGO", firstName: "Hugo", lastName: "Martínez", seasons: ["t1"], seasonDetails: { t1: { number: 9 } } },
    { id: "ruben", shirtName: "RUBÉN", firstName: "Rubén", seasons: ["t1"], number: 19 },
  ],
  matches: [
    played("m1", 1, "Rayo Vallecano"),
    played("m2", 5, "Atlético Cebolla", 0, 3),
    played("m3", 12, "Rayo Vallecano", 4, 0),
    { id: "m4", seasonId: "t1", date: day(26), rival: "rayo vallecano", status: "scheduled" },
    { id: "m5", seasonId: "t1", date: day(19), rival: "Los Otros", status: "scheduled" },
    { id: "draft", seasonId: "t1", date: day(30), rival: "Borrador FC", status: "scheduled", published: false } as ClubMatch,
  ],
  seasons: [{ id: "t1", name: "Temporada 1" }],
  currentSeasonId: "t1",
  member: false,
  now: NOW,
  ...over,
});
const ids = (q: string, over?: Partial<SearchIndexInput>) => flattenGroups(searchEntries(buildSearchIndex(input(over)), q)).map((e) => e.id);

describe("buildSearchIndex", () => {
  it("«hug» → Hugo's page, on his season", () => {
    const [first] = flattenGroups(searchEntries(buildSearchIndex(input()), "hug"));
    expect(first.id).toBe("p:hugo");
    expect(first.target).toEqual({ to: "jugador", playerId: "hugo", season: "t1" });
    expect(first.detail).toBe("Dorsal 9 · Temporada 1");
  });
  it("finds a player by first name, accents ignored, and by dorsal exactly", () => {
    expect(ids("ruben")[0]).toBe("p:ruben");
    expect(ids("martinez")[0]).toBe("p:hugo");
    expect(ids("9")[0]).toBe("p:hugo");
    expect(ids("19")[0]).toBe("p:ruben");
  });
  it("«rayo» → the dossier and the matches vs Rayo (one rival, whatever the spelling)", () => {
    const out = ids("rayo");
    expect(out.filter((id) => id.startsWith("r:"))).toEqual(["r:rayo vallecano"]);
    expect(out.filter((id) => id.startsWith("m:")).sort()).toEqual(["m:m1", "m:m3", "m:m4"]);
  });
  it("a rival leads to the next match against them, else the latest meeting", () => {
    const entries = buildSearchIndex(input());
    expect(entries.find((e) => e.id === "r:rayo vallecano")?.target).toEqual({ to: "partido", matchId: "m4" });
    expect(entries.find((e) => e.id === "r:atletico cebolla")?.target).toEqual({ to: "partido", matchId: "m2" });
  });
  it("«j5» / «J3» → that jornada's match, «12 oct» → the match that day", () => {
    expect(ids("j3")).toEqual(["m:m3"]);
    expect(ids("J 4")).toEqual(["m:m5"]);
    expect(ids("12 oct")).toEqual(["m:m3"]);
  });
  it("the next match is marked and boosted; drafts are not public", () => {
    const entries = buildSearchIndex(input());
    const next = entries.find((e) => e.id === "m:m5");
    expect(next?.boost).toBeGreaterThan(0);
    expect(next?.detail).toContain("Próximo partido");
    expect(entries.some((e) => e.id === "m:draft")).toBe(false);
  });
  it("seasons lead to /partidos?season=", () => {
    expect(buildSearchIndex(input()).find((e) => e.id === "t:t1")?.target).toEqual({ to: "partidos", season: "t1" });
  });
  it("members-only sections are hidden for fans", () => {
    const fan = sectionEntries(false).map((e) => e.title);
    const member = sectionEntries(true).map((e) => e.title);
    expect(fan).toEqual(expect.arrayContaining(["Partidos", "Plantilla", "Estadísticas", "El club", "Clasificación", "Vestuario"]));
    for (const t of ["Mi perfil", "Pizarra", "La caja"]) {
      expect(fan).not.toContain(t);
      expect(member).toContain(t);
    }
    expect(ids("pizarra")).toEqual([]);
    expect(ids("pizarra", { member: true })).toEqual(["s:pizarra"]);
  });
});
