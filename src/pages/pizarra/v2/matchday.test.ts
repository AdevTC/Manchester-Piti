import { describe, expect, it } from "vitest";
import type { Lineup, Sub } from "../formations";
import { libraryPlays } from "../playLibrary";
import type { CalMatch } from "./boards";
import { cartelLayout } from "./cartel";
import { charlaView, lanzadores, STEP_BALON, STEP_PLAN } from "./charla";
import { liveNow, liveWave, nextClockAt, plateAria, subProblem, subsMade, takersNow, waveLine } from "./live";
import { readyClock, transitionClock } from "../../../../functions/src/matchClock";
import { chemOf } from "./quimica";
import { setTaker } from "./takers";
import { demoSquad, lineupOf } from "./testkit";

// The rest of the match day, pure: the live clock and the plan against the acta, the Cambios tab's
// view (rows, options, scrub, table), the fan's 1º · 2º · 3º, la charla and the cartel with the cambios
// and the takers in order, and the prompt bar of the tab.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (subs?: Sub[]): Lineup => ({ ...lineupOf(SEVEN, "2-3-1", sq), ...(subs ? { subs } : {}) });
const nm = (id: string) => sq.byId.get(id)?.name ?? id;
const T0 = Date.UTC(2026, 9, 11, 10, 0);
const MIN = 60_000;
const M = (o: Partial<CalMatch> = {}): CalMatch => ({
  id: "m8",
  j: 8,
  rival: "MAD SKY",
  dateMs: T0,
  played: false,
  gf: null,
  ga: null,
  home: true,
  venue: "",
  conv: { starters: SEVEN, bench: ["kevin", "erik", "fer"] },
  ...o,
});

describe("the live clock", () => {
  it("is live from the kick-off to the end plus added time; the minute and the score come from the match", () => {
    expect(liveNow(M(), T0 - 1)).toBeNull();
    const l = liveNow(M({ events: [{ id: "a", type: "goal", minute: 3, playerId: "adrian" }, { id: "b", type: "opponent_goal", minute: 9 }, { id: "c", type: "goal", minute: 12 }] }), T0 + 12.5 * MIN);
    expect(l).toMatchObject({ minute: 13, gf: 2, ga: 1, duration: 50, nextTick: T0 + 13 * MIN });
    // the minute stops at the duration in added time; then it's over
    expect(liveNow(M(), T0 + 59 * MIN)?.minute).toBe(50);
    expect(liveNow(M(), T0 + 60 * MIN)).toBeNull();
    expect(liveNow(M({ liveEndedAt: T0 + 40 * MIN }), T0 + 41 * MIN)).toBeNull();
    expect(liveNow(M({ duration: 70 }), T0 + 65 * MIN)?.minute).toBe(66);
    expect(liveNow(M({ status: "finished" }), T0 + MIN)).toBeNull();
    expect(liveNow(M({ played: true }), T0 + MIN)).toBeNull();
    expect(liveNow(null, T0)).toBeNull();
  });

  it("on a clock: the plan counts the minutes elapsed, the plate reads football's minute (0:07 → 1′)", () => {
    const l = liveNow(M({ clock: transitionClock(readyClock(), "start", T0) }), T0 + 7_000);
    expect(l).toMatchObject({ minute: 0, shown: 1 });
    expect(plateAria(l as NonNullable<typeof l>)).toMatch(/^En directo, minuto 1:/);
    // without a clock both are the schedule's minute
    expect(liveNow(M(), T0 + 12.5 * MIN)).toMatchObject({ minute: 13, shown: 13 });
  });

  it("who is on: the convocatoria and the cambios and cards of the acta", () => {
    const l = liveNow(M({ events: [{ id: "s", type: "substitution", minute: 10, playerId: "adrian", inPlayerId: "kevin" }, { id: "r", type: "red_card", minute: 11, playerId: "tello" }] }), T0 + 20 * MIN);
    expect(l?.field).toContain("kevin");
    expect(l?.field).not.toContain("adrian");
    expect(l?.field).not.toContain("tello");
    expect(l?.bench).toEqual(["adrian", "erik", "fer"]);
  });

  it("looks at the time at the kick-off, then at each minute, never after the end", () => {
    expect(nextClockAt(M(), T0 - 10 * MIN)).toBe(T0);
    expect(nextClockAt(M(), T0 + 3.2 * MIN)).toBe(T0 + 4 * MIN);
    expect(nextClockAt(M(), T0 + 70 * MIN)).toBeNull();
    expect(nextClockAt(null, T0)).toBeNull();
  });
});

describe("the plan against the acta", () => {
  const subs: Sub[] = [
    { id: "a", min: 20, out: "adrian", in: "kevin" },
    { id: "b", min: 20, out: "tello", in: "erik" },
    { id: "c", min: 35, out: "huberoski", in: "fer" },
  ];
  it("knows which cambios are in the acta, the tanda that is due and the next one with its countdown", () => {
    const ev = [{ id: "x", type: "substitution" as const, minute: 21, playerId: "adrian", inPlayerId: "kevin" }];
    expect([...subsMade(subs, ev)]).toEqual(["a"]);
    const l = liveNow(M({ events: ev }), T0 + 22 * MIN);
    const w = liveWave(subs, l as NonNullable<typeof l>);
    expect(w?.wave.min).toBe(20);
    expect(w?.pending.map((s) => s.id)).toEqual(["b"]);
    expect(waveLine(w)).toBe("Toca el cambio · 20′");
    const l2 = liveNow(M({ events: [...ev, { id: "y", type: "substitution", minute: 22, playerId: "tello", inPlayerId: "erik" }] }), T0 + 31.5 * MIN);
    const w2 = liveWave(subs, l2 as NonNullable<typeof l2>);
    expect(waveLine(w2)).toBe("Próximo cambio · 35′ (en 3′)");
    expect(waveLine(null)).toBe("Sin más cambios en el plan");
  });

  it("checks a cambio as the admin's En juego does, and against the pitch as it is", () => {
    const m = M();
    const l = liveNow(m, T0 + 10 * MIN) as NonNullable<ReturnType<typeof liveNow>>;
    expect(subProblem(m, l, { id: "a", min: 20, out: "adrian", in: "kevin" }, T0 + 10 * MIN, nm)).toBeNull();
    expect(subProblem(m, l, { id: "a", min: 20, out: "kevin", in: "erik" }, T0 + 10 * MIN, nm)).toBe("KEVIN ya no está en el campo");
    expect(subProblem(m, l, { id: "a", min: 20, out: "adrian", in: "almachi" }, T0 + 10 * MIN, nm)).toBe("ALMACHI no puede entrar: no está en el banquillo");
    expect(subProblem(m, l, { id: "a", min: 20, out: "adrian", in: "brawan" }, T0 + 10 * MIN, nm)).toBe("El cambio necesita quién sale y quién entra.");
  });

  it("who takes each dead ball right now: the first of each list on the pitch", () => {
    const t = { penalties: ["adrian", "tello"], freekicks: [], corners: ["kevin"] };
    expect(takersNow(t, ["tello", "kevin"], nm).map((x) => x.l + " " + x.who)).toEqual(["P TELLO", "F —", "E KEVIN"]);
  });
});

describe("la charla and the cartel", () => {
  const play = libraryPlays(L7())[0];
  const args = (L: Lineup, step: number) => ({ L, sq, step, play, playShort: "Córner", match: null, boardName: "Uno", sysName: "2-3-1", tacSum: "Presión media", qv: 70, in3d: false, playing: false });

  it("the plan step carries the cambios, one line per tanda, and the running order counts them", () => {
    const L = L7([
      { id: "a", min: 20, out: "adrian", in: "kevin" },
      { id: "b", min: 20, out: "tello", in: "erik" },
    ]);
    const v = charlaView(args(L, STEP_PLAN));
    expect(v.cambios).toEqual(["20′ · KEVIN por ADRIAN, ERIK por TELLO"]);
    expect(v.guion[STEP_PLAN].t).toBe("El plan · Presión media · 2 cambios");
    expect(charlaView(args(L7(), STEP_PLAN)).cambios).toBeNull();
  });

  it("the dead balls in their order, the brazalete with its vice", () => {
    let L = setTaker(setTaker(L7(), "penalties", "adrian", 0), "penalties", "kevin", 1);
    L = { ...L, roles: { ...L.roles, captainId: "tello", viceId: "illescas" } };
    const ls = lanzadores(L, sq);
    expect(ls[0]).toMatchObject({ label: "Brazalete", name: "TELLO (vice: ILLESCAS)" });
    expect(ls[1]).toMatchObject({ label: "Penaltis", name: "ADRIAN › KEVIN", onPitch: true });
    expect(charlaView(args(L, STEP_BALON)).lt?.d).toContain("Penaltis: ADRIAN › KEVIN");
  });

  it("the cartel prints the cambios", () => {
    const L = L7([{ id: "a", min: 25, out: "adrian", in: "kevin" }]);
    const c = cartelLayout(L, sq, chemOf(L, sq), null, "Temporada 1");
    expect(c.subs).toEqual(["25′ · KEVIN por ADRIAN"]);
    expect(c.aria).toContain("Cambios: 25′ · KEVIN por ADRIAN");
    expect(cartelLayout(L7(), sq, chemOf(L7(), sq), null, "Temporada 1").subs).toBeUndefined();
  });
});
