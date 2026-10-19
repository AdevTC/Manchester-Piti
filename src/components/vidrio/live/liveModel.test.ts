import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../../functions/src/matchClock";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import type { ClubMatch } from "../../../lib/clubData";
import type { MatchMoment } from "../../../lib/derived/moments";
import { playsLog } from "../../../lib/derived/vidrio/plays";
import { clockText, dropEvent, floatHome, floatOf, hideMark, moreText, onFieldNames, pageKey, sheetOf } from "./liveModel";

const MIN = 60_000;
// 8 Nov 2026, 12:00 in Madrid
const DATE = Date.UTC(2026, 10, 8, 11);
const KICK = DATE + 5 * MIN;
const started = transitionClock(readyClock(), "start", KICK);
const half = transitionClock(started, "halftime", KICK + 25 * MIN);
const second = transitionClock(half, "second", KICK + 30 * MIN);
const ended = transitionClock(second, "finish", KICK + 60 * MIN);
const NAMES: Record<string, string> = { a: "Alcides", b: "Adrián T.C.", c: "Jordi", d: "Erik", e: "Evans", f: "Fer", g: "Kevin", h: "Huberoski" };
const nameOf = (id: string) => NAMES[id] ?? id;
const base: ClubMatch = { id: "j1", version: 2, status: "scheduled", rival: "Orduña fc", date: DATE, duration: 50, clock: readyClock(), venue: "CDM Palomeras", starters: ["e", "f", "a", "b", "c", "d", "g"], bench: ["h"] };
const ev = (id: string, type: MatchEvent["type"], minute: number, extra: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, minute: minute - 1, elapsedSeconds: (minute - 1) * 60 + 30, ...extra }) as MatchEvent;
const goal = ev("g1", "goal", 21, { playerId: "b", assistPlayerId: "c" });
const live: ClubMatch = { ...base, clock: started, events: [ev("g0", "goal", 6, { playerId: "a" }), ev("r0", "opponent_goal", 11), goal] };

describe("the floating score's match", () => {
  it("each state of the day, the kick-off before the ball rolls, the score and the clock once it does", () => {
    expect(floatOf({ state: { kind: "previa", match: base }, now: DATE - 30 * MIN })).toMatchObject({ state: "previa", kickoff: DATE, rival: "Orduña fc" });
    expect(floatOf({ state: { kind: "rsvp", match: base }, now: DATE - 30 * MIN }).state).toBe("rsvp");
    expect(floatOf({ state: { kind: "anotador", match: base }, now: DATE - 30 * MIN }).state).toBe("anotador");
    expect(floatOf({ state: { kind: "pending", match: base }, now: DATE + MIN }).state).toBe("pitido");
    expect(floatOf({ state: { kind: "live", match: live }, now: KICK + 22 * MIN })).toMatchObject({ state: "directo", us: 2, them: 1, clock: "23′", event: null });
    expect(floatOf({ state: { kind: "halftime", match: { ...live, clock: half } }, now: KICK + 26 * MIN }).state).toBe("descanso");
    expect(floatOf({ state: { kind: "final", match: { ...live, clock: ended }, published: false }, now: KICK + 61 * MIN }).state).toBe("final");
    expect(floatOf({ state: { kind: "final", match: { ...live, clock: ended }, published: true }, now: KICK + 61 * MIN }).state).toBe("acta");
    expect(floatOf({ state: { kind: "vote", match: live }, now: KICK + 61 * MIN }).state).toBe("mvp");
    expect(floatOf({ state: { kind: "unplayed", match: base }, now: DATE + 4 * 60 * MIN }).state).toBe("pendiente");
  });

  it("sin conexión over a live score: the minute of the last good score when it went stale, none when offline", () => {
    expect(floatOf({ state: { kind: "live", match: live }, now: KICK + 22 * MIN, staleMinutes: 3 })).toMatchObject({ state: "offline", staleAt: "20′" });
    expect(floatOf({ state: { kind: "live", match: live }, now: KICK + 22 * MIN, offline: true })).toMatchObject({ state: "offline", staleAt: undefined });
    // (not while nothing is being played)
    expect(floatOf({ state: { kind: "previa", match: base }, now: DATE - MIN, offline: true }).state).toBe("previa");
  });

  it("the clock carries the added time", () => {
    expect(clockText({ ...live, clock: { ...started, added: { 1: 2 } } }, KICK + 22 * MIN)).toBe("23′+2");
  });

  it("a fresh play unfolds in sentence case: ours with «¡…!», with its minute", () => {
    const rows = playsLog(live, nameOf).rows;
    const m: MatchMoment = { id: "g1", kind: "gol", ours: true, minute: 21, title: "GOL · ADRIÁN T.C.", sub: "", said: "" };
    expect(dropEvent(m, rows)).toEqual({ title: "¡Gol de Adrián T.C.!", sub: expect.stringContaining("minuto 21") });
    const rival: MatchMoment = { id: "r0", kind: "golrival", ours: false, minute: 11, title: "GOL · ORDUÑA FC", sub: "", said: "" };
    expect(dropEvent(rival, rows)?.title).toBe("Gol de Orduña fc");
    expect(dropEvent({ ...m, id: "j1:arranque", kind: "arranque", minute: 0 }, rows)).toEqual({ title: "Empieza el partido", sub: "" });
    expect(dropEvent({ ...m, id: "j1:descanso", kind: "descanso" }, rows)).toBeNull();
    expect(dropEvent(null, rows)).toBeNull();
  });
});

describe("the sheet", () => {
  it("before kick-off: the time, the seven when it is out (the venue otherwise), no plays", () => {
    const s = sheetOf({ state: { kind: "previa", match: base }, now: DATE - 30 * MIN, nameOf });
    expect(s).toMatchObject({ big: "12:00", status: "Hoy a las 12:00", plays: false, live: false, open: "Abrir el partido" });
    expect(s.note).toBe("El siete ya está publicado: Evans, Fer, Alcides, Adrián T.C., Jordi, Erik y Kevin.");
    expect(sheetOf({ state: { kind: "previa", match: { ...base, starters: [] } }, now: DATE - 30 * MIN, nameOf }).note).toBe("En CDM Palomeras.");
  });

  it("«¿Vas hoy?», «Hoy anotas tú», the vote: each its own action", () => {
    expect(sheetOf({ state: { kind: "rsvp", match: base }, now: DATE - 30 * MIN, nameOf, counts: { vienen: 6, duda: 1 } })).toMatchObject({ rsvp: true, note: "Vienen 6 · 1 en duda." });
    expect(sheetOf({ state: { kind: "anotador", match: base }, now: DATE - 30 * MIN, nameOf }).action).toEqual({ kind: "mesa", label: "Abrir la mesa" });
    const vote = sheetOf({ state: { kind: "vote", match: { ...live, voteClosesAt: DATE + 2 * 24 * 60 * MIN } }, now: DATE + 2 * 60 * MIN, nameOf });
    expect(vote).toMatchObject({ action: { kind: "votar", label: "Votar al mejor" }, open: "Abrir el acta", hide: "Ocultar el aviso de votar al MVP" });
    expect(vote.status).toBe("Votación hasta el martes a las 12:00");
  });

  it("live: «En directo», the clock, the half, who is on the pitch (changes applied), and «Ocultar hasta el próximo gol»", () => {
    const withSub: ClubMatch = { ...live, clock: second, events: [...(live.events ?? []), ev("s1", "substitution", 32, { playerId: "d", inPlayerId: "h" })] };
    const rows = playsLog(withSub, nameOf).rows;
    const s = sheetOf({ state: { kind: "live", match: withSub }, now: KICK + 33 * MIN, nameOf, rows });
    expect(s).toMatchObject({ big: "2–1", live: true, status: "Segunda parte", plays: true, hide: "Ocultar hasta el próximo gol" });
    expect(s.onField).toBe("En el campo: Evans, Fer, Alcides, Adrián T.C., Jordi, Huberoski y Kevin.");
    expect(sheetOf({ state: { kind: "live", match: live }, now: KICK + 22 * MIN, nameOf }).status).toBe("Primera parte");
  });

  it("final, acta, and «Pendiente del acta» (no score)", () => {
    expect(sheetOf({ state: { kind: "final", match: { ...live, clock: ended }, published: false }, now: KICK + 61 * MIN, nameOf }).status).toBe("Final · acta pendiente");
    expect(sheetOf({ state: { kind: "final", match: { ...live, clock: ended }, published: true }, now: KICK + 61 * MIN, nameOf }).open).toBe("Abrir el acta");
    expect(sheetOf({ state: { kind: "unplayed", match: base }, now: DATE + 4 * 60 * MIN, nameOf })).toMatchObject({ big: null, status: "Pendiente del acta", plays: false });
  });
});

describe("small rules", () => {
  it("on the pitch without a lineup: nobody", () => {
    expect(onFieldNames({ starters: [], events: [] }, nameOf)).toEqual([]);
  });

  it("«Ocultar» comes back with the next goal while the ball rolls, with the next state otherwise", () => {
    const a = hideMark({ kind: "live", match: live }, "g1");
    expect(hideMark({ kind: "halftime", match: live }, "g1")).toBe(a);
    expect(hideMark({ kind: "live", match: live }, "g2")).not.toBe(a);
    expect(hideMark({ kind: "final", match: live, published: false }, "g1")).not.toBe(a);
  });

  it("words and keys", () => {
    expect(moreText(1)).toBe("1 jugada más");
    expect(moreText(14)).toBe("14 jugadas más");
    expect(pageKey("/")).toBe("inicio");
    expect(pageKey("/plantilla")).toBe("plantilla");
    expect(pageKey("/matches/j1")).toBe("partido");
    expect(pageKey("/jugadores/erik")).toBe("jugador");
  });

  it("the float's resting spot per page: Inicio under the bar, low where the top-right is the page's own", () => {
    expect(floatHome("/")).toBe("centre");
    for (const p of ["/partidos", "/matches/j3", "/profile"]) expect(floatHome(p)).toBe("bottom-right");
    for (const p of ["/stats", "/plantilla", "/club", "/vestuario", "/jugadores/erik"]) expect(floatHome(p)).toBe("right");
  });
});
