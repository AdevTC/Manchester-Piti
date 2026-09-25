import { describe, expect, it } from "vitest";
import { compareMetric, duelVerdict, formatHeight, matchesQuery, missingText, sortSquad, squadRow, squadSummary, zodiac, type SquadPlayer } from "./squad";

const NOW = Date.UTC(2026, 8, 25, 12);
const none = { matchesPlayed: 0, goals: 0, assists: 0, minutes: 0, tracked: 0 };
const row = (p: Partial<SquadPlayer> & { id: string }, stats = none) => squadRow(p, stats, NOW);
const adrian = row({ id: "a", shirtName: "ADRIÁN T.C.", firstName: "Adrián", lastName: "Tomás Cerdá", number: 10, birthDate: "2004-04-18", height: 183, weight: 80 });
const eguz = row({ id: "e", shirtName: "EGUZQUIZA", firstName: "Miguel", lastName: "Eguzquiza", number: 22, birthDate: "2004-11-06", height: 183, weight: 73 });
const erik = row({ id: "k", shirtName: "ERIK", firstName: "Erik", number: 9 });
const brawan = row({ id: "b", shirtName: "BRAWAN", number: 33, birthDate: "2003-06-11", height: 173, weight: 71 });

describe("squadRow", () => {
  it("derives age, next birthday, sign and full name", () => {
    expect(adrian).toMatchObject({ name: "ADRIÁN T.C.", num: "10", full: "Adrián Tomás Cerdá", age: 22, year: 2004, sign: "Aries", missing: [] });
    expect(adrian.birthday).toEqual({ label: "18 abr", days: 205 });
    expect(eguz.birthday).toEqual({ label: "6 nov", days: 42 });
  });
  it("lists what the ficha is missing and never invents it", () => {
    expect(erik).toMatchObject({ age: null, height: null, weight: null, birthday: null, sign: null, missing: ["cumpleaños", "altura", "peso"] });
    expect(missingText(erik.missing)).toBe("cumpleaños, altura y peso");
    expect(missingText(["altura"])).toBe("altura");
  });
  it("rejects impossible dates and keeps minutes unknown without actas", () => {
    expect(row({ id: "x", birthDate: "2004-02-31" }).age).toBeNull();
    expect(row({ id: "y" }, { matchesPlayed: 3, goals: 2, assists: 1, minutes: 0, tracked: 0 }).stats).toEqual({ played: 3, goals: 2, assists: 1, minutes: null });
  });
  it("zodiac edges", () => {
    expect(zodiac(1, 19)).toBe("Capricornio");
    expect(zodiac(1, 20)).toBe("Acuario");
    expect(zodiac(12, 22)).toBe("Capricornio");
  });
});

describe("sorting, search and figures", () => {
  const rows = [brawan, erik, eguz, adrian];
  it("sorts with missing values last", () => {
    expect(sortSquad(rows, "num").map((r) => r.num)).toEqual(["9", "10", "22", "33"]);
    expect(sortSquad(rows, "height").map((r) => r.name)).toEqual(["ADRIÁN T.C.", "EGUZQUIZA", "BRAWAN", "ERIK"]);
    expect(sortSquad(rows, "age").map((r) => r.name)).toEqual(["EGUZQUIZA", "ADRIÁN T.C.", "BRAWAN", "ERIK"]);
    expect(sortSquad(rows, "name")[0].name).toBe("ADRIÁN T.C.");
  });
  it("searches without accents, by full name or exact dorsal", () => {
    expect(matchesQuery(adrian, "adrian")).toBe(true);
    expect(matchesQuery(adrian, "cerda")).toBe(true);
    expect(matchesQuery(adrian, "10")).toBe(true);
    expect(matchesQuery(adrian, "1")).toBe(false);
  });
  it("summarises the squad from real data only", () => {
    expect(squadSummary(rows)).toEqual({ size: 4, avgAge: "22,0", agesKnown: 3, quinta: { year: 2004, count: 2 }, incomplete: 1 });
    expect(formatHeight(183)).toBe("1,83");
  });
});

describe("cara a cara", () => {
  const all = [adrian, eguz, erik, brawan];
  it("only more-is-better metrics have a winner", () => {
    expect(compareMetric("height", "Altura", adrian, brawan, all)).toMatchObject({ left: "1,83", right: "1,73", leftWins: true, rightWins: false });
    expect(compareMetric("weight", "Peso", adrian, eguz, all)).toMatchObject({ leftWins: false, rightWins: false });
    expect(compareMetric("height", "Altura", adrian, erik, all)).toMatchObject({ right: "—", rightPct: 0, leftWins: false });
  });
  it("tells the duel in one line", () => {
    expect(duelVerdict(adrian, eguz, false)).toBe("Misma altura: 1,83 m cada uno. EGUZQUIZA es el más joven de los dos.");
    expect(duelVerdict(adrian, brawan, false)).toBe("ADRIÁN T.C. le saca 10 cm a BRAWAN. ADRIÁN T.C. es el más joven de los dos.");
    expect(duelVerdict(adrian, erik, false)).toMatch(/^A ERIK le falta la altura/);
    const scorer = row({ id: "s", shirtName: "S", height: 170 }, { matchesPlayed: 2, goals: 3, assists: 0, minutes: 90, tracked: 2 });
    expect(duelVerdict(scorer, brawan, true)).toMatch(/^S va por delante en goles \(3 a 0\)\./);
  });
});
