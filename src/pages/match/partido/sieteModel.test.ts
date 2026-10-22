import { describe, expect, it } from "vitest";
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";
import { lineupOf, playsOf, resultWords, scoreAt, timelineOf, type Fase } from "./model";
import type { Person, Viewer } from "./ctx";
import { crossingOf, outOf, placeTags, seasonCountsOf, sieteView, type SieteInput, type TagItem } from "./sieteModel";

const names: Record<string, string> = { a: "Alcides", j: "Jordi", p: "Pellete", e: "Evans", f: "Fer", i: "Illescas", k: "Kevin", g: "Eguzquiza", b: "Brawan", x: "Andia" };
const nums: Record<string, string> = { a: "7", j: "28", p: "20", e: "1", f: "12", i: "4", k: "11", g: "22", b: "33", x: "19" };
const nameOf = (id: string) => names[id] ?? id;
const people = new Map<string, Person>(Object.keys(names).map((id) => [id, { id, name: names[id], short: names[id].toUpperCase(), num: nums[id], first: names[id], last: "", pos: id === "e" ? "POR" : "DEF" }]));
const ev = (id: string, type: string, minute: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, minute, ...more }) as MatchEvent;

const J1: ClubMatch = {
  id: "j1",
  seasonId: "s1",
  rival: "Orduña fc",
  date: Date.UTC(2026, 9, 18, 17, 0),
  duration: 50,
  status: "finished",
  starters: ["e", "f", "i", "j", "a", "g", "p"],
  bench: ["k", "b"],
  notCalled: ["x"],
  events: [
    ev("1", "opponent_goal", 2),
    ev("5", "substitution", 10, { playerId: "p", inPlayerId: "k" }),
    ev("7", "substitution", 18, { playerId: "f", inPlayerId: "b" }),
    ev("8", "substitution", 18, { playerId: "g", inPlayerId: "p" }),
    ev("9", "yellow_card", 28, { playerId: "j" }),
    ev("12", "goal", 43, { playerId: "a", assistPlayerId: "j" }),
  ],
};
const plays = playsOf(J1, nameOf, "Orduña fc");
const lineup = lineupOf(J1);
const tl = timelineOf(J1, lineup, plays, 50, 50, nameOf);
const fan: Viewer = { member: false, admin: false, mesa: false, anotador: false, playerId: null, uid: null, name: "" };
const jordi: Viewer = { ...fan, member: true, playerId: "j", name: "Jordi" };

function input(over: Partial<SieteInput> & { fase: Fase }): SieteInput {
  const f = over.fase;
  const played = ["primera", "descanso", "segunda", "final", "acta", "despues"].includes(f);
  const live = ["primera", "descanso", "segunda"].includes(f);
  return {
    minute: played ? 50 : 0,
    edge: played ? 50 : 0,
    duration: 50,
    pre: f === "antes" || f === "pitido",
    live,
    played,
    plays,
    tl,
    lineup,
    result: resultWords(scoreAt(plays, 50), scoreAt(plays, 25)),
    captain: "j",
    people,
    viewer: fan,
    mvpIds: [],
    sel: null,
    view: "quien",
    fresh: [],
    walking: new Map(),
    ledger: null,
    partial: false,
    publishedAt: null,
    out: [],
    seasonOf: () => ({ partidos: 0, minutos: 0, goles: 0, asistencias: 0 }),
    seasonName: "Temporada 1",
    jornada: 1,
    voteLeft: "",
    ...over,
  };
}

describe("placeTags", () => {
  const it0: TagItem = { x: 50, y: 50, tags: [{ text: "43′", icon: true }], nameLen: 7, me: false, cap: false };
  it("puts a lone column on the roomier side, level with the shirt", () => {
    expect(placeTags([it0])).toEqual([{ tl: false, dy: 0 }]);
    expect(placeTags([{ ...it0, x: 85 }])).toEqual([{ tl: true, dy: 0 }]);
    expect(placeTags([{ ...it0, x: 30 }])[0].tl).toBe(true);
  });
  it("moves a column off a neighbour's shirt", () => {
    const [a] = placeTags([it0, { ...it0, x: 62, tags: [] }]);
    expect(a.tl || a.dy !== 0).toBe(true);
  });
  it("leaves a shirt without marks alone", () => {
    expect(placeTags([{ ...it0, tags: [] }])).toEqual([{ tl: false, dy: 0 }]);
  });
});

describe("crossingOf", () => {
  it("walks the new man in on the spot of the one he replaces", () => {
    const c = crossingOf(tl, plays, 9, 10);
    expect(c.walks).toEqual([{ inId: "k", outId: "p" }]);
  });
  it("pops the marks the playhead passes going forward, not back, not on a jump", () => {
    expect(crossingOf(tl, plays, 42, 44).fresh).toEqual([43]);
    expect(crossingOf(tl, plays, 44, 42).fresh).toEqual([]);
    expect(crossingOf(tl, plays, 20, 44).fresh).toEqual([]);
    expect(crossingOf(tl, plays, 0, 30).walks).toEqual([]);
  });
});

describe("outOf", () => {
  const base = { squad: ["e", "x", "b", "i", "k"], called: new Set(["e", "b"]), notCalled: ["x"], mesa: new Set<string>(), absentOf: () => null, meAtMesa: null };
  it("gives each one outside the convocatoria his real reason", () => {
    const out = outOf({
      ...base,
      mesa: new Set(["k"]),
      answers: [
        { uid: "u1", response: "no", playerId: "i" },
        { uid: "u2", response: "yes", playerId: "x" },
      ],
    });
    expect(out).toEqual([
      { id: "x", why: "No convocado" },
      { id: "i", why: "No puede" },
      { id: "k", why: "En la mesa" },
    ]);
  });
  it("names an absence and the viewer at the mesa", () => {
    const out = outOf({ ...base, squad: ["i", "k"], mesa: new Set(["k"]), meAtMesa: "k", answers: [{ uid: "u1", response: "no", playerId: "i" }], absentOf: () => "Ausente hasta 27 oct" });
    expect(out).toEqual([
      { id: "i", why: "Ausente hasta 27 oct" },
      { id: "k", why: "En la mesa: tú" },
    ]);
  });
  it("tells who has not answered", () => {
    expect(outOf({ ...base, squad: ["i"], answers: [] })).toEqual([{ id: "i", why: "Sin responder" }]);
  });
});

describe("seasonCountsOf", () => {
  it("adds the season's other published actas, never this one nor another season's", () => {
    const j2: ClubMatch = { ...J1, id: "j2", events: [ev("g", "goal", 5, { playerId: "a" })] };
    const other: ClubMatch = { ...j2, id: "o", seasonId: "s0" };
    const pending: ClubMatch = { ...j2, id: "j3", status: "scheduled" };
    const s = seasonCountsOf([J1, j2, other, pending], J1, "a");
    expect(s).toMatchObject({ partidos: 1, goles: 1 });
  });
});

describe("sieteView", () => {
  it("before the whistle: the seven, the bench with its convocatoria, the door for a fan", () => {
    const v = sieteView(input({ fase: "antes", publishedAt: "el sábado a las 21:40" }));
    expect(v.h).toBe("El siete, en 3-2-1");
    expect(v.sub).toBe("Publicado el sábado a las 21:40");
    expect(v.spots).toHaveLength(7);
    expect(v.bench.map((b) => [b.name, b.status])).toEqual([
      ["Kevin", "Defensa"],
      ["Brawan", "Defensa"],
    ]);
    expect(v.convo).toBe("Convocados 9: el siete y, en el banquillo, Kevin y Brawan.");
    expect(v.showDoor).toBe(true);
    expect(v.showOut).toBe(false);
    expect(v.card?.kicker).toBe("El capitán");
    expect(v.card?.seasonNote).toBe("Temporada 1: la J1 es su primer partido.");
    expect(v.spots.find((s) => s.id === "j")?.captain).toBe(true);
  });
  it("no captain known: no «C», and the panel still shows someone", () => {
    const v = sieteView(input({ fase: "antes", captain: null }));
    expect(v.spots.some((s) => s.captain)).toBe(false);
    expect(v.card).not.toBeNull();
  });
  it("without a seven: the empty rings", () => {
    const v = sieteView(input({ fase: "antes", lineup: { ...lineup, slots: [], bench: [] } }));
    expect(v.ghost).toBe(true);
    expect(v.sub).toBe("Todavía sin publicar");
    expect(v.rings).toHaveLength(7);
    expect(v.card).toBeNull();
  });
  it("live: who is on now, who just went off, the stints up to the minute", () => {
    const v = sieteView(input({ fase: "segunda", minute: 19, edge: 19, viewer: jordi }));
    expect(v.h).toBe("Ahora en el campo");
    expect(v.sub).toBe("Minuto 19 · 3 cambios hasta aquí");
    const f = v.bench.find((b) => b.id === "f");
    expect(f?.status).toBe("Acaba de salir · 18′ jugados");
    expect(v.spots.find((s) => s.id === "j")?.me).toBe(true);
    expect(v.card?.kicker).toBe("Tú, en esta noche");
    expect(v.card?.go).toBe("Ver mi ficha");
    expect(v.card?.href).toBe("/jugadores/j");
    expect(v.benchT).toBe("Fuera del campo ahora");
  });
  it("dragged back once played: the minute's pitch and «Quién hizo qué» at that minute", () => {
    const v = sieteView(input({ fase: "despues", minute: 30 }));
    expect(v.sub).toBe("En el minuto 30 · 3 cambios hasta aquí");
    expect(v.hasSeg).toBe(true);
    expect(v.stints.every((s) => s.headOn)).toBe(true);
  });
  it("after: the MVP marked, the stints in full, «Los minutos» on request", () => {
    const v = sieteView(input({ fase: "despues", mvpIds: ["a"], view: "min" }));
    expect(v.view).toBe("min");
    expect(v.h).toBe("Los minutos de cada uno");
    expect(v.card?.kicker).toBe("El MVP");
    expect(v.card?.counts?.map((c) => c.v)).toEqual(["1", "50′", "1", "0"]);
    expect(v.stints.find((s) => s.id === "e")?.sub).toBe("Todo el partido");
    expect(v.stints.find((s) => s.id === "p")?.sub).toBe("Titular · 2 tramos: 0–10, 18–50");
    expect(v.unused).toBe("");
  });
  it("a tag of the minute pops", () => {
    const v = sieteView(input({ fase: "despues", minute: 44, fresh: [43] }));
    expect(v.spots.find((s) => s.id === "a")?.tags[0].cls).toContain("is-new");
  });
  it("aplazado: the convocatoria as it stood, dimmed; pendiente: no minutes yet", () => {
    expect(sieteView(input({ fase: "aplazado" })).pitchCls).toBe("is-dim");
    const p = sieteView(input({ fase: "pendiente" }));
    expect(p.sub).toBe("Sin acta: los minutos llegan con ella");
    expect(p.card?.seasonNote).toBe("Sin acta, la J1 todavía no le cuenta minutos.");
  });
});
