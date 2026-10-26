// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { countTxt, fold, matches, noteOpened, organize, readSort, recentIds, recentRows, RECENT_KEEP, writeSort, type Organizable } from "./boardList";

// Mis tableros organizados: la búsqueda (nombre, rival, partido, etiqueta; sin tildes), el filtro por
// etiqueta, los tres órdenes y la tira «Recientes» (lo abierto en este dispositivo).

const rows: Organizable[] = [
  { id: "a", name: "Plan B", at: 300, tags: ["Copa"], rival: "ATLÉTICO B", matchMs: 2000, matchTxt: "J9 · ATLÉTICO B" },
  { id: "b", name: "Entreno martes", at: 100, tags: ["Entreno"] },
  { id: "c", name: "J8 · MAD SKY", at: 200, tags: ["Liga"], rival: "MAD SKY", matchMs: 1000, matchTxt: "J8 · MAD SKY" },
  { id: "d", name: "alineación base", at: 50 },
];
const ids = (xs: Organizable[]) => xs.map((x) => x.id);

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("searching and filtering", () => {
  it("every word, anywhere: name, rival, match or tag, without accents", () => {
    expect(fold("  Atlético   B ")).toBe("atletico b");
    expect(matches(rows[0], "atletico")).toBe(true);
    expect(matches(rows[0], "copa plan")).toBe(true);
    expect(matches(rows[0], "copa liga")).toBe(false);
    expect(ids(organize(rows, { q: "liga", tag: null, sort: "recientes" }))).toEqual(["c"]);
    expect(ids(organize(rows, { q: "j9", tag: null, sort: "recientes" }))).toEqual(["a"]);
    expect(ids(organize(rows, { q: "ALINEACION", tag: null, sort: "recientes" }))).toEqual(["d"]);
  });

  it("a tag filter (case aside) on top of the search", () => {
    expect(ids(organize(rows, { q: "", tag: "entreno", sort: "recientes" }))).toEqual(["b"]);
    expect(ids(organize(rows, { q: "plan", tag: "Liga", sort: "recientes" }))).toEqual([]);
    expect(countTxt(0, 4, true)).toBe("Ningún tablero coincide");
    expect(countTxt(1, 4, true)).toBe("1 de 4 tableros");
    expect(countTxt(4, 4, false)).toBeNull();
  });
});

describe("sorting", () => {
  it("recientes, nombre (A–Z, numbers in order) and partido (latest match first, no match last)", () => {
    expect(ids(organize(rows, { q: "", tag: null, sort: "recientes" }))).toEqual(["a", "c", "b", "d"]);
    expect(ids(organize(rows, { q: "", tag: null, sort: "nombre" }))).toEqual(["d", "b", "c", "a"]);
    expect(ids(organize(rows, { q: "", tag: null, sort: "partido" }))).toEqual(["a", "c", "b", "d"]);
    // never mutates the list it was given
    expect(ids(rows)).toEqual(["a", "b", "c", "d"]);
  });

  it("the sort is remembered on this device (private mode: «recientes»)", () => {
    expect(readSort()).toBe("recientes");
    writeSort("partido");
    expect(readSort()).toBe("partido");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(readSort()).toBe("recientes");
  });
});

describe("«Recientes»", () => {
  it("the boards opened last here, then the latest changed; never the one on screen", () => {
    noteOpened("t1", "d");
    noteOpened("t1", "b");
    noteOpened("t2", "a");
    expect(recentIds("t1")).toEqual(["b", "d"]);
    expect(ids(recentRows(rows, recentIds("t1"), "b"))).toEqual(["d", "a", "c"]);
    // a board deleted since is skipped
    expect(ids(recentRows(rows, ["zz", "c"], null))).toEqual(["c", "a", "b", "d"]);
    // one board: nothing to jump to
    expect(recentRows([rows[0]], [], null)).toEqual([]);
  });

  it("keeps the last few, once each; a storage that throws breaks nothing", () => {
    for (let i = 0; i < RECENT_KEEP + 3; i++) noteOpened("t1", "b" + i);
    noteOpened("t1", "b5");
    const l = recentIds("t1");
    expect(l).toHaveLength(RECENT_KEEP);
    expect(l[0]).toBe("b5");
    expect(new Set(l).size).toBe(l.length);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => noteOpened("t1", "x")).not.toThrow();
  });
});
