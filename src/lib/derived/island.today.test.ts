import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../functions/src/matchClock";
import type { MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../clubData";
import { FINAL_HOLD_MS, islandAnnouncement, islandOf, PREVIA_MS, todayMatch } from "./island";
import { whistleDeadline } from "./kickoff";

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
    expect(islandAnnouncement({ kind: "unplayed", match: base }, "pending")).toBe("Manchester Piti contra MAD SKY: pendiente del acta.");
    expect(islandAnnouncement({ kind: "vote", match: m }, "final")).toBe("Ya puedes votar al mejor del partido contra MAD SKY.");
  });
});

describe("«Pendiente del acta»", () => {
  it("a clock nobody started past its window: «unplayed» (no score) for as long as a final would show, never before", () => {
    const deadline = whistleDeadline(base);
    expect(islandOf([base], deadline - 1, false)?.kind).toBe("pending");
    expect(islandOf([base], deadline, false)).toEqual({ kind: "unplayed", match: base });
    expect(islandOf([base], deadline + FINAL_HOLD_MS - 1, false)?.kind).toBe("unplayed");
    expect(islandOf([base], deadline + FINAL_HOLD_MS, false)).toBeNull();
    // a real final comes first
    const fin: ClubMatch = { ...base, id: "f", clock: { ...ended, endedAt: deadline - 5 * MIN } };
    expect(islandOf([base, fin], deadline + MIN, false)?.kind).toBe("final");
  });
});
