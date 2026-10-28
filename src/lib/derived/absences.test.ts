import { describe, expect, it } from "vitest";
import { absenceNotice } from "../../../functions/src/pushLogic";
import {
  ABSENCE_MAX_DAYS,
  absenceAvailabilityPlan,
  absenceDays,
  absenceFields,
  absenceNoticeDue,
  absenceOn,
  absenceRangeProblem,
  absenceRangeText,
  absenceUntilText,
  currentAbsences,
  madridDate,
  matchesInRange,
  parseAbsence,
  type Absence,
  type ExistingAnswer,
  type MatchSlot,
} from "./absences";

const NOW = Date.UTC(2026, 9, 1, 10);
/** An instant given as Madrid wall time with its UTC offset that day (+2 summer, +1 winter). */
const madrid = (iso: string, offset: 1 | 2) => Date.parse(`${iso}:00+0${offset}:00`);
const abs = (o: Partial<Absence> = {}): Absence => ({ id: "a1", uid: "u1", playerId: "p1", name: "pepe", from: "2026-10-12", to: "2026-10-19", note: "", createdAt: 1, ...o });
const match = (id: string, date: number | null, status = "scheduled"): MatchSlot => ({ id, date, status });
const answer = (matchId: string, uid: string, doc: ExistingAnswer["doc"]): ExistingAnswer => ({ matchId, uid, doc });
const fromAbsence = (absenceId = "a1") => ({ response: "no", source: "absence", absenceId });

describe("Madrid calendar days", () => {
  it("a match late at night is still its Madrid day, either side of the October DST change", () => {
    // Sat 24 Oct 23:30 (CEST) and Sun 25 Oct 00:30 (CEST, still before 03:00)
    expect(madridDate(madrid("2026-10-24T23:30", 2))).toBe("2026-10-24");
    expect(madridDate(madrid("2026-10-25T00:30", 2))).toBe("2026-10-25");
    // Sun 25 Oct 23:30 (CET now): in UTC it is 22:30 the same day; Mon 26 Oct 00:30 is still the 25th in UTC
    expect(madridDate(madrid("2026-10-25T23:30", 1))).toBe("2026-10-25");
    expect(madridDate(madrid("2026-10-26T00:30", 1))).toBe("2026-10-26");
  });
  it("counts calendar days, both ends, never shortened by a DST change", () => {
    expect(absenceDays("2026-10-12", "2026-10-19")).toBe(8);
    expect(absenceDays("2026-10-20", "2026-10-30")).toBe(11);
    expect(absenceDays("2026-03-25", "2026-03-31")).toBe(7);
    expect(absenceDays("2026-10-12", "2026-10-12")).toBe(1);
    expect(absenceDays("2026-02-30", "2026-03-01")).toBeNaN();
  });
  it("an absence is one to 120 days of real dates", () => {
    expect(absenceRangeProblem("2026-10-01", "2027-01-28")).toBeNull();
    expect(absenceDays("2026-10-01", "2027-01-28")).toBe(ABSENCE_MAX_DAYS);
    expect(absenceRangeProblem("2026-10-01", "2027-01-29")).toBe("Como mucho 120 días.");
    expect(absenceRangeProblem("2026-10-19", "2026-10-12")).toBe("La fecha final va después de la inicial.");
    expect(absenceRangeProblem("", "2026-10-12")).toBe("Elige las dos fechas.");
    expect(absenceRangeProblem("2026-13-01", "2026-13-02")).toBe("Elige las dos fechas.");
  });
});

describe("matchesInRange", () => {
  it("the scheduled matches still to play whose Madrid day is in the range, soonest first", () => {
    const now = madrid("2026-10-12T12:00", 2);
    const ms = [
      match("late19", madrid("2026-10-19T23:30", 2)),
      match("late11", madrid("2026-10-11T23:30", 2)),
      match("early20", madrid("2026-10-20T00:30", 2)),
      match("in", madrid("2026-10-14T20:00", 2)),
      match("called-off", madrid("2026-10-15T20:00", 2), "cancelled"),
      match("kicked-off", madrid("2026-10-12T10:00", 2)),
      match("undated", null),
    ];
    expect(matchesInRange(ms, abs(), now).map((m) => m.id)).toEqual(["in", "late19"]);
  });
  it("across the DST change: the 25th covers 00:30 and 23:30 of the 25th, not 23:30 of the 24th", () => {
    const ms = [match("sat", madrid("2026-10-24T23:30", 2)), match("sun-early", madrid("2026-10-25T00:30", 2)), match("sun-late", madrid("2026-10-25T23:30", 1))];
    expect(matchesInRange(ms, { from: "2026-10-25", to: "2026-10-25" }, NOW).map((m) => m.id)).toEqual(["sun-early", "sun-late"]);
  });
});

describe("absenceAvailabilityPlan", () => {
  const d = (day: number) => madrid(`2026-10-${String(day).padStart(2, "0")}T20:00`, day >= 25 ? 1 : 2);
  const ms = [match("m13", d(13)), match("m14", d(14)), match("m25", d(25)), match("off15", d(15), "cancelled")];
  const no = (matchId: string, absenceId = "a1", uid = "u1") => ({ matchId, uid, data: { response: "no", name: "pepe", playerId: "p1", source: "absence", absenceId } });

  it("an absence just created answers «No puedo» on its matches, over a hand answer too (the newer intent)", () => {
    const plan = absenceAvailabilityPlan({ absences: [abs()], matches: ms, existing: [answer("m13", "u1", { response: "yes" })], fresh: "a1", now: NOW });
    expect(plan.writes).toEqual([no("m13"), no("m14")]);
    expect(plan.deletes).toEqual([]);
  });
  it("a hand answer given before the fresh absence (or with no time) is overwritten", () => {
    const a = abs({ createdAt: 5_000 });
    const plan = absenceAvailabilityPlan({ absences: [a], matches: ms, existing: [answer("m13", "u1", { response: "yes", at: { toMillis: () => 4_000 } }), answer("m14", "u1", { response: "maybe" })], fresh: "a1", now: NOW });
    expect(plan.writes).toEqual([no("m13"), no("m14")]);
  });
  it("a hand answer given after the fresh absence stays: a late or repeated create event never undoes a «Voy»", () => {
    const a = abs({ createdAt: 5_000 });
    const plan = absenceAvailabilityPlan({ absences: [a], matches: ms, existing: [answer("m13", "u1", { response: "yes", at: { toMillis: () => 6_000 } }), answer("m14", "u1", { response: "maybe", at: 5_000 })], fresh: "a1", now: NOW });
    expect(plan).toEqual({ writes: [], deletes: [] });
  });
  it("a fresh absence without a known createdAt (still pending) never overwrites a hand answer, only fills the blanks", () => {
    const plan = absenceAvailabilityPlan({ absences: [abs({ createdAt: 0 })], matches: ms, existing: [answer("m13", "u1", { response: "yes" })], fresh: "a1", now: NOW });
    expect(plan.writes).toEqual([no("m14")]);
  });
  it("is idempotent: the answers it wrote stay as they are", () => {
    const plan = absenceAvailabilityPlan({ absences: [abs()], matches: ms, existing: [answer("m13", "u1", fromAbsence()), answer("m14", "u1", fromAbsence())], fresh: "a1", now: NOW });
    expect(plan).toEqual({ writes: [], deletes: [] });
  });
  it("deleted: only its own answers go; the ones the member changed by hand stay", () => {
    const plan = absenceAvailabilityPlan({ absences: [], matches: ms, existing: [answer("m13", "u1", fromAbsence()), answer("m14", "u1", { response: "maybe" })], now: NOW });
    expect(plan).toEqual({ writes: [], deletes: [{ matchId: "m13", uid: "u1" }] });
  });
  it("deleted while another absence still covers the match: it passes to that one", () => {
    const other = abs({ id: "a2", from: "2026-10-13", to: "2026-10-13" });
    const plan = absenceAvailabilityPlan({ absences: [other], matches: ms, existing: [answer("m13", "u1", fromAbsence("a1")), answer("m14", "u1", fromAbsence("a1"))], now: NOW });
    expect(plan.writes).toEqual([no("m13", "a2")]);
    expect(plan.deletes).toEqual([{ matchId: "m14", uid: "u1" }]);
  });
  it("a second absence over the same match leaves the first one's answer alone", () => {
    const other = abs({ id: "a2", from: "2026-10-13", to: "2026-10-13" });
    const plan = absenceAvailabilityPlan({ absences: [abs(), other], matches: ms, existing: [answer("m13", "u1", fromAbsence("a1")), answer("m14", "u1", fromAbsence("a1"))], fresh: "a2", now: NOW });
    expect(plan).toEqual({ writes: [], deletes: [] });
  });
  it("a match published or moved into a range: «No puedo» only for who hasn't answered", () => {
    const ana = abs({ id: "b1", uid: "u2", name: "ana", playerId: null });
    const plan = absenceAvailabilityPlan({ absences: [abs(), ana], matches: [match("new", d(16))], existing: [answer("new", "u2", { response: "yes" }), answer("new", "u3", { response: "no" })], now: NOW });
    expect(plan.writes).toEqual([no("new")]);
    expect(plan.deletes).toEqual([]);
  });
  it("a match moved out of the range takes back the absence's answer, not the hand ones", () => {
    const plan = absenceAvailabilityPlan({ absences: [], matches: [match("m25", d(25))], existing: [answer("m25", "u1", fromAbsence()), answer("m25", "u2", { response: "no" })], now: NOW });
    expect(plan).toEqual({ writes: [], deletes: [{ matchId: "m25", uid: "u1" }] });
  });
  it("never touches a match already kicked off or called off", () => {
    const now = d(14) + 60_000;
    const plan = absenceAvailabilityPlan({ absences: [], matches: [match("m13", d(13)), match("off15", d(15), "cancelled")], existing: [answer("m13", "u1", fromAbsence()), answer("off15", "u1", fromAbsence())], now });
    expect(plan).toEqual({ writes: [], deletes: [] });
  });
});

describe("the captains' notice", () => {
  const now = madrid("2026-10-15T12:00", 2);
  it("goes for an absence the trigger still saw, ending today or later", () => {
    expect(absenceNoticeDue(abs({ to: "2026-10-19" }), true, now)).toBe(true);
    expect(absenceNoticeDue(abs({ to: "2026-10-15" }), true, now)).toBe(true);
  });
  it("not for one deleted before the trigger ran, nor one entirely past", () => {
    expect(absenceNoticeDue(abs({ to: "2026-10-19" }), false, now)).toBe(false);
    expect(absenceNoticeDue(abs({ to: "2026-10-14" }), true, now)).toBe(false);
  });
  it("r12: not for one a captain wrote for the member from la Sala (`by`); his own `by` is still his", () => {
    expect(absenceNoticeDue({ ...abs({ to: "2026-10-19" }), by: "capi" }, true, now)).toBe(false);
    expect(absenceNoticeDue({ ...abs({ to: "2026-10-19" }), by: abs({}).uid }, true, now)).toBe(true);
  });
});

describe("reading and writing absences", () => {
  it("parses a valid doc and refuses the rest", () => {
    const doc = { uid: "u1", playerId: "p1", name: "pepe", from: "2026-10-12", to: "2026-10-19", note: "Boda", createdAt: { toMillis: () => 5 } };
    expect(parseAbsence("a1", doc)).toEqual({ id: "a1", ...doc, createdAt: 5 });
    expect(parseAbsence("a1", { ...doc, note: undefined, playerId: null })).toMatchObject({ note: "", playerId: null });
    expect(parseAbsence("a1", { ...doc, to: "2026-10-11" })).toBeNull();
    expect(parseAbsence("a1", { ...doc, uid: "" })).toBeNull();
    expect(parseAbsence("a1", null)).toBeNull();
    // (r12: the captain who wrote it, when one did; the old docs carry none)
    expect(parseAbsence("a1", { ...doc, by: "capi" })).toMatchObject({ by: "capi" });
    expect(parseAbsence("a1", doc)).not.toHaveProperty("by");
  });
  it("writes the fields the rules expect: the note only when there is one", () => {
    const me = { uid: "u1", name: "pepe", playerId: null };
    expect(absenceFields(me, "2026-10-12", "2026-10-19")).toEqual({ uid: "u1", playerId: null, name: "pepe", from: "2026-10-12", to: "2026-10-19" });
    expect(absenceFields(me, "2026-10-12", "2026-10-19", "  Boda en Cuenca ")).toMatchObject({ note: "Boda en Cuenca" });
    expect(absenceFields(me, "2026-10-12", "2026-10-19", "x".repeat(200)).note).toHaveLength(140);
  });
  it("current absences and the badge's one", () => {
    const list = [abs({ id: "old", from: "2026-09-01", to: "2026-09-05" }), abs({ id: "b", from: "2026-10-14", to: "2026-10-30" }), abs()];
    expect(currentAbsences(list, "2026-10-13").map((a) => a.id)).toEqual(["a1", "b"]);
    expect(absenceOn(list, { playerId: "p1" }, "2026-10-15")?.id).toBe("b");
    expect(absenceOn(list, { uid: "u1" }, "2026-10-12")?.id).toBe("a1");
    expect(absenceOn(list, { uid: "u2", playerId: "p2" }, "2026-10-15")).toBeNull();
  });
});

describe("in words", () => {
  it("the range, as people say it", () => {
    expect(absenceRangeText("2026-10-12", "2026-10-19")).toBe("del 12 al 19 oct");
    expect(absenceRangeText("2026-10-12", "2026-10-12")).toBe("el 12 oct");
    expect(absenceRangeText("2026-10-28", "2026-11-03")).toBe("del 28 oct al 3 nov");
    expect(absenceRangeText("2026-12-28", "2027-01-03")).toBe("del 28 dic 2026 al 3 ene 2027");
    expect(absenceUntilText("2026-10-19")).toBe("hasta 19 oct");
  });
  it("the captains' one notice: «NOMBRE no puede del 12 al 19 oct (2 partidos)», once per absence", () => {
    const n = absenceNotice(abs({ note: "Boda" }), "PEPE", [{ id: "m13" }, { id: "m14" }]);
    expect(n).toMatchObject({ topic: "convocatoria", title: "PEPE no puede del 12 al 19 oct (2 partidos)", tag: "absence-a1", log: "absence-a1", url: "/partidos/m13/vestuario" });
    expect(n.body).toBe("«Boda». Ya sale como «No puedo» en la convocatoria.");
    expect(absenceNotice(abs(), "PEPE", [{ id: "m13" }]).title).toBe("PEPE no puede del 12 al 19 oct (1 partido)");
    const none = absenceNotice(abs(), "@pepe", []);
    expect(none.title).toBe("@pepe no puede del 12 al 19 oct");
    expect(none.url).toBe("/vestuario");
  });
});
