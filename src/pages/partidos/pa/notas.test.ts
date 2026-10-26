import { describe, expect, it } from "vitest";
import { actaNotas, myNota, notaBadge, NOTAS_TOP, type NotaOf } from "./notas";

// Partidos' notas: the badge's words, «Tú» on the tile (a player with a nota only) and the acta's «Las notas».
const NOTAS: Record<string, number> = { evans: 6.5, alcides: 8.1, huberoski: 8.34, adrian: 7.1, jordi: 4.9, erik: 5.6 };
const notaOf: NotaOf = (matchId, id) => (matchId === "j1" ? (NOTAS[id] ?? null) : null);
const nm = (id: string) => ({ adrian: "Adrián T.C." })[id] ?? id[0].toUpperCase() + id.slice(1);
const IDS = ["evans", "eguzquiza", "alcides", "jordi", "adrian", "erik", "huberoski", "pellete"];

describe("las notas on Partidos", () => {
  it("the badge: its band, the figure and a name that says the word (never the colour alone)", () => {
    expect(notaBadge(4.9)).toEqual({ k: "s5", t: "4,9", word: "baja", aria: "Nota 4,9, baja" });
    expect(notaBadge(6.45)).toMatchObject({ k: "s65", t: "6,5", aria: "Nota 6,5, normal" });
    expect(notaBadge(null)).toEqual({ k: "no", t: "—", word: "sin nota", aria: "Sin nota" });
  });

  it("«Tú» on the tile: a player with a nota in that match; nothing for a fan or without his nota", () => {
    expect(myNota("j1", "jordi", notaOf)).toMatchObject({ k: "s5", t: "4,9" });
    expect(myNota("j1", null, notaOf)).toBeNull();
    expect(myNota("j1", "pellete", notaOf)).toBeNull();
    expect(myNota("j2", "jordi", notaOf)).toBeNull();
  });

  it("«Las notas»: best first, the best three, and «La tuya» under them when he is not among them", () => {
    const a = actaNotas("j1", [...IDS, "jordi"], notaOf, nm, "jordi");
    expect(a.n).toBe(6);
    expect(a.rows.map((r) => `${r.name} ${r.t}`)).toEqual(["Huberoski 8,3", "Alcides 8,1", "Adrián T.C. 7,1", "Evans 6,5", "Erik 5,6", "Jordi 4,9"]);
    expect(a.top).toHaveLength(NOTAS_TOP);
    expect(a.mine).toMatchObject({ id: "jordi", me: true, t: "4,9", aria: "Nota 4,9, baja" });
    // among the three: marked in place, no «La tuya»
    const b = actaNotas("j1", IDS, notaOf, nm, "alcides");
    expect(b.top.map((r) => r.me)).toEqual([false, true, false]);
    expect(b.mine).toBeNull();
    // a fan: the same list, nobody marked
    const c = actaNotas("j1", IDS, notaOf, nm, null);
    expect(c.top.some((r) => r.me)).toBe(false);
    expect(c.mine).toBeNull();
  });

  it("a tie as shown (one decimal) goes by name; a match without notas has none", () => {
    const tie: NotaOf = (_m, id) => ({ b: 7.44, a: 7.36 })[id] ?? null;
    expect(actaNotas("j1", ["b", "a", "c"], tie, (id) => id, null).rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(actaNotas("j2", IDS, notaOf, nm, "jordi")).toMatchObject({ n: 0, top: [], mine: null });
  });
});
