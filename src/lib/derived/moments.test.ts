import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../clubData";
import { clockMomentsOf, FRESH_MOMENT_SECONDS, isFreshMoment, momentOf, momentsOf, WIPE_OF } from "./moments";

const MIN = 60_000;
const KICK = Date.UTC(2026, 9, 18, 17);
const started = transitionClock(readyClock(), "start", KICK);
const half = transitionClock(started, "halftime", KICK + 25 * MIN);
const second = transitionClock(half, "second", KICK + 35 * MIN);
const ended = transitionClock(second, "finish", KICK + 61 * MIN);
// stamped by the live clock half-way through football minute `minute`
const ev = (id: string, type: MatchEvent["type"], minute: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, minute: minute - 1, elapsedSeconds: (minute - 1) * 60 + 30, ...more }) as MatchEvent;
const NAMES: Record<string, string> = { adri: "Adrián T.C.", jordi: "Jordi", erik: "Erik", illescas: "Illescas", evans: "Evans", eguz: "Eguzquiza" };
const nameOf = (id: string) => NAMES[id] ?? "?";
const match = (events: MatchEvent[], extra: Partial<ClubMatch> = {}): ClubMatch => ({ id: "j1", rival: "Orduña FC", date: KICK, duration: 50, status: "scheduled", clock: started, events, ...extra });

describe("momentOf", () => {
  const before = [ev("g1", "goal", 6, { playerId: "erik" }), ev("r1", "opponent_goal", 11)];

  it("a goal of ours: the scorer in caps, the assist and the score at that moment; said with the board", () => {
    const g = ev("g2", "goal", 21, { playerId: "adri", assistPlayerId: "jordi" });
    const m = match([...before, g, ev("g3", "goal", 30, { playerId: "erik" })]);
    expect(momentOf(g, m, nameOf)).toEqual({ id: "g2", kind: "gol", ours: true, minute: 21, title: "GOL · ADRIÁN T.C.", sub: "Pase de Jordi. 2–1", said: "Gol del Piti, de Adrián T.C. Piti 2, Orduña FC 1" });
  });

  it("a penalty, an unknown scorer and the rival's own goal are ours too", () => {
    const p = ev("p", "goal_penalty", 9, { playerId: "erik" });
    expect(momentOf(p, match([p]), nameOf)).toMatchObject({ kind: "gol", sub: "De penalti. 1–0" });
    const anon = ev("a", "goal", 9);
    expect(momentOf(anon, match([anon]), nameOf)).toMatchObject({ title: "GOL DEL PITI", said: "Gol del Piti. Piti 1, Orduña FC 0" });
    const own = ev("o", "opponent_own_goal", 9);
    expect(momentOf(own, match([own]), nameOf)).toMatchObject({ kind: "gol", ours: true, title: "GOL · AUTOGOL DE ORDUÑA FC" });
  });

  it("theirs: the rival's goal and ours in our own net, coral and calm", () => {
    const m = match(before);
    expect(momentOf(before[1], m, nameOf)).toEqual({ id: "r1", kind: "golrival", ours: false, minute: 11, title: "GOL · ORDUÑA FC", sub: "1–1", said: "Gol de Orduña FC. Piti 1, Orduña FC 1" });
    const og = ev("og", "own_goal", 12, { playerId: "eguz" });
    expect(momentOf(og, match([og]), nameOf)).toMatchObject({ kind: "golrival", title: "EN PROPIA · EGUZQUIZA", said: "Gol en propia de Eguzquiza. Piti 0, Orduña FC 1" });
  });

  it("cards, changes, the woodwork, saves, penalties and knocks", () => {
    const m = match([]);
    const at = (e: MatchEvent) => momentOf(e, m, nameOf);
    expect(at(ev("y", "yellow_card", 15, { playerId: "eguz" }))).toMatchObject({ kind: "amarilla", ours: true, title: "AMARILLA · EGUZQUIZA", said: "Amarilla a Eguzquiza" });
    expect(at(ev("y2", "opponent_yellow", 16))).toMatchObject({ kind: "amarilla", ours: false, title: "AMARILLA · ORDUÑA FC" });
    expect(at(ev("r", "opponent_red", 38, { note: "El 5, segunda amarilla" }))).toMatchObject({ kind: "roja", ours: false, title: "ROJA · ORDUÑA FC", sub: "El 5, segunda amarilla", said: "Roja a Orduña FC" });
    expect(at(ev("r2", "double_yellow", 39, { playerId: "erik" }))).toMatchObject({ kind: "roja", ours: true, title: "ROJA · ERIK", sub: "Segunda amarilla" });
    expect(at(ev("c", "substitution", 30, { playerId: "illescas", inPlayerId: "erik" }))).toMatchObject({ kind: "cambio", title: "CAMBIO · ENTRA ERIK", sub: "Sale Illescas", said: "Cambio: entra Erik por Illescas" });
    expect(at(ev("w", "woodwork", 18, { playerId: "adri" }))).toMatchObject({ kind: "palo", ours: true, title: "AL PALO · ADRIÁN T.C.", said: "Al palo, Adrián T.C." });
    expect(at(ev("w2", "opponent_woodwork", 19))).toMatchObject({ kind: "palo", ours: false });
    expect(at(ev("s", "penalty_saved", 34, { playerId: "evans" }))).toMatchObject({ kind: "parada", title: "PENALTI PARADO · EVANS", said: "Evans para un penalti" });
    expect(at(ev("s2", "save", 35, { playerId: "evans" }))).toMatchObject({ kind: "parada", title: "PARADA · EVANS" });
    expect(at(ev("pm", "opponent_penalty_missed", 36))).toMatchObject({ kind: "penalti", ours: false });
    expect(at(ev("i", "injury", 40, { playerId: "erik" }))).toMatchObject({ kind: "lesion", title: "TOCADO · ERIK", sub: "Sigue en el campo" });
  });

  it("no moment for a corner, a foul, a chance, an analysis action or an unresolved duplicate", () => {
    const m = match([]);
    for (const type of ["corner", "foul", "chance", "opponent_offside", "pass"] as const) expect(momentOf(ev("x", type, 3), m, nameOf)).toBeNull();
    expect(momentOf(ev("d", "goal", 3, { playerId: "erik", dupOf: "g1" }), m, nameOf)).toBeNull();
  });
});

describe("the clock's turns", () => {
  it("kick-off, half-time, the second half and the final, each with the score of that moment", () => {
    const m = match([ev("g1", "goal", 6, { playerId: "erik" }), ev("g2", "goal", 44, { playerId: "erik" })], { clock: ended });
    const turns = clockMomentsOf(m).map((x) => x.moment);
    expect(turns.map((t) => t.kind)).toEqual(["arranque", "descanso", "reanudacion", "final"]);
    expect(turns[0]).toMatchObject({ id: "j1:arranque", minute: 0, title: "EMPIEZA EL PARTIDO", said: "Empieza el partido" });
    expect(turns[1]).toMatchObject({ minute: 25, title: "DESCANSO · 1–0", said: "Descanso. Piti 1, Orduña FC 0" });
    expect(turns[2]).toMatchObject({ minute: 26, said: "Arranca la segunda parte. Piti 1, Orduña FC 0" });
    expect(turns[3]).toMatchObject({ minute: 51, title: "FINAL · 2–0", sub: "Acta pendiente: la mesa la está repasando", said: "Final. Piti 2, Orduña FC 0" });
    expect(clockMomentsOf({ ...m, clock: undefined })).toEqual([]);
  });

  it("momentsOf: plays and turns in the order they happened", () => {
    const m = match([ev("g2", "goal", 44, { playerId: "erik" }), ev("g1", "goal", 6, { playerId: "erik" }), ev("c", "corner", 7)], { clock: second });
    expect(momentsOf(m, nameOf).map((x) => x.moment.id)).toEqual(["j1:arranque", "g1", "j1:descanso", "j1:reanudacion", "g2"]);
  });
});

describe("isFreshMoment", () => {
  it("a play within two minutes of the clock (or a little ahead of it); a turn within two minutes of its stamp", () => {
    const m = match([], { clock: started });
    const play = { t: 20 * 60, at: null };
    expect(isFreshMoment(play, m, KICK + 20 * MIN)).toBe(true);
    expect(isFreshMoment(play, m, KICK + 20 * MIN + FRESH_MOMENT_SECONDS * 1000)).toBe(true);
    expect(isFreshMoment(play, m, KICK + 20 * MIN + FRESH_MOMENT_SECONDS * 1000 + 1000)).toBe(false);
    expect(isFreshMoment(play, m, KICK + 19 * MIN)).toBe(true);
    const turn = { t: -1, at: KICK };
    expect(isFreshMoment(turn, m, KICK + 90_000)).toBe(true);
    expect(isFreshMoment(turn, m, KICK + 3 * MIN)).toBe(false);
    expect(isFreshMoment(play, { ...m, clock: readyClock() }, KICK)).toBe(false);
  });

  it("the cortinilla is for goals, the kick-off, half-time and the final", () => {
    expect(Object.keys(WIPE_OF).sort()).toEqual(["arranque", "descanso", "final", "gol", "golrival"]);
    expect(WIPE_OF.golrival).toBe("rv");
  });
});
