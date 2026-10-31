import { describe, expect, it, vi } from "vitest";
import type { NuState } from "../numeros/view";
import { crest, nextRival, rivalesView, scopeView, searchView, SEARCH_PLACE, type RivRowIn, type RivalesIn, type ScopeIn, type SearchIn } from "./rivalesView";

const row = (rival: string, o: Partial<RivRowIn> = {}): RivRowIn => ({
  key: rival, rival, ini: "", pj: 0, rec: "Aún sin jugar", gf: 0, gc: 0, letters: [], next: "", nextJ: null, nextLong: "", live: "", on: false, ...o,
});
const dossier = { rival: "Orduña", ini: "OR", rec: "", games: [], scorers: "Nadie todavía", big: "Aún ninguna", first: "Por estrenar", next: "Ninguno en esta temporada", noGames: true };
const R = (all: RivRowIn[], rows = all): RivalesIn => ({ kick: "Rivales · 3 en la liga", title: "Contra Orduña, lo mejor", sub: "", q: "", rows, all, d: dossier });

describe("Rivales: the next rival", () => {
  it("is the nearest jornada still to play", () => {
    const all = [row("A", { nextJ: 9, next: "J9 · 1 dic" }), row("B", { nextJ: 7, next: "J7 · 17 nov", nextLong: "J7 · 17 nov, 18:00" }), row("C")];
    expect(nextRival(all)?.rival).toBe("B");
    const v = rivalesView(R(all), { set: vi.fn() });
    expect(v.next?.k).toBe("El próximo rival");
    expect(v.next?.s).toBe("J7 · 17 nov, 18:00 · Aún sin jugar contra ellos");
  });
  it("is the one we are playing today, with our record", () => {
    const all = [row("A", { nextJ: 5 }), row("B", { nextJ: 6, live: "Hoy, en directo", pj: 2, rec: "1G 0E 1P · 3–3" })];
    const v = rivalesView(R(all), { set: vi.fn() });
    expect(v.next?.rival).toBe("B");
    expect(v.next?.k).toBe("Hoy, en juego");
    expect(v.next?.s).toBe("Hoy, en directo · Nuestro historial: 1G 0E 1P · 3–3");
  });
  it("is none when nothing is left to play, and the search does not move it", () => {
    expect(rivalesView(R([row("A", { pj: 1 })]), { set: vi.fn() }).next).toBeNull();
    const all = [row("A", { nextJ: 4 }), row("B", { nextJ: 8 })];
    expect(rivalesView(R(all, [all[1]]), { set: vi.fn() }).next?.rival).toBe("A");
  });
  it("picks the rival", () => {
    const set = vi.fn();
    const v = rivalesView(R([row("A", { nextJ: 4 })]), { set });
    v.next?.pick();
    v.rows[0].pick();
    v.setQ("ord");
    expect(set.mock.calls).toEqual([[{ rival: "A" }], [{ rival: "A" }], [{ rq: "ord" }]]);
  });
});

describe("Rivales: the list", () => {
  it("shows the escudo when an acta saved one, the initials otherwise", () => {
    expect(crest("Payo Vallecano", "https://x/escudo.png")).toEqual({ logo: "https://x/escudo.png", hasLogo: true, ini: "PV" });
    expect(crest("Payo Vallecano", undefined)).toEqual({ logo: undefined, hasLogo: false, ini: "PV" });
    expect(crest("Payo Vallecano", "", "PA").ini).toBe("PA");
  });
  it("scales the goal bars to the biggest figure of every rival, keeps the last six letters", () => {
    const letters = "GGEPGPG".split("").map((l, i) => ({ key: String(i), l, cls: `vd-form__l--${l.toLowerCase()}` }));
    const all = [row("A", { pj: 7, gf: 10, gc: 5, letters }), row("B", { pj: 1, gf: 2, gc: 1 }), row("C")];
    const v = rivalesView(R(all, [all[1], all[2]]), { set: vi.fn() });
    expect(v.rows.map((r) => [r.rival, r.gfW, r.gcW, r.played])).toEqual([
      ["B", 20, 10, true],
      ["C", 0, 0, false],
    ]);
    expect(rivalesView(R(all), { set: vi.fn() }).rows[0].letters.map((l) => l.l).join("")).toBe("GEPGPG");
    expect(rivalesView(R(all, []), { set: vi.fn() }).empty).toBe(true);
  });
});

// ———— «Qué números ver»
const opt = (t: string, on = false) => ({ t, on, pick: vi.fn() });
const scopeIn = (o: Partial<ScopeIn["scope"]> = {}, upto = 9, edge = 9, off = false): ScopeIn => ({
  scope: {
    seasonOpts: [opt("Temporada 1", true), opt("Todas")],
    seasonI: 0,
    campoOpts: [opt("Todo", true), opt("En casa"), opt("Fuera")],
    campoI: 0,
    matches: [{ ...opt("J1 · Orduña"), key: "m1", s: "3–1" }, { ...opt("J2 · Payo"), key: "m2", s: "0–2" }],
    people: [{ ...opt("Alcides"), key: "p1", n: 9 }, { ...opt("Bruno"), key: "p2", n: 4 }],
    jornadas: [
      { key: "m1", j: 1, letter: "G", label: "J1, Ganamos 3–1 contra Orduña" },
      { key: "m2", j: 2, letter: "P", label: "J2, Perdimos 0–2 en casa de Payo" },
      { key: "m3", j: 3, letter: "E", label: "J3, Empatamos 1–1 contra Lagos" },
    ],
    hasOthers: true,
    players: false,
    count: "9 partidos · 14 jugadores · 9 actas con minutos",
    clear: vi.fn(),
    ...o,
  },
  time: { off, offNote: off ? "Con todas las temporadas, la moviola descansa." : "" },
  upto,
  edge,
});
const replay = (r: boolean) => ({ replay: r }) as Pick<NuState, "replay">;

describe("«Qué números ver»", () => {
  it("offers «Al día» and J1…J(edge−1) with their result, and picking one cuts up to it", () => {
    const set = vi.fn();
    const s = scopeView(scopeIn(), replay(false), { set });
    expect(s.js.map((j) => [j.t, j.cls, j.on])).toEqual([
      ["Al día", "", true],
      ["J1", "is-g", false],
      ["J2", "is-p", false],
      ["J3", "", false],
    ]);
    expect(s.js[2].aria).toBe("Hasta la J2, Perdimos 0–2 en casa de Payo");
    s.js[2].pick();
    s.js[0].pick();
    expect(set.mock.calls).toEqual([[{ upto: 2, replay: false, playing: false }], [{ upto: Number.POSITIVE_INFINITY, replay: false, playing: false }]]);
  });
  it("adds the groups up: each one shows its own choice", () => {
    const s = scopeView(
      scopeIn({ campoOpts: [opt("Todo"), opt("En casa", true), opt("Fuera")], campoI: 1, matches: [{ ...opt("J1 · Orduña", true), key: "m1", s: "3–1" }, { ...opt("J2 · Payo", true), key: "m2", s: "0–2" }], people: [{ ...opt("Alcides", true), key: "p1", n: 9 }, { ...opt("Bruno"), key: "p2", n: 4 }] }, 3),
      replay(false),
      { set: vi.fn() },
    );
    expect(s.js.filter((j) => j.on).map((j) => j.t)).toEqual(["J3"]);
    expect(s.whereI).toBe(1);
    expect(s.matches.filter((m) => m.on).map((m) => m.key)).toEqual(["m1", "m2"]);
    expect(s.people.filter((p) => p.on).map((p) => p.key)).toEqual(["p1"]);
    expect(s.nOn).toBe(4);
  });
  it("marks no jornada while «Repasar» runs, rests the cinta with every season, hides «Todas» without another season", () => {
    expect(scopeView(scopeIn({}, 2), replay(true), { set: vi.fn() }).js.some((j) => j.on)).toBe(false);
    const all = scopeView(scopeIn({ seasonI: 1 }, 9, 9, true), replay(false), { set: vi.fn() });
    expect(all.jOff).toBe(true);
    expect(all.seasonI).toBe(1);
    expect(all.nOn).toBe(1);
    const one = scopeView(scopeIn({ hasOthers: false }), replay(false), { set: vi.fn() });
    expect(one.season.map((o) => o.t)).toEqual(["Temporada 1"]);
    expect(one.seasonI).toBe(0);
  });
});

// ———— «Busca o pregunta»
const go = () => vi.fn();
const searchIn: SearchIn = {
  res: [
    { key: "p-a", kind: "player", name: "Alcides", n: 9, detail: "Su ficha, sus rachas y sus minutos", go: go() },
    { key: "r-o", kind: "rival", name: "Orduña", n: "", detail: "1G 0E 0P · 3–1", go: go() },
    { key: "q-x", kind: "ask", name: "¿Quién marca más?", n: "", detail: "", go: go() },
    { key: "c-1", kind: "stat", name: "Pases completados", n: "", detail: "El balón · su ficha", go: go() },
    { key: "m-g", kind: "rank", name: "Goles", n: "", detail: "El ranking · Ataque", go: go() },
    { key: "s-c", kind: "screen", name: "El campo", n: "", detail: "", go: go() },
  ],
  all: [
    { key: "a1", t: "¿Quién marca más?", place: "jugadores", go: go() },
    { key: "a2", t: "¿Cómo vamos en la liga?", place: "temporada", go: go() },
    { key: "a3", t: "¿Dónde juega cada uno?", place: "campo", go: go() },
    { key: "a4", t: "¿Qué racha llevamos?", place: "records", go: go() },
    { key: "a5", t: "¿Contra quién jugamos ahora?", place: "rivales", go: go() },
    { key: "a6", t: "¿Cuándo marcamos y cuándo nos marcan?", place: "juego", go: go() },
  ],
};

describe("«Busca o pregunta»", () => {
  it("with nothing typed, every question grouped by the place that answers it", () => {
    const s = searchView(searchIn, "");
    expect(s.groups.map((g) => [g.t, g.items.map((i) => i.key)])).toEqual([
      ["Preguntas sobre la temporada", ["a2", "a4"]],
      ["Preguntas sobre los jugadores", ["a1", "a3"]],
      ["Preguntas sobre el juego", ["a6"]],
      ["Preguntas sobre los rivales", ["a5"]],
    ]);
    expect(SEARCH_PLACE.campo).toBe("jugadores");
    expect(SEARCH_PLACE.records).toBe("temporada");
  });
  it("with words, jugadores (with the shirt), rivales, estadísticas and rankings first, then the matching questions", () => {
    const s = searchView(searchIn, "MARCÁ");
    expect(s.groups.map((g) => g.t)).toEqual(["Jugadores", "Rivales", "Estadísticas", "Rankings", "Preguntas sobre los jugadores", "Preguntas sobre el juego"]);
    expect(s.groups[0].items[0]).toMatchObject({ t: "Alcides", s: "Su ficha, sus rachas y sus minutos", n: 9, shirt: true, ic: null });
    expect(s.groups[1].items[0]).toMatchObject({ t: "Orduña", ic: "shield", shirt: false });
    expect(s.groups[2].items[0]).toMatchObject({ t: "Pases completados", ic: "book" });
    s.groups[1].items[0].go();
    expect(searchIn.res[1].go).toHaveBeenCalled();
  });
  it("says so when nothing matches", () => {
    expect(searchView({ res: [], all: searchIn.all }, "zzz").none).toBe(true);
  });
});
