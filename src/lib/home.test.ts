import { describe, expect, it } from "vitest";
import type { ClubMatch } from "./clubData";
import { clubMedals, countdownParts, leaders, matchEvent, narrative, playerLines, playerMoment, seasonPulse, upcomingBirthdays } from "./home";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 10, 12);
const squad = [
  { id: "a", name: "ADRIÁN T.C.", num: "10", birthDate: "2004-04-18" },
  { id: "e", name: "ERIK", num: "9", birthDate: "2003-10-12" },
  { id: "h", name: "HUBEROSKI", num: "14" },
];
const nameOf = (id: string) => squad.find((p) => p.id === id)?.name ?? "—";
const goal = (playerId: string, assistPlayerId?: string) => ({ id: Math.random().toString(), type: "goal" as const, playerId, assistPlayerId });
const played = (id: string, daysAgo: number, gf: number, ga: number, events: ClubMatch["events"] = []): ClubMatch => ({ id, seasonId: "s1", rival: `Rival ${id}`, status: "finished", date: NOW - daysAgo * DAY, goalsFor: gf, goalsAgainst: ga, events });
const upcoming = (id: string, inDays: number): ClubMatch => ({ id, seasonId: "s1", rival: `Rival ${id}`, status: "scheduled", date: NOW + inDays * DAY });
const ctx = (p: ReturnType<typeof seasonPulse>, lines = playerLines(squad, p.played)) => ({ seasonName: "Temporada 1", squadSize: squad.length, now: NOW, nameOf, scorer: leaders(lines, "goals", 1)[0] });

describe("home narrative", () => {
  it("pre-season without a date", () => {
    const p = seasonPulse([], "s1", NOW);
    expect(narrative(p, ctx(p))).toMatchObject({ head: "La Temporada 1 está a punto de empezar.", em: "3 dorsales, cero goles y toda la historia por escribir." });
  });
  it("countdown to the first match", () => {
    const p = seasonPulse([upcoming("x", 3)], "s1", NOW);
    expect(narrative(p, ctx(p)).head).toBe("Cuenta atrás para el estreno.");
  });
  it("a win in the last days names the scorer and the leader", () => {
    const p = seasonPulse([played("m1", 2, 3, 1, [goal("a"), goal("a"), goal("e", "h")])], "s1", NOW);
    const n = narrative(p, ctx(p));
    expect(n.head).toBe("¡Victoria! 3–1 ante Rival m1.");
    expect(n.em).toBe("ADRIÁN T.C. firmó un doblete: ya suma 2 y lidera el Pichichi.");
    expect(n.kick).toBe("Temporada 1 · jornada 1");
  });
  it("a loss points to the revancha", () => {
    const p = seasonPulse([played("m1", 1, 0, 2), upcoming("m2", 5)], "s1", NOW);
    expect(narrative(p, ctx(p)).head).toBe("Tocó perder ante Rival m1, 0–2.");
    expect(narrative(p, ctx(p)).em).toMatch(/^Revancha: .* ante Rival m2\.$/);
  });
  it("a live match wins over everything", () => {
    const live: ClubMatch = { id: "l", seasonId: "s1", rival: "Rival L", status: "scheduled", date: NOW - 10 * 60_000, goalsFor: 1, goalsAgainst: 0 };
    const p = seasonPulse([played("m1", 1, 2, 2), live], "s1", NOW);
    expect(narrative(p, ctx(p)).head).toBe("¡En juego! Piti 1–0 Rival L.");
  });
  it("mid-season quiet week falls back to the leader", () => {
    const p = seasonPulse([played("m1", 20, 1, 0, [goal("e")])], "s1", NOW);
    expect(narrative(p, ctx(p))).toMatchObject({ head: "1 partido, 1 gol.", em: "ERIK lidera el Pichichi con 1 gol." });
  });
});

describe("home season data", () => {
  it("pulse counts results, goals and form (most recent first)", () => {
    const p = seasonPulse([played("m1", 9, 1, 0), played("m2", 6, 1, 1), played("m3", 3, 0, 2), upcoming("n", 2)], "s1", NOW);
    expect([p.wins, p.draws, p.losses, p.gf, p.ga]).toEqual([1, 1, 1, 2, 3]);
    expect(p.form).toEqual(["P", "E", "G"]);
    expect(p.next?.id).toBe("n");
  });
  it("player moments", () => {
    const m = played("m1", 2, 2, 0, [goal("a", "h"), goal("a", "h")]);
    const lines = playerLines(squad, [m]);
    expect(playerMoment(lines[0], { pichichiId: "a", lastMatch: m })).toBe("Pichichi del equipo: 2 goles en 1 partido.");
    expect(playerMoment(lines[2], { pichichiId: "a", lastMatch: m })).toBe("2 asistencias: el que reparte juego.");
    expect(playerMoment(playerLines(squad, [])[1], {})).toBe("Aún sin estrenar: su primer gol se contará aquí.");
  });
  it("club medals fill as the firsts happen", () => {
    const empty = seasonPulse([], "s1", NOW);
    expect(clubMedals(empty, playerLines(squad, []), nameOf, () => "").every((m) => !m.earned)).toBe(true);
    const p = seasonPulse([played("m1", 9, 0, 1), played("m2", 3, 4, 2, [goal("e"), goal("a", "e")])], "s1", NOW);
    const medals = clubMedals(p, playerLines(squad, p.played), nameOf, () => "d");
    expect(medals.find((m) => m.id === "win")).toMatchObject({ earned: true, title: "4–2" });
    expect(medals.find((m) => m.id === "goal")?.title).toBe("ERIK");
    expect(medals.find((m) => m.id === "record")).toMatchObject({ earned: true, title: "4 goles" });
  });
  it("birthdays: next ones, day and month only", () => {
    const b = upcomingBirthdays(squad, NOW);
    expect(b.map((x) => [x.name, x.label, x.days])).toEqual([["ERIK", "12 oct", 2], ["ADRIÁN T.C.", "18 abr", 190]]);
  });
  it("countdown parts and the match as a calendar event", () => {
    expect(countdownParts(NOW + DAY + 3_600_000 * 2 + 60_000 * 5, NOW)).toEqual({ d: 1, h: 2, m: 5 });
    const ev = matchEvent({ id: "m9", date: Date.UTC(2026, 9, 18, 9), rival: "Rival X", venue: "Campo", duration: 50 }, "https://x.test");
    expect(ev).toEqual({ uid: "m9", title: "Manchester Piti vs Rival X", start: Date.UTC(2026, 9, 18, 9), end: Date.UTC(2026, 9, 18, 10, 20), location: "Campo", url: "https://x.test/matches/m9" });
  });
});
