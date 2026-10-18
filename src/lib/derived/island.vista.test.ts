import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../clubData";
import { islandAnnouncement, islandOf, islaVista, PREVIA_MS, pulseOf, todayMatch, type IslandState } from "./island";
import { momentOf, momentsOf } from "./moments";

const MIN = 60_000;
// 8 Nov 2026, 12:00 in Madrid
const DATE = Date.UTC(2026, 10, 8, 11);
const base: ClubMatch = { id: "j8", version: 2, status: "scheduled", rival: "MAD SKY", date: DATE, duration: 50, clock: readyClock() };
const started = transitionClock(readyClock(), "start", DATE + 5 * MIN);
const ended = transitionClock(transitionClock(transitionClock(started, "halftime", DATE + 30 * MIN), "second", DATE + 40 * MIN), "finish", DATE + 65 * MIN);
const ev = (id: string, type: MatchEvent["type"], minute: number, playerId?: string): MatchEvent => ({ id, type, minute: minute - 1, elapsedSeconds: (minute - 1) * 60 + 30, ...(playerId ? { playerId } : {}) }) as MatchEvent;

describe("the match of today: previa, «¿Vas hoy?», «Hoy anotas tú»", () => {
  it("«Antes del partido» for everyone in the last two hours before kick-off; nothing earlier", () => {
    expect(islandOf([base], DATE - PREVIA_MS - 1, false)).toBeNull();
    expect(islandOf([base], DATE - PREVIA_MS, false)).toEqual({ kind: "previa", match: base });
    expect(islandOf([base], DATE - MIN, false)?.kind).toBe("previa");
  });

  it("a member: «Hoy anotas tú» from the morning until the clock starts (also while it waits for the whistle), else «¿Vas hoy?» while he hasn't answered", () => {
    const morning = DATE - 4 * 60 * MIN; // 08:00 in Madrid
    expect(islandOf([base], morning, false, { anotador: true, rsvp: true })).toEqual({ kind: "anotador", match: base });
    expect(islandOf([base], morning, false, { rsvp: true })).toEqual({ kind: "rsvp", match: base });
    expect(islandOf([base], morning, false, {})).toBeNull();
    expect(islandOf([base], DATE + 5 * MIN, false, { anotador: true })?.kind).toBe("anotador");
    expect(islandOf([base], DATE + 5 * MIN, false, { rsvp: true })?.kind).toBe("pending");
    // the day before: nothing
    expect(islandOf([base], DATE - 14 * 60 * MIN, false, { anotador: true, rsvp: true })).toBeNull();
    // a match being played comes first
    expect(islandOf([{ ...base, id: "x", clock: started }, { ...base, date: DATE + 60 * MIN }], DATE + 10 * MIN, false, { anotador: true })?.kind).toBe("live");
  });

  it("todayMatch: one waiting for its whistle first, else the earliest still to kick off today", () => {
    const later: ClubMatch = { ...base, id: "late", date: DATE + 3 * 60 * MIN };
    expect(todayMatch([later, base], DATE - 60 * MIN)?.id).toBe("j8");
    expect(todayMatch([later, base], DATE + 5 * MIN)?.id).toBe("j8");
    expect(todayMatch([later], DATE + 5 * MIN)?.id).toBe("late");
    expect(todayMatch([{ ...base, date: DATE + 24 * 60 * MIN }], DATE)).toBeUndefined();
  });
});

describe("islandAnnouncement", () => {
  const m: ClubMatch = { ...base, clock: started, events: [ev("g1", "goal", 3, "erik")] };
  it("one line per state, the second half told apart from the kick-off, the acta told apart from the whistle", () => {
    expect(islandAnnouncement({ kind: "previa", match: base }, null)).toBe("Hoy a las 12:00, Manchester Piti contra MAD SKY.");
    expect(islandAnnouncement({ kind: "rsvp", match: base }, null)).toBe("¿Vas hoy? Responde desde aquí.");
    expect(islandAnnouncement({ kind: "anotador", match: base }, null)).toBe("Hoy anotas tú: la mesa del partido contra MAD SKY se abre desde aquí.");
    expect(islandAnnouncement({ kind: "pending", match: base }, null)).toBe("Manchester Piti contra MAD SKY: pendiente del pitido inicial.");
    expect(islandAnnouncement({ kind: "live", match: m }, "pending")).toBe("Empieza el partido contra MAD SKY.");
    expect(islandAnnouncement({ kind: "live", match: m }, "halftime")).toBe("Arranca la segunda parte. Piti 1, MAD SKY 0.");
    expect(islandAnnouncement({ kind: "halftime", match: m }, "live")).toBe("Descanso. Piti 1, MAD SKY 0.");
    expect(islandAnnouncement({ kind: "final", match: m, published: false }, "live")).toBe("Final. Piti 1, MAD SKY 0. Acta pendiente.");
    expect(islandAnnouncement({ kind: "final", match: m, published: true }, "final")).toBe("Acta publicada.");
    expect(islandAnnouncement({ kind: "final", match: m, published: true }, "live")).toBe("Final. Piti 1, MAD SKY 0. Acta publicada.");
    expect(islandAnnouncement({ kind: "vote", match: m }, "final")).toBe("Ya puedes votar al mejor del partido contra MAD SKY.");
  });
});

describe("islaVista: every state's words", () => {
  const NAMES: Record<string, string> = { adri: "Adrián T.C.", jordi: "Jordi", eguz: "Eguzquiza" };
  const names = (id: string) => NAMES[id] ?? "?";
  const plays = [ev("g1", "goal", 6, "adri"), ev("r1", "opponent_goal", 11), ev("y1", "yellow_card", 15, "eguz")];
  const live: ClubMatch = { ...base, rivalInitials: "MSK", clock: started, events: plays };
  // 16:30 of play: football's 17′
  const at17 = DATE + 5 * MIN + 16 * MIN + 30_000;
  const view = (state: IslandState, now: number, more: Partial<Parameters<typeof islaVista>[0]> = {}) => islaVista({ state, now, moments: momentsOf(state.match, names), ...more });

  it("before kick-off: «vs», the time, and what each one asks", () => {
    const previa = view({ kind: "previa", match: base }, DATE - 28 * MIN);
    expect(previa).toMatchObject({ estado: "previa", pre: true, clock: "12:00", live: false, kicker: "Hoy a las 12:00, faltan 28 min", act: null, seg: false, hasPulse: false, unfold: false, aria: "Manchester Piti contra MAD SKY, hoy a las 12:00", say: "Hoy a las 12:00, Manchester Piti contra MAD SKY." });
    expect(previa.rotulo).toEqual({ m: "12:00", t: "HOY · PITI – MAD SKY", s: "En directo desde CDM Palomeras", tone: "" });
    expect(view({ kind: "previa", match: base }, DATE - 90 * MIN).kicker).toBe("Hoy a las 12:00, faltan 1 h 30 min");
    const rsvp = view({ kind: "rsvp", match: base }, DATE - 5 * 60 * MIN, { rsvp: { name: "Jordi", vienen: 3, duda: 1 } });
    expect(rsvp).toMatchObject({ estado: "rsvp", seg: true, unfold: true, say: "¿Vas hoy? Responde desde aquí." });
    expect(rsvp.rotulo).toMatchObject({ t: "¿VAS HOY, JORDI?", s: "Vienen 3 · 1 en duda" });
    const anot = view({ kind: "anotador", match: base }, DATE - 60 * MIN);
    expect(anot).toMatchObject({ estado: "anotador", act: { label: "Abrir la mesa", kind: "mesa" }, unfold: true, say: "Hoy anotas tú: la mesa del partido contra MAD SKY se abre desde aquí." });
    expect(anot.rotulo.t).toBe("HOY ANOTAS TÚ");
    const pend = view({ kind: "pending", match: base }, DATE + 2 * MIN);
    expect(pend).toMatchObject({ estado: "pendiente", clock: "12:00", kicker: "Pendiente del pitido inicial", say: "Manchester Piti contra MAD SKY: pendiente del pitido inicial." });
    expect(pend.rotulo).toMatchObject({ m: "12:02", t: "PENDIENTE DEL PITIDO" });
  });

  it("in play: the score, the minute and the dot; at rest the rótulo is the last play", () => {
    const v = view({ kind: "live", match: live }, at17);
    expect(v).toMatchObject({ estado: "enjuego", pre: false, gf: 1, ga: 1, ini: "MSK", clock: "17′", live: true, unfold: false, kicker: "En juego, 17′", aria: "Manchester Piti 1, MAD SKY 1, en juego, 17′" });
    expect(v.rotulo).toEqual({ m: "15′", t: "AMARILLA · EGUZQUIZA", s: "La última jugada", tone: "y" });
    expect(v.pulse).toEqual(pulseOf(momentsOf(live, names), 50));
    expect(v.pulse.map((p) => [p.ours, p.goal])).toEqual([
      [true, true],
      [false, true],
      [true, false],
    ]);
    const added = view({ kind: "live", match: { ...live, clock: { ...started, added: { 1: 2 } } } }, at17);
    expect(added.clock).toBe("17′+2");
    // a state just entered unfolds its rótulo too
    expect(view({ kind: "live", match: live }, at17, { entered: true }).unfold).toBe(true);
  });

  it("each play unfolds as its state: gol (gold, cortinilla), golrival (coral), tarjeta, roja, cambio, palo, parada", () => {
    const m: ClubMatch = { ...live, events: [...plays, ev("g2", "goal", 17, "adri")] };
    const v = view({ kind: "live", match: m }, at17, { moment: momentOf(m.events![3], m, names) });
    expect(v).toMatchObject({ estado: "gol", unfold: true, wipe: "g", changed: "h", gf: 2, say: "Gol del Piti, de Adrián T.C. Piti 2, MAD SKY 1" });
    expect(v.rotulo).toEqual({ m: "17′", t: "GOL · ADRIÁN T.C.", s: "2–1", tone: "gold" });
    const sub = { ...ev("c", "substitution", 16, "eguz"), inPlayerId: "jordi" } as MatchEvent;
    const kinds: [MatchEvent, string, string, string][] = [
      [ev("r", "opponent_goal", 16), "golrival", "rv", "rv"],
      [ev("y", "yellow_card", 16, "eguz"), "tarjeta", "y", ""],
      [ev("rr", "red_card", 16, "eguz"), "roja", "r", ""],
      [sub, "cambio", "", ""],
      [ev("w", "woodwork", 16, "adri"), "palo", "", ""],
      [ev("s", "penalty_saved", 16, "adri"), "parada", "", ""],
      [ev("i", "injury", 16, "adri"), "enjuego", "", ""],
    ];
    for (const [e, estado, tone, wipe] of kinds) {
      const mm = { ...live, events: [...plays, e] };
      const x = view({ kind: "live", match: mm }, at17, { moment: momentOf(e, mm, names) });
      expect([x.estado, x.rotulo.tone, x.wipe, x.unfold]).toEqual([estado, tone, wipe, true]);
    }
  });

  it("descanso, final, acta and mvp", () => {
    const halftime = transitionClock(started, "halftime", DATE + 30 * MIN);
    const d = view({ kind: "halftime", match: { ...live, clock: halftime } }, DATE + 32 * MIN);
    expect(d).toMatchObject({ estado: "descanso", clock: "Descanso", live: false, kicker: "Descanso", say: "Descanso. Piti 1, MAD SKY 1." });
    expect(d.rotulo.t).toBe("DESCANSO · 1–1");
    const fin: ClubMatch = { ...live, clock: ended };
    const f = view({ kind: "final", match: fin, published: false }, DATE + 70 * MIN);
    expect(f).toMatchObject({ estado: "final", clock: "Final", live: false, act: null, say: "Final. Piti 1, MAD SKY 1. Acta pendiente." });
    expect(f.rotulo).toMatchObject({ t: "FINAL · 1–1", s: "Acta pendiente: la mesa la está repasando" });
    const pub: ClubMatch = { ...fin, status: "finished", goalsFor: 2, goalsAgainst: 1, voteClosesAt: DATE + 70 * MIN + 48 * 60 * MIN };
    const a = view({ kind: "final", match: pub, published: true }, DATE + 70 * MIN);
    expect(a).toMatchObject({ estado: "acta", gf: 2, ga: 1, kicker: "Final, acta publicada", act: { label: "Ver el resumen", kind: "resumen" } });
    expect(a.rotulo).toMatchObject({ m: "2–1", t: "YA ESTÁ EL ACTA" });
    const v = view({ kind: "vote", match: pub }, DATE + 100 * MIN);
    expect(v).toMatchObject({ estado: "mvp", act: { label: "Votar al mejor", kind: "votar" }, say: "Ya puedes votar al mejor del partido contra MAD SKY." });
    expect(v.rotulo).toMatchObject({ m: "48 h", t: "VOTA AL MEJOR DEL PARTIDO", s: "Hasta el martes a las 13:10" });
  });

  it("sin conexión: a live score unconfirmed takes the bug over, struck clock, no dot", () => {
    const v = view({ kind: "live", match: live }, at17, { staleMinutes: 2 });
    expect(v).toMatchObject({ estado: "sinconexion", off: true, live: false, kicker: "Sin actualizar", say: "Marcador sin actualizar desde hace 2 minutos", unfold: false });
    expect(v.rotulo).toEqual({ m: "!", t: "MARCADOR SIN ACTUALIZAR", s: "Desde hace 2 min. Lo reintentamos solo", tone: "off" });
    // only while it's played
    expect(view({ kind: "previa", match: base }, DATE - MIN, { staleMinutes: 2 }).estado).toBe("previa");
  });
});
