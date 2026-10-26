import { describe, expect, it } from "vitest";
import { EVENT_LABELS, type EventType, type MatchEvent } from "../../functions/src/matchEngine";
import { MESA_TYPES } from "../../functions/src/liveRules";
import { EVENT_FILTERS, EVENT_TYPES, eventMeta, eventMetaOf, eventSentence, isMesaType, isPendingDup, minuteText, rivalCode, rivalShortName, settled } from "./eventMeta";
import { lastEvent, scoreOf, scorersLine } from "./partidos";

const nameOf = (id: string) => ({ m: "Mario", p: "Pablo", h: "Hugo", a: "Álex" })[id] ?? id;
const ctx = { nameOf, rival: "Atlético Demo" };
const ev = (type: EventType, more: Partial<MatchEvent> = {}): MatchEvent => ({ id: `${type}-${more.minute ?? 0}`, type, minute: 5, ...more });

describe("eventMeta: every EventType", () => {
  const all = Object.keys(EVENT_LABELS) as EventType[];
  it("covers every type EVENT_LABELS names, la mesa's new ones included", () => {
    expect(new Set(EVENT_TYPES)).toEqual(new Set(all));
    for (const t of ["opponent_foul", "opponent_woodwork", "opponent_offside", "opponent_yellow", "opponent_red", "opponent_penalty_missed", "injury"] as const) expect(EVENT_TYPES).toContain(t);
  });
  it.each(all)("%s has a label, a side, a group, an icon or a card, a strap word and a sentence", (type) => {
    const m = eventMeta(type);
    expect(m.label).toBe(EVENT_LABELS[type]);
    expect(["us", "them"]).toContain(m.side);
    expect(["goles", "ocasiones", "faltas", "cambios", "otros"]).toContain(m.group);
    expect(m.glyph).toBeTruthy();
    expect(m.tag).toMatch(/^[A-ZÁÉÍÓÚÑ ]+$/);
    const said = eventSentence(ev(type, { playerId: "m", inPlayerId: type === "substitution" || type === "position_swap" ? "h" : undefined }), ctx);
    expect(said.title.length).toBeGreaterThan(3);
    expect(said.title).not.toMatch(/undefined|null/);
  });
  it("every live type (MESA_TYPES) is a mesa type; the narrated actions aren't", () => {
    for (const t of MESA_TYPES) expect(isMesaType(t)).toBe(true);
    expect(isMesaType("pass")).toBe(false);
    expect(isMesaType("assist")).toBe(false);
  });
  it("sides, groups and goals", () => {
    expect(eventMeta("opponent_foul")).toMatchObject({ side: "them", group: "faltas", glyph: "faltaH" });
    expect(eventMeta("opponent_woodwork")).toMatchObject({ side: "them", group: "ocasiones", glyph: "palo" });
    expect(eventMeta("opponent_offside")).toMatchObject({ side: "them", group: "otros", tag: "FUERA DE JUEGO" });
    expect(eventMeta("opponent_yellow")).toMatchObject({ side: "them", group: "faltas", card: "a" });
    expect(eventMeta("opponent_red")).toMatchObject({ side: "them", group: "faltas", card: "r" });
    expect(eventMeta("opponent_penalty_missed")).toMatchObject({ side: "them", group: "ocasiones" });
    expect(eventMeta("injury")).toMatchObject({ side: "us", group: "otros", glyph: "tocado" });
    expect(eventMeta("save")).toMatchObject({ side: "us", group: "ocasiones", glyph: "parada" });
    expect(eventMeta("substitution").group).toBe("cambios");
    expect(eventMeta("goal").goal).toBe("for");
    expect(eventMeta("opponent_own_goal").goal).toBe("for");
    expect(eventMeta("own_goal").goal).toBe("against");
    expect(eventMeta("opponent_goal").goal).toBe("against");
    expect(eventMeta("woodwork").goal).toBeNull();
    // an unknown type: a plain «Jugada», never a crash
    expect(eventMeta("nueva_cosa")).toMatchObject({ label: "Jugada", group: "otros" });
    // a narrated action of the rival is theirs
    expect(eventMetaOf({ type: "pass", team: "opponent" }).side).toBe("them");
  });
  it("the filters: Todo · Goles · Ocasiones y palos · Faltas y tarjetas · Cambios", () => {
    expect(EVENT_FILTERS.map((f) => f.label)).toEqual(["Todo", "Goles", "Ocasiones y palos", "Faltas y tarjetas", "Cambios"]);
  });
});

describe("eventSentence", () => {
  const say = (type: EventType, more: Partial<MatchEvent> = {}) => eventSentence(ev(type, more), ctx);
  it("ours by name, theirs by the rival", () => {
    expect(say("goal", { playerId: "m", assistPlayerId: "p" })).toEqual({ title: "Gol de Mario", sub: "Asistencia de Pablo", people: ["m", "p"] });
    expect(say("goal").title).toBe("Gol del Piti");
    expect(say("goal").sub).toBe("Goleador por confirmar");
    expect(say("goal_penalty", { playerId: "m" }).title).toBe("Gol de Mario, de penalti");
    expect(say("opponent_goal").title).toBe("Gol de Atlético Demo");
    expect(say("opponent_foul").title).toBe("Falta de Atlético");
    expect(say("opponent_woodwork").title).toBe("Al palo, Atlético");
    expect(say("opponent_offside").title).toBe("Fuera de juego de Atlético");
    expect(say("opponent_yellow").title).toBe("Amarilla a Atlético");
    expect(say("opponent_red").title).toBe("Roja a Atlético");
    expect(say("opponent_penalty_missed").title).toBe("Penalti fallado por Atlético");
    expect(say("injury", { playerId: "m" })).toMatchObject({ title: "Mario, tocado", sub: "Sigue en el campo" });
    expect(say("foul", { playerId: "m" }).title).toBe("Falta de Mario");
    expect(say("foul_received", { playerId: "m" }).title).toBe("Le hacen falta a Mario");
    expect(say("save", { playerId: "a", note: "Paradón" })).toMatchObject({ title: "Parada de Álex", sub: "Paradón" });
    expect(say("woodwork", { playerId: "m" }).title).toBe("Al palo, Mario");
    expect(say("substitution", { playerId: "p", inPlayerId: "h" }).title).toBe("Entra Hugo, sale Pablo");
    // a «Cambio de sitio»: under «Cambios» to read, but no one comes on or goes off
    expect(eventMeta("position_swap")).toMatchObject({ side: "us", group: "cambios", glyph: "cambio", tag: "CAMBIO DE SITIO", goal: null, card: null });
    expect(say("position_swap", { playerId: "p", inPlayerId: "h" })).toMatchObject({ title: "Pablo y Hugo se cambian el sitio", people: ["p", "h"] });
    expect(say("double_yellow", { playerId: "m" })).toMatchObject({ title: "Roja a Mario", sub: "Segunda amarilla" });
    expect(say("penalty_received", { playerId: "m" })).toMatchObject({ title: "Penalti a favor", sub: "Sobre Mario" });
    expect(say("penalty_committed", { playerId: "m" })).toMatchObject({ title: "Penalti para Atlético", sub: "Lo comete Mario" });
    expect(say("opponent_corner").title).toBe("Córner para Atlético");
  });
  it("the rival's short name and code", () => {
    expect(rivalShortName("Atlético Demo")).toBe("Atlético");
    expect(rivalShortName("CD Ejemplo")).toBe("CD Ejemplo");
    expect(rivalCode("Atlético Demo")).toBe("ATL");
    expect(rivalCode("CD Ejemplo")).toBe("EJE");
    expect(rivalCode("Rayo Pruebas", "ray")).toBe("RAY");
  });
  it("minuteText", () => {
    expect(minuteText({ elapsedSeconds: 7 })).toBe("1′");
    expect(minuteText({})).toBe("");
  });
});

describe("pending duplicates", () => {
  const goal = ev("goal", { id: "g1", playerId: "m", minute: 3 });
  const dup = ev("goal", { id: "g2", playerId: "m", minute: 3, dupOf: "g1" });
  const two = ev("goal", { id: "g3", playerId: "m", minute: 4, dupOf: "g1", dupOk: true });
  it("a dup without «Son dos» is pending; with it, it stands", () => {
    expect(isPendingDup(dup)).toBe(true);
    expect(isPendingDup(two)).toBe(false);
    expect(isPendingDup(goal)).toBe(false);
    expect(settled([goal, dup, two]).map((e) => e.id)).toEqual(["g1", "g3"]);
  });
  it("the live score counts a pending duplicate once (the server does the same)", () => {
    expect(scoreOf({ status: "scheduled", events: [goal, dup] })).toEqual({ gf: 1, ga: 0 });
    expect(scoreOf({ status: "scheduled", events: [goal, dup, two] })).toEqual({ gf: 2, ga: 0 });
    const theirs = ev("opponent_goal", { id: "o1" });
    expect(scoreOf({ status: "scheduled", events: [theirs, { ...theirs, id: "o2", dupOf: "o1" }] })).toEqual({ gf: 0, ga: 1 });
    // a published acta keeps its stored score
    expect(scoreOf({ status: "finished", goalsFor: 3, goalsAgainst: 0, events: [goal, dup] })).toEqual({ gf: 3, ga: 0 });
  });
  it("scorers and the last play skip it too", () => {
    expect(scorersLine([goal, dup], nameOf)).toBe("Mario");
    expect(lastEvent([goal, { ...dup, minute: 9 }], nameOf, "Atlético Demo")).toMatchObject({ id: "g1", title: "Gol de Mario", tone: "gold", tag: "GOL" });
  });
  it("the last play reads new types in words, by time of play, never a narrated action", () => {
    const events = [ev("goal", { id: "a", playerId: "m", elapsedSeconds: 60 }), ev("opponent_foul", { id: "b", elapsedSeconds: 120 }), ev("pass", { id: "c", elapsedSeconds: 200, playerId: "m" })];
    expect(lastEvent(events, nameOf, "Atlético Demo")).toMatchObject({ id: "b", title: "Falta de Atlético", tone: "coral", tag: "FALTA", minute: 3 });
  });
});
