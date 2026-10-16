import { describe, expect, it } from "vitest";
import { dateKeywords, flattenGroups, matchScore, normalize, SEARCH_LIMIT, searchEntries, shortDate, textMatches, type SearchEntry } from "./search";

const entry = (e: Partial<SearchEntry> & Pick<SearchEntry, "id" | "kind" | "title">): SearchEntry => ({ target: { to: "club" }, ...e });

describe("normalize", () => {
  it("folds accents, case and spaces", () => {
    expect(normalize("  ADRIÁN   Núñez ")).toBe("adrian nunez");
  });
});

describe("textMatches (the admin palette's rule)", () => {
  it("contains, every word, an exact dorsal, a jornada only exactly", () => {
    expect(textMatches({ text: "Nuevo partido Rival, fecha y campo" }, "fecha")).toBe(true);
    expect(textMatches({ text: "ANDIA", exact: ["19"] }, "19")).toBe(true);
    expect(textMatches({ text: "ANDIA", exact: ["19"] }, "1")).toBe(false);
    expect(textMatches({ text: "J10 · Rival", exact: ["J10"] }, "J1")).toBe(false);
    expect(textMatches({ text: "J8 · Rival", exact: ["J8"] }, "j 8")).toBe(true);
    expect(textMatches({ text: "Plantilla" }, "")).toBe(false);
  });
});

describe("matchScore", () => {
  it("ignores accents and case", () => {
    expect(matchScore({ title: "RUBÉN" }, "ruben")).toBeGreaterThan(0);
    expect(matchScore({ title: "Ruben" }, "RUBÉN")).toBeGreaterThan(0);
  });
  it("ranks exact > title prefix > word prefix > contains > subsequence", () => {
    const exact = matchScore({ title: "ANDIA", exact: ["9"] }, "9");
    const prefix = matchScore({ title: "Hugo" }, "hug");
    const word = matchScore({ title: "J5 · Rayo Vallecano" }, "rayo");
    const contains = matchScore({ title: "Barrayo" }, "rayo");
    const fuzzy = matchScore({ title: "Hugo Sánchez" }, "hgs");
    expect(exact).toBe(100);
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(contains);
    expect(contains).toBeGreaterThan(fuzzy);
    expect(fuzzy).toBeGreaterThan(0);
  });
  it("fuzzy-lite: letters in order, tighter spans first; never out of order", () => {
    expect(matchScore({ title: "Estadísticas" }, "stdc")).toBeGreaterThan(0);
    expect(matchScore({ title: "Estadísticas" }, "cdts")).toBe(0);
    expect(matchScore({ title: "Pablo" }, "pbl")).toBeGreaterThan(matchScore({ title: "Pedro Bellido" }, "pbl"));
  });
  it("a dorsal only exactly: «9» does not find «19»", () => {
    expect(matchScore({ title: "ANDIA", exact: ["19"] }, "19")).toBe(100);
    expect(matchScore({ title: "ANDIA", exact: ["19"] }, "9")).toBe(0);
    expect(matchScore({ title: "ANDIA", exact: ["19"] }, "1")).toBe(0);
  });
  it("«j5» finds J5 only (not J15), «J 5» too", () => {
    expect(matchScore({ title: "J5 · Rayo", exact: ["J5"] }, "j5")).toBe(100);
    expect(matchScore({ title: "J5 · Rayo", exact: ["J5"] }, "J 5")).toBe(100);
    expect(matchScore({ title: "J15 · Atleti", exact: ["J15"] }, "j5")).toBe(0);
    expect(matchScore({ title: "J15 · Atleti", exact: ["J15"] }, "j1")).toBe(0);
  });
  it("finds a date as typed: «12 oct», «12 octubre», «12/10»", () => {
    const ms = Date.UTC(2026, 9, 12, 16, 0);
    const m = { title: "J5 · Rayo", keywords: `Rayo ${dateKeywords(ms)}` };
    expect(shortDate(ms)).toBe("12 oct");
    expect(matchScore(m, "12 oct")).toBeGreaterThan(0);
    expect(matchScore(m, "12 octubre")).toBeGreaterThan(0);
    expect(matchScore(m, "12/10")).toBeGreaterThan(0);
    expect(matchScore(m, "12 nov")).toBe(0);
    expect(matchScore(m, "13 oct")).toBe(0);
  });
  it("uses the Madrid day (a late kick-off is still that day)", () => {
    expect(shortDate(Date.UTC(2026, 9, 12, 22, 30))).toBe("13 oct");
  });
});

describe("searchEntries", () => {
  const entries: SearchEntry[] = [
    entry({ id: "s:plantilla", kind: "seccion", title: "Plantilla" }),
    entry({ id: "r:rayo", kind: "rival", title: "Rayo" }),
    ...Array.from({ length: 9 }, (_, i) => entry({ id: `m:${i}`, kind: "partido", title: `J${i + 1} · Rayo`, exact: [`J${i + 1}`] })),
    entry({ id: "p:hugo", kind: "jugador", title: "HUGO", keywords: "Hugo Pérez" }),
    entry({ id: "p:rayan", kind: "jugador", title: "RAYAN" }),
    entry({ id: "t:1", kind: "temporada", title: "Temporada 1" }),
  ];
  const ids = (q: string) => flattenGroups(searchEntries(entries, q)).map((e) => e.id);

  it("«hug» → Hugo first", () => {
    expect(ids("hug")[0]).toBe("p:hugo");
  });
  it("«rayo» → the dossier and the matches, capped per kind and in all", () => {
    const groups = searchEntries(entries, "rayo");
    expect(groups.map((g) => g.title)).toEqual(["Rivales", "Partidos"]);
    expect(groups[1].items).toHaveLength(5);
    expect(flattenGroups(groups).length).toBeLessThanOrEqual(SEARCH_LIMIT);
  });
  it("ties go to players, then matches; a boost lifts the next match", () => {
    const tie: SearchEntry[] = [
      entry({ id: "s", kind: "seccion", title: "Mario" }),
      entry({ id: "m", kind: "partido", title: "Mario FC" }),
      entry({ id: "p", kind: "jugador", title: "Mario" }),
    ];
    expect(flattenGroups(searchEntries(tie, "mario")).map((e) => e.id)).toEqual(["p", "m", "s"]);
    const boosted: SearchEntry[] = [entry({ id: "old", kind: "partido", title: "Rayo" }), entry({ id: "next", kind: "partido", title: "Rayo", boost: 5 })];
    expect(flattenGroups(searchEntries(boosted, "rayo")).map((e) => e.id)).toEqual(["next", "old"]);
  });
  it("never more than 8 results", () => {
    const many = Array.from({ length: 30 }, (_, i) => entry({ id: `x${i}`, kind: (["jugador", "partido", "rival", "temporada", "seccion"] as const)[i % 5], title: `Alfa ${i}` }));
    expect(flattenGroups(searchEntries(many, "alfa"))).toHaveLength(SEARCH_LIMIT);
  });
  it("nothing for an empty query or no match", () => {
    expect(searchEntries(entries, "")).toEqual([]);
    expect(searchEntries(entries, "zzzz")).toEqual([]);
  });
});
