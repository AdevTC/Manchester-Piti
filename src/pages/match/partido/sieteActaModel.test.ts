import { describe, expect, it } from "vitest";
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";
import type { MatchNote } from "../../../lib/rating/season";
import { lineupOf, playsOf, timelineOf } from "./model";
import type { Person, Viewer } from "./ctx";
import { actaPlayers, benchRows, cambiosRows, cambiosSub, fichaOf, headOf, lineText, rankRows, seasonLineOf, swarmOf, tokensAt, type ActaPlayer } from "./sieteActaModel";

// A published acta with a lineup from the pizarra: a change at 12:17, two at the break with a recolocación, and a
// «Cambio de sitio» alone in the second half.
const names: Record<string, string> = { k: "Kiko", l: "Luis", c: "Carlos", r: "Raúl", m: "Manu", d: "Dani", f: "Fer", b: "Brais", h: "Hugo", s: "Sergio" };
const person = (id: string, i: number): Person => ({ id, name: names[id], short: names[id].toUpperCase(), num: String(i + 1), first: names[id], last: "", pos: "MED" });
const people = new Map(Object.keys(names).map((id, i) => [id, person(id, i)]));
const ev = (id: string, type: string, s: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, minute: Math.floor(s / 60), elapsedSeconds: s, ...more }) as MatchEvent;
const SLOTS = [
  { playerId: "k", code: "POR", x: 50, y: 92 },
  { playerId: "l", code: "LI", x: 18, y: 70 },
  { playerId: "c", code: "DFC", x: 50, y: 74 },
  { playerId: "r", code: "LD", x: 82, y: 70 },
  { playerId: "m", code: "MC", x: 50, y: 48 },
  { playerId: "d", code: "MC", x: 30, y: 46 },
  { playerId: "f", code: "DC", x: 50, y: 20 },
];
const M: ClubMatch = {
  id: "m1",
  rival: "Orduña fc",
  date: Date.UTC(2026, 9, 18, 15),
  duration: 50,
  status: "finished",
  starters: SLOTS.map((s) => s.playerId),
  bench: ["b", "h", "s"],
  notCalled: [],
  lineup: { system: "2-3-1", slots: SLOTS, boardId: "x", setBy: "u", setAt: 1 },
  events: [
    ev("1", "goal", 300, { playerId: "f" }),
    ev("2", "substitution", 737, { playerId: "d", inPlayerId: "b" }),
    ev("3", "opponent_goal", 1200),
    ev("4", "substitution", 1500, { playerId: "f", inPlayerId: "h", period: 1 }),
    ev("5", "position_swap", 1500, { playerId: "h", inPlayerId: "m", period: 1 }),
    ev("6", "position_swap", 2100, { playerId: "l", inPlayerId: "r", period: 2 }),
    ev("7", "goal", 2400, { playerId: "m", assistPlayerId: "h", period: 2 }),
  ],
} as ClubMatch;
const nameOf = (id: string) => names[id] ?? id;
const plays = playsOf(M, nameOf, "Orduña fc");
const lineup = lineupOf(M);
const tl = timelineOf(M, lineup, plays, 50, 50, nameOf);
const viewer: Viewer = { member: true, admin: false, mesa: false, anotador: false, playerId: "h", uid: "u", name: "Hugo" };
const NOTAS: Record<string, number> = { k: 6.5, l: 6.1, c: 7.2, r: 6.6, m: 8.4, d: 5.6, f: 7.9, b: 6.3, h: 7.0 };
const P = actaPlayers({ lineup, stints: tl.stints, posSegs: tl.posSegs, ledger: null, people, viewer, captain: "c", mvpIds: ["m"], notaOf: (id) => NOTAS[id] ?? null, values: null, duration: 50 });
const by = (id: string) => P.find((p) => p.id === id) as ActaPlayer;

describe("the pitch walked from the events", () => {
  it("a change takes the spot of the one he replaces; at the break the recolocación moves him on", () => {
    expect(tl.onPitchAt(12).find((s) => s.code === "MC" && s.x === 30)?.id).toBe("d");
    expect(tl.onPitchAt(13).find((s) => s.code === "MC" && s.x === 30)?.id).toBe("b");
    // (25:00: Hugo comes on for Fer and swaps with Manu, in the 25′ already)
    const at25 = tl.onPitchAt(25);
    expect(at25.find((s) => s.code === "DC")?.id).toBe("m");
    expect(at25.find((s) => s.code === "MC" && s.x === 50)?.id).toBe("h");
  });
  it("each one's spots stretch by stretch", () => {
    expect(tl.posSegs.m).toEqual([{ from: 0, to: 25, code: "MC" }, { from: 25, to: 50, code: "DC" }]);
    expect(tl.posSegs.h).toEqual([{ from: 25, to: 50, code: "MC" }]);
    expect(tl.posSegs.l).toEqual([{ from: 0, to: 35, code: "LI" }, { from: 35, to: 50, code: "LD" }]);
  });
  it("the changes grouped by the minute shown, with the score and who moved where", () => {
    expect(tl.groups.map((g) => [g.m, g.f, g.second])).toEqual([[13, 13, false], [26, 25, true], [36, 35, true]]);
    expect(tl.groups[0].sc).toEqual({ us: 1, them: 0 });
    expect(tl.groups[1]).toMatchObject({ subs: [{ inId: "h", outId: "f" }], moves: [{ id: "h", from: "DC", to: "MC" }, { id: "m", from: "MC", to: "DC" }], sc: { us: 1, them: 1 } });
    expect(tl.groups[2]).toMatchObject({ subs: [], moves: [{ id: "l", from: "LI", to: "LD" }, { id: "r", from: "LD", to: "LI" }] });
  });
});

describe("the players and the pitch", () => {
  it("the seven in slot order, then the rest as they came on", () => {
    expect(P.map((p) => p.id)).toEqual(["k", "l", "c", "r", "m", "d", "f", "b", "h"]);
    expect(by("m")).toMatchObject({ notaTxt: "8,4", band: "s8", word: "Muy buena", mvp: true, start: true, startCode: "MC" });
    expect(by("h")).toMatchObject({ me: true, start: false, startCode: null });
    expect(by("c").cap).toBe(true);
  });
  it("off the pitch a token waits by the touchline on the side of his spot", () => {
    const t = tokensAt(P, tl.onPitchAt, 0, 50, plays, true, true);
    const b = t.find((x) => x.id === "b")!;
    expect(b.on).toBe(false);
    expect(b.left).toBe(-16);
    const m = t.find((x) => x.id === "m")!;
    expect(m.on).toBe(true);
    // at rest the starting seven carry the whole match's marks
    expect(m.marks.map((k) => k.text)).toEqual(["41′"]);
    expect(m.label).toContain("Nota 8,4, muy buena");
  });
  it("the bench: who came on, with his nota and the night's marks", () => {
    const rows = benchRows(P, plays, 50);
    expect(rows.map((r) => r.id)).toEqual(["b", "h"]);
    expect(rows[1].marks.map((k) => k.k)).toEqual(["asis"]);
  });
  it("the line a nota is compared with", () => {
    expect(lineText({ DEF: 1 })).toBe("con los defensas");
    expect(lineText({ DEF: 0.5, MED: 0.5 })).toBe("con defensas y medios, según sus minutos en cada sitio");
    expect(lineText({})).toBe("con todo el equipo");
  });
});

describe("los cambios", () => {
  it("the break between the halves; the moviola's place when it is held back", () => {
    const rows = cambiosRows({ groups: tl.groups, P, follow: 20, filter: null, sel: null, halfScore: "1–1", duration: 50, published: true });
    expect(rows.map((r) => (r.k === "group" ? r.m : r.k))).toEqual([13, "now", "half", 26, 36]);
    const g26 = rows.find((r) => r.k === "group" && r.m === 26);
    expect(g26).toMatchObject({ later: true, sw: { title: "Y se recolocan", text: "Hugo pasa a mediocentro · Manu, a punta" } });
    const g36 = rows.find((r) => r.k === "group" && r.m === 36);
    expect(g36).toMatchObject({ sw: { title: "Recolocación" } });
  });
  it("only one player's, and the words over the list", () => {
    const rows = cambiosRows({ groups: tl.groups, P, follow: null, filter: "l", sel: "l", halfScore: "1–1", duration: 50, published: true });
    expect(rows.filter((r) => r.k === "group").map((r) => (r.k === "group" ? r.m : 0))).toEqual([36]);
    expect(cambiosSub(tl.groups, null, nameOf)).toBe("2 cambios en 2 momentos y 2 recolocaciones. Toca uno y el campo vuelve a ese minuto.");
    expect(cambiosSub(tl.groups, "l", nameOf)).toBe("Los de Luis: 1 momento de 3.");
  });
});

describe("las notas", () => {
  it("best first, the ones without a nota last", () => {
    const rows = rankRows([...P, { ...by("b"), id: "s", name: "Sergio", nota: null, notaTxt: "—", band: "no", minutes: 4 }], 50);
    expect(rows[0].id).toBe("m");
    expect(rows.at(-1)).toMatchObject({ id: "s", sub: "Desde el banquillo · 4′ · sin nota" });
  });
  it("the swarm moves a dot that would touch another to the next row", () => {
    const s = swarmOf(P, 6);
    expect(s.dots).toHaveLength(9);
    const k = s.dots.find((d) => d.id === "k")!;
    const r = s.dots.find((d) => d.id === "r")!;
    expect(k.row).not.toBe(r.row);
    expect(s.ticks.map((t) => t.t)).toEqual(["5", "6", "7", "8", "9"]);
  });
});

describe("la ficha", () => {
  it("where he played: the start, the recolocaciones, the changes he was in", () => {
    const f = fichaOf({ p: by("m"), groups: tl.groups, values: null, season: null, duration: 50, published: true, positionsPlayed: null, provisionalMinutes: 150 });
    expect(f.kicker).toBe("Titular · empezó de mediocentro");
    expect(f.where).toEqual([{ name: "Mediocentro", min: 25 }, { name: "Punta", min: 25 }]);
    expect(f.whereNote).toBe("Empezó de mediocentro. En el 26′ pasó a punta.");
    expect(f.chLink).toBe("Ver sus cambios (1)");
    const h = fichaOf({ p: by("h"), groups: tl.groups, values: null, season: null, duration: 50, published: true, positionsPlayed: null, provisionalMinutes: 150 });
    expect(h.whereNote).toBe("Salió desde el banquillo. En el 26′ entró y se puso de mediocentro.");
    const l = fichaOf({ p: by("l"), groups: tl.groups, values: null, season: null, duration: 50, published: true, positionsPlayed: null, provisionalMinutes: 150 });
    expect(l.whereNote).toBe("Empezó de lateral izquierdo. En el 36′ pasó a lateral derecho.");
  });
  it("his season with this match: GLOBAL before and after, the jornadas around it", () => {
    const note = (matchId: string, nota: number): MatchNote => ({ matchId, date: 0, rival: "R", nota, minutes: 50, weight: 1, narrated: true });
    const games = ["g1", "g2", "m1", "g4", "g5", "g6"].map((id, i) => ({ id, date: i, rival: `R${i + 1}`, jornada: i + 1, finished: i <= 2, playedBy: () => true }));
    const s = seasonLineOf("m", "m1", [note("g1", 6.5), note("g2", 7.5), note("m1", 8.4)], games);
    expect(s.glBefore).toBe(Math.round((10 * (6.5 + 7.5 + 3 * 6.5)) / 5));
    expect(s.gl).toBe(Math.round((10 * (6.5 + 7.5 + 8.4 + 3 * 6.5)) / 6));
    expect(s.jj.map((x) => x.id)).toEqual(["g1", "g2", "m1", "g4", "g5"]);
    const f = fichaOf({ p: by("m"), groups: tl.groups, values: null, season: s, duration: 50, published: true, positionsPlayed: null, provisionalMinutes: 150 });
    expect(f.seasNote).toBe(`Con este partido, de ${s.glBefore} a ${s.gl}.`);
    expect(f.jj.map((x) => x.nota)).toEqual(["6,5", "7,5", "8,4", "·", "·"]);
  });
});

describe("the head", () => {
  const base = { minute: 0, verb: "Ganamos", dash: "2–1", mvpNames: ["Manu"], played: 9, groups: tl.groups, scoreAt: "1–0" };
  it("at rest, held by the moviola, and in each view", () => {
    expect(headOf({ ...base, view: "quien", rest: "start" })).toEqual({ h: "El siete inicial", sub: "Ganamos 2–1 · MVP: Manu" });
    expect(headOf({ ...base, view: "quien", rest: "end" })).toEqual({ h: "Cómo acabó", sub: "Acabó 2–1 · 2 cambios en 2 momentos y 2 recolocaciones" });
    expect(headOf({ ...base, view: "quien", rest: null, minute: 20 })).toEqual({ h: "En el minuto 20", sub: "Íbamos 1–0 · 1 cambio hasta aquí" });
    expect(headOf({ ...base, view: "notas", rest: "start" }).h).toBe("Las notas");
  });
});
