// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "./clubData";
import { systemDef } from "./formations";
import { moreLine, POSTER_FACES, POSTER_SIZE, POSTER_SLOTS, posterContext, posterFonts, posterModel, type PosterContext } from "./matchPoster";
import { queryClient } from "./queryClient";

const ctx: PosterContext = { nameOf: (id) => ({ p1: "Pepe", p2: "Luis" })[id] ?? "Jugador", seasonName: "Temporada 1" };

const finished = (over: Partial<ClubMatch> = {}): ClubMatch => ({
  id: "m1",
  seasonId: "s1",
  rival: "Mad Sky",
  competition: "Liga F7",
  status: "finished",
  date: Date.UTC(2026, 10, 8, 11, 0),
  venue: "Campo Municipal",
  goalsFor: 3,
  goalsAgainst: 1,
  system: "2-3-1",
  events: [
    { id: "e3", type: "goal", minute: 30, playerId: "p2" },
    { id: "e1", type: "goal_penalty", minute: 4, playerId: "p1" },
    { id: "e2", type: "opponent_goal", minute: 10 },
    { id: "e4", type: "opponent_own_goal", elapsedSeconds: 19 * 60 + 30 },
  ],
  ...over,
});

/** A stand-in for document.fonts (jsdom has none). */
function fonts(set: { load: (font: string, text?: string) => Promise<unknown>; ready: Promise<unknown> }) {
  Object.defineProperty(document, "fonts", { configurable: true, value: set });
}

afterEach(() => {
  queryClient.clear();
  Reflect.deleteProperty(document, "fonts");
});

describe("POSTER_SLOTS", () => {
  it("keeps the post square and the story tall", () => {
    expect(POSTER_SIZE.square).toEqual({ w: 1080, h: 1080 });
    expect(POSTER_SIZE.story).toEqual({ w: 1080, h: 1920 });
  });

  it.each(["square", "story"] as const)("stacks the %s top to bottom, the scorers clear of the footer", (f) => {
    const s = POSTER_SLOTS[f];
    const { h } = POSTER_SIZE[f];
    expect(s.crest.y + s.crest.size).toBeLessThanOrEqual(s.us - s.teamSize);
    expect(s.head[0]).toBeLessThan(s.head[1]);
    expect(s.head[1]).toBeLessThan(s.head[2]);
    expect(s.head[2]).toBeLessThan(s.us - s.teamSize);
    expect(s.us).toBeLessThan(s.score - s.scoreSize * 0.72);
    expect(s.score).toBeLessThan(s.rival - s.teamSize);
    expect(s.rival).toBeLessThan(s.chip);
    expect(s.chip + 80).toBeLessThan(s.goals);
    expect(s.goals + s.line * s.maxLines).toBeLessThan(s.foot - 40);
    expect(s.foot).toBeLessThanOrEqual(h - 72);
  });
});

describe("posterModel", () => {
  it("tells the result in G·E·P with its word", () => {
    expect(posterModel(finished(), "square", ctx)).toMatchObject({ done: true, score: "3 – 1", letter: "G", word: "VICTORIA" });
    expect(posterModel(finished({ goalsFor: 1, goalsAgainst: 1 }), "square", ctx)).toMatchObject({ letter: "E", word: "EMPATE" });
    expect(posterModel(finished({ goalsFor: 0, goalsAgainst: 2 }), "square", ctx)).toMatchObject({ letter: "P", word: "DERROTA" });
  });

  it("lists our goals by minute, named by nameOf, the own goal as such and the live one in football's minute", () => {
    const d = posterModel(finished(), "square", ctx);
    expect(d.goals).toEqual([
      { min: "4′", name: "PEPE" },
      { min: "20′", name: "AUTOGOL RIVAL" },
      { min: "30′", name: "LUIS" },
    ]);
    expect(d.more).toBe(0);
    expect(d.noGoals).toBeNull();
  });

  it("puts goals without a minute last, with no minute printed", () => {
    const d = posterModel(finished({ events: [{ id: "a", type: "goal", playerId: "p1" }, { id: "b", type: "goal", minute: 12, playerId: "p2" }] }), "square", ctx);
    expect(d.goals).toEqual([
      { min: "12′", name: "LUIS" },
      { min: "", name: "PEPE" },
    ]);
  });

  it("folds the goals that don't fit into the last line", () => {
    const events = Array.from({ length: 7 }, (_, i) => ({ id: `g${i}`, type: "goal" as const, minute: i + 1, playerId: "p1" }));
    const sq = posterModel(finished({ goalsFor: 7, events }), "square", ctx);
    expect(sq.goals).toHaveLength(POSTER_SLOTS.square.maxLines - 1);
    expect(sq.more).toBe(7 - (POSTER_SLOTS.square.maxLines - 1));
    expect(moreLine(sq.more)).toBe("Y 4 GOLES MÁS");
    expect(moreLine(1)).toBe("Y 1 GOL MÁS");
    const story = posterModel(finished({ goalsFor: 7, events }), "story", ctx);
    expect(story.goals).toHaveLength(7);
    expect(story.more).toBe(0);
  });

  it("prints the system played, short and long", () => {
    const d = posterModel(finished(), "square", ctx);
    expect(d.system).toBe(`2-3-1 · ${systemDef("2-3-1").name}`);
    expect(d.mark).toBe("2-3-1");
    expect(posterModel(finished({ system: "libre" }), "square", ctx)).toMatchObject({ system: "Libre · sin sistema fijo", mark: "LIBRE" });
  });

  it("heads with the kicker, the competition and season, the day and the venue", () => {
    const d = posterModel(finished(), "story", ctx);
    expect(d.kick).toBe("FINAL DEL PARTIDO");
    expect(d.sub).toBe("LIGA F7 · TEMPORADA 1");
    expect(d.when).toMatch(/8 nov 2026.*· Campo Municipal$/);
    expect(d.rival).toBe("MAD SKY");
    expect(d.file).toBe("piti-m1-story.png");
    expect({ w: d.w, h: d.h }).toEqual(POSTER_SIZE.story);
  });

  it("still works for an old match: no events, no system, no season, no date", () => {
    const old: ClubMatch = { id: "old", rival: "", status: "finished", goalsFor: 2, goalsAgainst: 0 };
    const d = posterModel(old, "square", { nameOf: () => "Jugador" });
    expect(d).toMatchObject({ done: true, score: "2 – 0", letter: "G", goals: [], more: 0, system: null, mark: null, when: "", sub: "FÚTBOL 7", rival: "RIVAL" });
    expect(d.noGoals).toBe("GOLEADORES SIN REGISTRAR EN EL ACTA");
    expect(posterModel({ ...old, goalsFor: 0 }, "square", { nameOf: () => "" }).noGoals).toBeNull();
  });

  it("before the match: no score, no letter, no goals", () => {
    const d = posterModel({ id: "n", rival: "Mad Sky", status: "scheduled", date: Date.UTC(2026, 10, 15, 11, 0) }, "story", ctx);
    expect(d).toMatchObject({ done: false, kick: "DÍA DE PARTIDO", score: null, letter: null, word: null, goals: [], noGoals: null });
    expect(d.when).toMatch(/15 nov 2026/);
  });
});

describe("posterContext", () => {
  it("names by nameFor with the match's season, from the cached players and seasons", () => {
    queryClient.setQueryData(["players"], [
      { id: "p1", shirtName: "PEPE", seasonDetails: { s1: { shirtName: "PEPÍN" } } },
      { id: "p2", firstName: "Luis", lastName: "Gil" },
    ]);
    queryClient.setQueryData(["seasons"], [{ id: "s1", name: "Temporada 1" }]);
    const c = posterContext({ seasonId: "s1" });
    expect(c.nameOf("p1")).toBe("PEPÍN");
    expect(c.nameOf("p2")).toBe("Luis Gil");
    expect(c.nameOf("nobody")).toBe("Jugador");
    expect(c.seasonName).toBe("Temporada 1");
    expect(posterContext({ seasonId: "s2" }).nameOf("p1")).toBe("PEPE");
  });

  it("works without a season or a cache, and takes the caller's players first", () => {
    const c = posterContext({}, { players: [{ id: "p1", shirtName: "PEPE" }] });
    expect(c.nameOf("p1")).toBe("PEPE");
    expect(c.seasonName).toBeNull();
    expect(posterContext({ seasonId: "s1" }, { seasonName: "T1" }).seasonName).toBe("T1");
  });
});

describe("posterFonts", () => {
  it("loads Anybody and Geist explicitly before waiting for the font set", async () => {
    const order: string[] = [];
    const load = vi.fn((font: string) => {
      order.push("load " + font);
      return Promise.resolve([]);
    });
    fonts({
      load,
      get ready() {
        order.push("ready");
        return Promise.resolve();
      },
    });
    await posterFonts("PEPE 3 – 1");
    expect(load.mock.calls.map((c) => c[0])).toEqual([...POSTER_FACES]);
    expect(load).toHaveBeenCalledWith("900 100px Anybody", "PEPE 3 – 1");
    expect(POSTER_FACES.some((f) => f.includes("Geist"))).toBe(true);
    expect(order.at(-1)).toBe("ready");
  });

  it("never fails the poster when a face won't load", async () => {
    const load = vi.fn(() => Promise.reject(new Error("offline")));
    fonts({ load, ready: Promise.resolve() });
    await expect(posterFonts("x")).resolves.toBeUndefined();
  });
});
