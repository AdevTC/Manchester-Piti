import { describe, expect, it } from "vitest";
import { makeTeams, pachangaPlayers, pachangaSay, pachangaText, rng, shuffle, type PachangaInput, type PPlayer } from "./pachanga";
import { cromo, squadOf } from "./testkit";
import type { Zone } from "../formations";

// La pachanga: equipos igualados (forma y puestos), porteros fijos o por turnos, «juntos / separados»,
// siempre lo mismo para la misma semilla y otro reparto igual de parejo con la siguiente.

const P = (id: string, rt: number, pos?: Zone): PPlayer => ({ id, name: id.toUpperCase(), rt, ...(pos ? { pos } : {}) });
const TEN: PPlayer[] = [
  P("por1", 80, "POR"),
  P("por2", 60, "POR"),
  P("d1", 90, "DEF"),
  P("d2", 70, "DEF"),
  P("m1", 95, "MED"),
  P("m2", 65, "MED"),
  P("m3", 75, "MED"),
  P("m4", 72, "MED"),
  P("a1", 88, "DEL"),
  P("a2", 58, "DEL"),
];
const inp = (o: Partial<PachangaInput> = {}): PachangaInput => ({ players: TEN, teams: 2, keepers: "fijos", pairs: [], seed: 1, ...o });
const sum = (ids: string[]) => ids.reduce((s, id) => s + (TEN.find((p) => p.id === id)?.rt ?? 0), 0);
const same = (ids: string[], a: string, b: string) => ids.includes(a) && ids.includes(b);

describe("the seeded shuffle", () => {
  it("is the same for the same seed and keeps every item", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffle(xs, rng(7))).toEqual(shuffle(xs, rng(7)));
    expect(shuffle(xs, rng(7)).slice().sort()).toEqual(xs);
    expect(shuffle(xs, rng(7))).not.toEqual(shuffle(xs, rng(8)));
  });
});

describe("even teams", () => {
  it("everyone plays once; 5 against 5; one keeper each; even form and lines", () => {
    const p = makeTeams(inp());
    expect(p.teams.map((t) => t.name)).toEqual(["Con peto", "Sin peto"]);
    expect(p.teams.flatMap((t) => t.ids).sort()).toEqual(TEN.map((x) => x.id).sort());
    expect(p.teams.map((t) => t.ids.length)).toEqual([5, 5]);
    expect(p.teams.map((t) => t.keeper).sort()).toEqual(["por1", "por2"]);
    // the keeper is listed first
    p.teams.forEach((t) => expect(t.ids[0]).toBe(t.keeper));
    // the four midfielders two and two; the defenders and forwards one each
    p.teams.forEach((t) => {
      expect(t.ids.filter((id) => id.startsWith("m"))).toHaveLength(2);
      expect(t.ids.filter((id) => id.startsWith("d"))).toHaveLength(1);
      expect(t.ids.filter((id) => id.startsWith("a"))).toHaveLength(1);
    });
    // much more even than the best players on one side (diff ≤ 4 points of average)
    expect(p.diff).toBeLessThanOrEqual(4);
    expect(Math.abs(sum(p.teams[0].ids) - sum(p.teams[1].ids))).toBeLessThanOrEqual(20);
  });

  it("the same seed, the same teams; another seed, another split just as even", () => {
    const a = makeTeams(inp({ seed: 1 }));
    expect(makeTeams(inp({ seed: 1 }))).toEqual(a);
    const splits = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => makeTeams(inp({ seed: s })).teams[0].ids.slice().sort().join(",")));
    expect(splits.size).toBeGreaterThan(1);
    [2, 3, 4, 5].forEach((s) => expect(makeTeams(inp({ seed: s })).diff).toBeLessThanOrEqual(5));
  });

  it("three teams: sizes differ by one at most; an odd group too", () => {
    const p = makeTeams(inp({ teams: 3 }));
    expect(p.teams.map((t) => t.name)).toEqual(["Peto naranja", "Peto amarillo", "Sin peto"]);
    const sizes = p.teams.map((t) => t.ids.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    // two keepers for three teams: the third rotates
    expect(p.teams.filter((t) => t.keeper).length).toBe(2);
    expect(p.teams.find((t) => !t.keeper)?.turns.slice().sort()).toEqual(p.teams.find((t) => !t.keeper)?.ids.slice().sort());
    const odd = makeTeams(inp({ players: TEN.slice(0, 9) }));
    expect(odd.teams.map((t) => t.ids.length).sort()).toEqual([4, 5]);
  });

  it("portería por turnos: no fixed keeper; everyone takes a turn", () => {
    const p = makeTeams(inp({ keepers: "turnos" }));
    p.teams.forEach((t) => {
      expect(t.keeper).toBeNull();
      expect(t.turns.slice().sort()).toEqual(t.ids.slice().sort());
    });
  });

  it("too few for the teams: empty teams, nothing breaks", () => {
    const p = makeTeams(inp({ players: TEN.slice(0, 5), teams: 3 }));
    expect(p.teams.every((t) => t.ids.length === 0)).toBe(true);
  });
});

describe("«juntos / separados»", () => {
  it("are honoured on every seed", () => {
    const pairs = [
      { a: "m1", b: "a1", kind: "juntos" as const },
      { a: "d1", b: "d2", kind: "separados" as const },
      { a: "m1", b: "por1", kind: "separados" as const },
    ];
    for (let seed = 1; seed <= 12; seed++) {
      const p = makeTeams(inp({ pairs, seed }));
      expect(p.broken).toEqual([]);
      expect(p.teams.some((t) => same(t.ids, "m1", "a1"))).toBe(true);
      expect(p.teams.some((t) => same(t.ids, "d1", "d2"))).toBe(false);
      expect(p.teams.some((t) => same(t.ids, "m1", "por1"))).toBe(false);
      expect(p.diff).toBeLessThanOrEqual(8);
    }
  });

  it("a «separados» inside a «juntos» group can't be: it is reported (juntos wins)", () => {
    const pairs = [
      { a: "m1", b: "a1", kind: "juntos" as const },
      { a: "a1", b: "d1", kind: "juntos" as const },
      { a: "m1", b: "d1", kind: "separados" as const },
    ];
    const p = makeTeams(inp({ pairs }));
    expect(p.broken).toEqual([pairs[2]]);
    expect(p.teams.some((t) => t.ids.includes("m1") && t.ids.includes("a1") && t.ids.includes("d1"))).toBe(true);
    expect(pachangaSay(p)).toContain("Alguna condición no se ha podido cumplir");
  });

  it("pairs of people who didn't come are ignored", () => {
    const p = makeTeams(inp({ pairs: [{ a: "m1", b: "nadie", kind: "juntos" }] }));
    expect(p.broken).toEqual([]);
  });
});

describe("the squad and the share", () => {
  it("only the available; the unrated count as the median", () => {
    const sq = squadOf([cromo("a", 1, "POR", { rt: 80 }), cromo("b", 2, "DEF", { rt: 60 }), cromo("c", 3, "MED", { rt: 70 }), cromo("d", 4, "DEL", { rt: 45, unrated: true }), cromo("e", 5, "DEL", { baja: "Lesionado" })]);
    expect(pachangaPlayers(sq).map((p) => [p.id, p.rt])).toEqual([
      ["a", 80],
      ["b", 60],
      ["c", 70],
      ["d", 70],
    ]);
  });

  it("the text for WhatsApp: a line per team, the keeper or the turns", () => {
    const p = makeTeams(inp({ players: TEN.slice(0, 4), seed: 3 }));
    const txt = pachangaText(p, (id) => id.toUpperCase(), "mar 14 oct");
    expect(txt.startsWith("Pachanga · mar 14 oct · 4 jugadores")).toBe(true);
    expect(txt).toContain("CON PETO (media ");
    expect(txt).toContain("SIN PETO (media ");
    expect(txt).toContain("(portero)");
    expect(pachangaSay(p)).toMatch(/^Equipos hechos: 2 contra 2/);
  });
});
