// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../../../lib/clubData";
import { fakeBoard, fakeLineup, fakeWorld, makeTestStore, ME_CAPTAIN, ME_PLAYER } from "../../store/testkit";
import type { PzMatch } from "../../store/types";
import { descPairs, EMPTY_FEED, intervals, mesaState, plannedOf, playedOf, ptModel, stageFor, total, UI0, type PtFeed } from "./partidoView";
import { badgeOf, peekOf, primaryOf, subOf } from "./actions";
import { matchAt } from "./testMatch";

const SEVEN = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];
const CODES = ["POR", "DFC", "LI", "LD", "MC", "MC", "DC"] as const;
const lineup = { system: "3-2-1", slots: SEVEN.map((p, i) => ({ playerId: p, code: CODES[i], x: 10 + i * 10, y: 90 - i * 10 })), boardId: "b1", setAt: 0 };
const ev = (id: string, type: string, minute: number, o: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, minute, ...o }) as MatchEvent;

function world(phase: PzMatch["phase"], o: { subs?: { id: string; min: number; out: string; in: string }[]; condPlan?: unknown[]; variants?: unknown[] } = {}) {
  const W = fakeWorld();
  const m = matchAt(W, phase);
  const L = { ...fakeLineup("3-2-1", SEVEN), subs: o.subs ?? [{ id: "s1", min: 15, out: "fer", in: "kevin" }, { id: "s2", min: 25, out: "eguzquiza", in: "josito" }] };
  if (o.condPlan) Object.assign(L, { condPlan: o.condPlan });
  if (o.variants) Object.assign(L, { variants: o.variants });
  return { ...W, matches: [m], boards: [fakeBoard({ isOfficial: true, lineup: L })], official: { boardId: "b1", matchId: "j3" }, rsvp: { kevin: { v: "yes" as const }, josito: { v: "yes" as const } } };
}
const feed = (o: Partial<PtFeed> = {}): PtFeed => ({ ...EMPTY_FEED, matchId: "j3", lineup, present: [...SEVEN, "kevin", "josito"], ...o });

describe("Partido · the live model (la mesa's lineup + the acta's events are the one truth)", () => {
  it("walks the acta: cambios, a red that empties a slot, marks and the score", () => {
    const { P } = makeTestStore({ world: world("juego"), place: "partido" });
    const events = [ev("e1", "goal", 6, { playerId: "alcides", assistPlayerId: "adrian" }), ev("e2", "opponent_goal", 14), ev("e3", "substitution", 15, { playerId: "fer", inPlayerId: "kevin" }), ev("e4", "yellow_card", 18, { playerId: "erik" }), ev("e5", "red_card", 20, { playerId: "jordi" }), ev("e6", "injury", 22, { playerId: "adrian" })];
    const X = ptModel(P, feed({ events, minute: 23, clock: "first" }), UI0);
    expect(X.ph).toBe("juego");
    expect(X.L?.gf).toBe(1);
    expect(X.L?.ga).toBe(1);
    expect(X.field).toContain("kevin");
    expect(X.field).not.toContain("fer");
    expect(X.field).not.toContain("jordi");
    expect(X.L?.slots.find((s) => s.code === "LD")?.playerId).toBeNull();
    expect(X.L?.marks.erik?.[0]).toMatchObject({ k: "amarilla", t: "Amarilla 18′" });
    expect(X.L?.marks.adrian?.[0].k).toBe("tocado");
    expect(X.reds).toEqual(["jordi"]);
    expect(playedOf(X, "fer")).toBe(15);
    expect(playedOf(X, "kevin")).toBe(8);
    expect(plannedOf(X, "kevin")).toBe(35);
    // the planned 15′ cambio is «done»; the next one is the 25′
    expect(X.tandas[0].done).toBe(true);
    expect(X.next).toMatchObject({ min: 25, out: "eguzquiza", in: "josito" });
  });

  it("a pending duplicate counts for nothing; events after the minute aren't in yet", () => {
    const { P } = makeTestStore({ world: world("juego"), place: "partido" });
    const X = ptModel(P, feed({ minute: 10, events: [ev("a", "goal", 6, { playerId: "alcides" }), ev("b", "goal", 6, { playerId: "alcides", dupOf: "a" }), ev("c", "goal", 12, { playerId: "erik" })] }), UI0);
    expect(X.L?.gf).toBe(1);
  });

  it("who can't go on is the urgent next change, with the best fit on the bench", () => {
    const { P } = makeTestStore({ world: world("juego"), place: "partido" });
    const X = ptModel(P, feed({ minute: 20 }), { ...UI0, cant: { alcides: true } });
    expect(X.next).toMatchObject({ out: "alcides", urgent: true });
    expect(["kevin", "josito"]).toContain(X.next?.in);
  });

  it("«Si pasa…»: holds when losing by 1 from the 35′; applied, its cambio is the next one", () => {
    const rule = { id: "c1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", sub: { out: "alcides", in: "kevin" }, ver: "planb" };
    const { P } = makeTestStore({ world: world("juego", { subs: [], condPlan: [rule] }), place: "partido" });
    const events = [ev("g", "opponent_goal", 30)];
    expect(ptModel(P, feed({ minute: 30, events }), UI0).cond?.applies).toBe(false);
    const X = ptModel(P, feed({ minute: 36, events }), UI0);
    expect(X.cond?.applies).toBe(true);
    expect(X.next).toBeNull();
    const Y = ptModel(P, feed({ minute: 36, events }), { ...UI0, cond: true });
    expect(Y.next).toMatchObject({ out: "alcides", in: "kevin", cond: true });
  });

  it("without la mesa's lineup the pitch is the plan board's titular (said, never empty)", () => {
    const { P } = makeTestStore({ world: world("juego"), place: "partido" });
    const X = ptModel(P, feed({ lineup: null, minute: 5 }), UI0);
    expect(X.L?.fallback).toBe(true);
    expect(X.field).toHaveLength(7);
  });
});

describe("Partido · phases, la mesa and the stage", () => {
  it("la mesa: sin siete · al día · otro siete", () => {
    const { P } = makeTestStore({ world: world("antes"), place: "partido" });
    expect(mesaState(ptModel(P, feed({ lineup: null }), UI0))).toBe("sin");
    expect(mesaState(ptModel(P, feed(), UI0))).toBe("aldia");
    const other = { ...lineup, slots: lineup.slots.map((s, i) => (i === 6 ? { ...s, playerId: "kevin" } : s)) };
    expect(mesaState(ptModel(P, feed({ lineup: other }), UI0))).toBe("otro");
  });

  it("before: the stage is the official's seven with its caption; a tanda focused shows that minute", () => {
    const { P } = makeTestStore({ world: world("antes"), place: "partido" });
    const X = ptModel(P, feed(), UI0);
    expect(stageFor(P, X)).toMatchObject({ source: "siete", boardId: "b1", caption: "El siete oficial · 3-2-1 · así sale al pitido" });
    const F = ptModel(P, feed(), { ...UI0, focus: 25 });
    const st = stageFor(P, F);
    expect(st.source).toBe("ahora");
    expect(st.slots?.find((s) => s.code === "LI")?.playerId).toBe("kevin");
    expect(st.next).toMatchObject({ min: 25, out: "eguzquiza", in: "josito" });
  });

  it("live: the pitch now with the next change; on the phone no caption (the peek says it)", () => {
    const { P } = makeTestStore({ world: world("juego"), place: "partido" });
    const X = ptModel(P, feed({ minute: 20 }), UI0);
    // (the 15′ cambio was never made: it is still the next one, overdue)
    expect(stageFor(P, X)).toMatchObject({ source: "ahora", next: { min: 15, out: "fer", in: "kevin" }, caption: "Próximo cambio · 15′ · entra KEVIN por FER" });
    const { P: Q } = makeTestStore({ world: world("juego"), place: "partido", layout: "phone" });
    expect(stageFor(Q, ptModel(Q, feed({ minute: 20 }), UI0)).caption).toBe("");
  });

  it("half-time: the «2ª parte» version's cambios (who comes on, for whom)", () => {
    const v2 = { id: "v2", name: "2ª parte", formation: "3-2-1", freeMode: false, slots: fakeLineup("3-2-1", ["evans", "fer", "erik", "jordi", "adrian", "kevin", "josito"]).slots, tactics: fakeLineup().tactics };
    const { P } = makeTestStore({ world: world("descanso", { variants: [v2] }), place: "partido" });
    const X = ptModel(P, feed({ minute: 25, clock: "halftime" }), UI0);
    expect(descPairs(X)).toEqual([
      { out: "eguzquiza", in: "kevin", why: "La versión «2ª parte» · MC" },
      { out: "alcides", in: "josito", why: "La versión «2ª parte» · DC" },
    ]);
    const plan = ptModel(P, feed({ minute: 25, clock: "halftime" }), { ...UI0, descOpt: "plan" });
    expect(descPairs(plan).map((r) => r.in)).toEqual(["kevin", "josito"]);
  });

  it("after: the minutes as played to the end, the notas frozen", () => {
    const { P } = makeTestStore({ world: world("jugado"), place: "partido" });
    const X = ptModel(P, feed({ events: [ev("s", "substitution", 15, { playerId: "fer", inPlayerId: "kevin" })], notas: { alcides: 7.2 } }), UI0);
    expect(X.ph).toBe("despues");
    expect(X.now).toBe(50);
    expect(total(X.actIv?.kevin)).toBe(35);
    expect(stageFor(P, X).caption).toBe("Acabaron · 0–0 · las notas, congeladas");
  });

  it("intervals: a red ends his match, a cambio after T doesn't count yet", () => {
    const iv = intervals(["a", "b"], [{ min: 10, out: "a", in: "c" }, { min: 30, out: "b", in: null }, { min: 40, out: "c", in: "d" }], 35);
    expect(total(iv.a)).toBe(10);
    expect(total(iv.b)).toBe(30);
    expect(total(iv.c)).toBe(25);
    expect(iv.d).toBeUndefined();
  });
});

describe("Partido · what the place tells the shell", () => {
  it("before: «Mandar a la mesa» for a captain while la mesa hasn't got it; a player gets the charla", () => {
    const h = makeTestStore({ world: world("antes"), place: "partido", me: ME_CAPTAIN });
    h.P.slice("pt-feed").set(feed({ lineup: null }), { undoable: false, toast: false });
    expect(primaryOf(h.P)?.label).toBe("Mandar a la mesa");
    h.P.slice("pt-feed").set(feed(), { undoable: false, toast: false });
    expect(primaryOf(h.P)?.label).toBe("Ver la charla");
    const p = makeTestStore({ world: world("antes"), place: "partido", me: ME_PLAYER });
    p.P.slice("pt-feed").set(feed({ lineup: null }), { undoable: false, toast: false });
    expect(primaryOf(p.P)?.label).toBe("Ver la charla");
  });

  it("live: «Hacer el cambio» for a captain or the match's scorer", () => {
    const h = makeTestStore({ world: world("juego"), place: "partido", me: ME_PLAYER });
    h.P.slice("pt-feed").set(feed({ minute: 23, events: [ev("g", "goal", 6, { playerId: "alcides" })] }), { undoable: false, toast: false });
    expect(primaryOf(h.P)).toBeNull();
    h.P.slice("pt-feed").set(feed({ minute: 23, scorer: true }), { undoable: false, toast: false });
    expect(primaryOf(h.P)?.label).toBe("Hacer el cambio");
  });
});

describe("Partido · the badge and the sublabel say «En juego» only when la mesa's clock says so", () => {
  const at = (m: PzMatch) => {
    const W = fakeWorld();
    return makeTestStore({ world: { ...W, matches: [m] }, place: "siete" }).P;
  };
  const W = fakeWorld();
  it("before: no badge, the day and the time (also with a stale «juego» phase but no clock: the bug of round 3)", () => {
    const P = at(matchAt(W, "antes"));
    expect(badgeOf(P)).toBeNull();
    expect(subOf(P)).toBe("dom 18:00");
    expect(peekOf(P)).toBe(150);
    const noClock = { ...matchAt(W, "antes"), phase: "juego" as const };
    expect(badgeOf(at(noClock))).toBeNull();
    expect(subOf(at(noClock))).toBe("dom 18:00");
  });
  it("today, before the whistle: «Hoy 18:00»", () => {
    expect(subOf(at(matchAt(W, "antes", { at: W.now + 50 * 60000 })))).toBe("Hoy " + new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(new Date(W.now + 50 * 60000)));
  });
  it("live: the minute and the score, compact, from the calendar row (no feed needed)", () => {
    const P = at(matchAt(W, "juego", { events: [{ id: "g", type: "goal", minute: 6, playerId: "alcides" }, { id: "o", type: "opponent_goal", minute: 14 }, { id: "d", type: "goal", minute: 14, playerId: "erik", dupOf: "g" }] }));
    expect(badgeOf(P)).toEqual({ t: "24′ 1–1", word: "En juego", live: true });
    expect(subOf(P)).toBe("En juego 24′");
    expect(peekOf(P)).toBe(176);
  });
  it("half-time: «Descanso» and the score", () => {
    const P = at(matchAt(W, "descanso", { events: [{ id: "g", type: "goal", minute: 6, playerId: "alcides" }] }));
    expect(badgeOf(P)).toEqual({ t: "1–0", word: "Descanso", live: false });
    expect(subOf(P)).toBe("Descanso");
  });
  it("after: «Jugado · 3–2», no badge; a clock left running for hours isn't live", () => {
    expect(subOf(at({ ...matchAt(W, "jugado"), gf: 3, ga: 2 }))).toBe("Jugado · 3–2");
    expect(badgeOf(at(matchAt(W, "jugado")))).toBeNull();
    const stale = matchAt(W, "juego", { startedAgoMin: 6 * 60 });
    expect(badgeOf(at(stale))).toBeNull();
  });
});
