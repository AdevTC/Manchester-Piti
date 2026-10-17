import { describe, expect, it } from "vitest";
import type { Convocatoria, Cromo } from "../../pizarra/v2/model";
import { formMeter, rollNote, rollRows, samePresent, togglePresent } from "./llegadaModel";

const cromo = (id: string, extra: Partial<Cromo> = {}): Cromo => ({
  id, num: 1, name: id.toUpperCase(), rt: 60, recentMin: 0, recentGA: 0,
  stats: { played: 3, goals: 0, assists: 0, minutes: 90, starts: 3, mvps: 0 }, ...extra,
});
const g = (played: boolean, ga: number) => ({ j: 1, played, min: played ? 50 : 0, ga });

describe("la forma", () => {
  it("cuts the cromo's rating in five bands; no match yet lights nothing", () => {
    expect(formMeter(cromo("a", { unrated: true }))).toMatchObject({ level: 0, word: "Sin partidos" });
    expect(formMeter(cromo("a", { rt: 46 }))).toMatchObject({ level: 1, word: "Baja", low: true });
    expect(formMeter(cromo("a", { rt: 58 }))).toMatchObject({ level: 3, word: "Normal" });
    expect(formMeter(cromo("a", { rt: 70 }))).toMatchObject({ level: 4, word: "Buena" });
    expect(formMeter(cromo("a", { rt: 90 }))).toMatchObject({ level: 5, word: "Muy buena", hot: false });
    expect(formMeter(undefined).level).toBe(0);
  });
  it("«En racha»: a goal or an assist in each of his last three played", () => {
    expect(formMeter(cromo("a", { rt: 50, form: [g(true, 1), g(false, 0), g(true, 2), g(true, 1)] }))).toMatchObject({ level: 5, word: "En racha", hot: true });
    expect(formMeter(cromo("a", { rt: 50, form: [g(true, 1), g(true, 0), g(true, 1)] })).hot).toBe(false);
  });
});

describe("las filas", () => {
  const called = [
    { id: "gk", name: "Álex", number: "1", guest: false },
    { id: "b", name: "Mario", number: "7", guest: false },
    { id: "c", name: "Lucas", number: "9", guest: false },
    { id: "guest-1", name: "Primo", number: "", guest: true },
  ];
  const squad = new Map([
    ["gk", cromo("gk", { ps: { main: "POR", also: [], line: "POR" }, rt: 65 })],
    ["b", cromo("b", { pos: "DEL", rt: 64 })],
    ["c", cromo("c", { unrated: true })],
  ]);
  const conv = new Map<string, Convocatoria>([["gk", "voy"], ["b", "duda"], ["c", "no"]]);

  it("puts who said voy or duda first, with the pizarra's position, rating and his answer", () => {
    const { main, rest } = rollRows(called, squad, conv, new Set(["gk"]));
    expect(main.map((r) => r.id)).toEqual(["gk", "b"]);
    expect(rest.map((r) => r.id)).toEqual(["c", "guest-1"]);
    expect(main[0]).toMatchObject({ pos: "POR", keeper: true, rt: "65", here: true, line: "Ha venido" });
    expect(main[1]).toMatchObject({ pos: "DEL", keeper: false, here: false, line: "Dijo «duda»", lineCls: "duda" });
    expect(rest[0]).toMatchObject({ rt: "—", line: "Dijo que no viene", lineCls: "nova" });
    expect(rest[1]).toMatchObject({ pos: "—", number: "Inv", line: "Invitado" });
    expect(main[0].aria).toMatch(/^Álex, POR, forma 65.*ha venido$/);
  });

  it("says how many are left, the bench and a missing keeper", () => {
    expect(rollNote(5, true)).toMatchObject({ a: "Faltan 2 para el siete", enough: false, cta: "Faltan 2" });
    expect(rollNote(8, true)).toMatchObject({ a: "8 para elegir · ", b: "1 al banquillo", enough: true, cta: "Elegir el siete" });
    expect(rollNote(7, true).b).toBe("nadie al banquillo");
    expect(rollNote(9, false)).toMatchObject({ a: "Ojo: ", b: "no ha venido ningún portero", enough: true });
  });

  it("toggles one in convocatoria order and compares lists in any order", () => {
    expect(togglePresent(["c"], "a", ["a", "b", "c"])).toEqual(["a", "c"]);
    expect(togglePresent(["a", "c", "gone"], "a", ["a", "b", "c"])).toEqual(["c"]);
    expect(samePresent(["a", "b"], ["b", "a"])).toBe(true);
    expect(samePresent(null, [])).toBe(true);
    expect(samePresent(["a"], ["b"])).toBe(false);
  });
});
