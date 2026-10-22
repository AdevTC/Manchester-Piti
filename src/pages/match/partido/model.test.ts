import { describe, expect, it } from "vitest";
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";
import { autoCronica, chapters, edgeOf, faseOf, lineupOf, parseMin, playsOf, resultWords, scoreAt, timelineOf } from "./model";
import { ribbonMarks } from "./moviola";
import { statusOf, titleOf } from "./words";

const names: Record<string, string> = { a: "Alcides", j: "Jordi", p: "Pellete", e: "Evans", f: "Fer", i: "Illescas", k: "Kevin", g: "Eguzquiza", b: "Brawan" };
const nameOf = (id: string) => names[id] ?? id;
const ev = (id: string, type: string, minute: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, minute, ...more }) as MatchEvent;

/** Production's J1 in miniature: five of theirs in eleven minutes, a penalty, our goal in the 43, rolling changes. */
const J1: ClubMatch = {
  id: "j1",
  rival: "Orduña fc",
  date: Date.UTC(2026, 9, 18, 17, 0),
  duration: 50,
  status: "finished",
  starters: ["e", "f", "i", "j", "a", "g", "p"],
  bench: ["k", "b"],
  notCalled: [],
  events: [
    ev("1", "opponent_goal", 2),
    ev("2", "opponent_goal", 3),
    ev("3", "opponent_goal", 9),
    ev("4", "opponent_goal", 10),
    ev("5", "substitution", 10, { playerId: "p", inPlayerId: "k" }),
    ev("6", "opponent_goal", 11),
    ev("7", "substitution", 18, { playerId: "f", inPlayerId: "b" }),
    ev("8", "substitution", 18, { playerId: "g", inPlayerId: "p" }),
    ev("9", "penalty_committed", 28, { playerId: "j" }),
    ev("10", "opponent_goal", 29),
    ev("11", "opponent_goal", 39),
    ev("12", "goal", 43, { playerId: "a" }),
    ev("13", "opponent_goal", 49),
  ],
};

describe("playsOf", () => {
  const plays = playsOf(J1, nameOf, "Orduña fc");
  it("words the goals as the acta's chapters", () => {
    expect(plays[0]).toMatchObject({ k: "rival", title: "Golpe de Orduña fc", sub: "Marca Orduña fc. 0–1." });
    expect(plays[1].title).toBe("Orduña fc amplía");
    const ours = plays.find((p) => p.k === "gol");
    expect(ours).toMatchObject({ title: "Gol de Alcides", sub: "Recortamos: 1–7.", who: "a", m: 43 });
  });
  it("ties a penalty to the goal it gave", () => {
    expect(plays.find((p) => p.k === "penalti")).toMatchObject({ title: "Penalti de Jordi", sub: "Penalti cometido; lo marca Orduña fc en el 29" });
  });
  it("scores at any minute", () => {
    expect(scoreAt(plays, 11)).toEqual({ us: 0, them: 5 });
    expect(scoreAt(plays, 50)).toEqual({ us: 1, them: 8 });
  });
  it("folds the changes of one minute", () => {
    const ch = chapters(plays, nameOf).filter((p) => p.k === "cambio");
    expect(ch.map((c) => c.title)).toEqual(["Entra Kevin, sale Pellete", "2 cambios"]);
    expect(ch[1].sub).toBe("Entran Brawan y Pellete; salen Fer y Eguzquiza");
  });
  it("tells the acta in two sentences until there is a crónica", () => {
    expect(autoCronica(plays, "Orduña fc", 50, nameOf)).toBe("Orduña fc marcó cinco en los primeros once minutos y se fue 0–5 al descanso. En la segunda parte el partido fue más igualado (1–3): Alcides marcó en el 43, y acabó 1–8.");
  });
});

describe("timelineOf", () => {
  const plays = playsOf(J1, nameOf, "Orduña fc");
  const tl = timelineOf(J1, lineupOf(J1), plays, 50, 50, nameOf);
  it("puts whoever comes on in the spot of the one he replaces", () => {
    const at9 = tl.onPitchAt(9);
    const at12 = tl.onPitchAt(12);
    const spot = at9.findIndex((s) => s.id === "p");
    expect(at12[spot]).toMatchObject({ id: "k", cameIn: 10 });
  });
  it("a player back on takes a free spot again", () => {
    expect(tl.onPitchAt(20).map((s) => s.id).sort()).toEqual(["a", "b", "e", "i", "j", "k", "p"].sort());
  });
  it("counts minutes up to the minute asked", () => {
    const k = tl.stintsAt(30).find((r) => r.id === "k");
    expect(k?.min).toBe(20);
  });
  it("marks the night up to the minute", () => {
    expect(tl.tagsAt(42).a).toBeUndefined();
    expect(tl.tagsAt(50).a).toEqual([{ k: "gol", text: "43′", gold: true }]);
    expect(tl.tagsAt(30).k).toEqual([{ k: "cambio", text: "10′" }]);
  });
});

describe("the moment", () => {
  it("reads the phase of the match day", () => {
    expect(faseOf(J1, Date.UTC(2026, 9, 19), true)).toBe("acta");
    expect(faseOf(J1, Date.UTC(2026, 9, 19), false)).toBe("despues");
    expect(faseOf({ ...J1, status: "postponed" }, 0, false)).toBe("aplazado");
    expect(faseOf({ ...J1, status: "scheduled", events: [] }, Date.UTC(2026, 9, 18, 14), false)).toBe("antes");
  });
  it("the live edge and ?min=", () => {
    expect(edgeOf("primera", 23, 50)).toBe(23);
    expect(edgeOf("descanso", 26, 50)).toBe(25);
    expect(edgeOf("acta", null, 50)).toBe(50);
    expect(edgeOf("antes", null, 50)).toBe(0);
    expect(parseMin("21")).toBe(21);
    expect(parseMin("x")).toBeNull();
    expect(parseMin("2.5")).toBeNull();
  });
  it("words the header", () => {
    const R = resultWords({ us: 1, them: 8 }, { us: 0, them: 5 });
    expect(titleOf("acta", "J1 · ", "Orduña fc", true, R, false).l).toBe("J1 · Derrota 1–8 ante Orduña fc");
    expect(statusOf({ fase: "acta", m: 21, edge: 50, dragged: true, result: R, kick: 0, now: 0, postponedTo: null, cancelled: false })).toBe("Derrota 1–8. Estás viendo el minuto 21");
    expect(statusOf({ fase: "descanso", m: 25, edge: 25, dragged: false, result: R, kick: 0, now: 0, postponedTo: null, cancelled: false })).toBe("Descanso, 0–5 en la primera parte");
  });
});

describe("ribbonMarks", () => {
  it("folds a lane's close plays into one mark with a count", () => {
    const plays = playsOf(J1, nameOf, "Orduña fc");
    const marks = ribbonMarks(plays, 50, 50, 50, 640);
    const first = marks.find((m) => m.top === 76);
    expect(first?.n).toBeGreaterThan(1);
    expect(first?.label).toMatch(/^Minutos 2 a /);
    expect(marks.some((m) => m.cls.includes("vd-ribbon__mark--gold"))).toBe(true);
  });
});
