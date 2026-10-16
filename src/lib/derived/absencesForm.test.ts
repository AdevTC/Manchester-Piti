import { describe, expect, it } from "vitest";
import { absenceFormProblem, absenceMatchCount, absenceSavedText, absenceSlots, absentBadge, matchDay, type Absence } from "./absences";

// «Mis ausencias»: the form's words, the count it reads after saving, and the «Ausente · hasta 19 oct»
// badges of Convocar and the convocatoria. Madrid calendar days throughout.
const abs = (extra: Partial<Absence>): Absence => ({ id: "a1", uid: "u1", playerId: "erik", name: "erik", from: "2026-10-12", to: "2026-10-19", note: "", createdAt: 1, ...extra });
const TODAY = "2026-10-15";

describe("absenceFormProblem", () => {
  it("says what is wrong, in the vestuario's words", () => {
    expect(absenceFormProblem("", "", TODAY)).toBe("Elige las dos fechas.");
    expect(absenceFormProblem("2026-10-20", "", TODAY)).toBe("Elige las dos fechas.");
    expect(absenceFormProblem("2026-10-20", "2026-10-18", TODAY)).toBe("La fecha final va después de la inicial.");
    // 120 days counting both ends is the most; 121 is not
    expect(absenceFormProblem("2026-10-20", "2027-02-16", TODAY)).toBeNull();
    expect(absenceFormProblem("2026-10-20", "2027-02-17", TODAY)).toBe("Como mucho 120 días.");
    expect(absenceFormProblem("2026-10-01", "2026-10-14", TODAY)).toBe("Esa fecha ya pasó.");
  });

  it("one day, today, or a range already under way can be saved", () => {
    expect(absenceFormProblem(TODAY, TODAY, TODAY)).toBeNull();
    expect(absenceFormProblem("2026-10-10", TODAY, TODAY)).toBeNull();
    expect(absenceFormProblem("2026-10-20", "2026-10-20", TODAY)).toBeNull();
  });
});

describe("the count after saving", () => {
  const NOW = Date.UTC(2026, 9, 15, 10);
  const matches = [
    { id: "in", status: "scheduled", date: Date.UTC(2026, 9, 18, 10) },
    // 23:30 Madrid on the 19th (21:30 UTC): still the 19th, inside
    { id: "late", status: "scheduled", date: Date.UTC(2026, 9, 19, 21, 30) },
    // 00:30 Madrid on the 20th (22:30 UTC the 19th): outside
    { id: "next-day", status: "scheduled", date: Date.UTC(2026, 9, 19, 22, 30) },
    { id: "cancelled", status: "cancelled", date: Date.UTC(2026, 9, 17, 10) },
    { id: "undated", status: "scheduled", date: undefined },
  ];
  const slots = absenceSlots(matches, (d) => (typeof d === "number" ? d : NaN));

  it("counts the answerable matches whose Madrid date is in the range", () => {
    expect(slots.find((s) => s.id === "undated")?.date).toBeNull();
    expect(absenceMatchCount(slots, { from: "2026-10-12", to: "2026-10-19" }, NOW)).toBe(2);
    expect(absenceMatchCount(slots, { from: "2026-10-20", to: "2026-10-20" }, NOW)).toBe(1);
    expect(absenceMatchCount(slots, { from: "2026-11-01", to: "2026-11-02" }, NOW)).toBe(0);
  });

  it("reads it back in words", () => {
    expect(absenceSavedText(2)).toBe("Guardada. Contestamos «No puedo» en 2 partidos.");
    expect(absenceSavedText(1)).toBe("Guardada. Contestamos «No puedo» en 1 partido.");
    expect(absenceSavedText(0)).toMatch(/^Guardada\. No hay partidos en esas fechas todavía/);
  });
});

describe("absentBadge", () => {
  const DAY = "2026-10-18";

  it("a «No puedo» an absence wrote: «Ausente · hasta» its end", () => {
    expect(absentBadge({ uid: "u1", playerId: "erik", response: "no", absenceId: "a1" }, [abs({})], DAY)).toBe("Ausente · hasta 19 oct");
  });

  it("a «No puedo» by hand on a day an absence of his covers (by uid or by ficha): the latest end", () => {
    const list = [abs({}), abs({ id: "a2", from: "2026-10-18", to: "2026-11-03" })];
    expect(absentBadge({ uid: "u1", playerId: null, response: "no" }, list, DAY)).toBe("Ausente · hasta 3 nov");
    expect(absentBadge({ uid: "other", playerId: "erik", response: "no" }, [abs({})], DAY)).toBe("Ausente · hasta 19 oct");
  });

  it("nothing on «Voy» or «Duda» (by hand over an absence), on another day, or on someone else", () => {
    expect(absentBadge({ uid: "u1", playerId: "erik", response: "yes" }, [abs({})], DAY)).toBeNull();
    expect(absentBadge({ uid: "u1", playerId: "erik", response: "maybe" }, [abs({})], DAY)).toBeNull();
    expect(absentBadge({ uid: "u1", playerId: "erik", response: "no" }, [abs({})], "2026-10-25")).toBeNull();
    expect(absentBadge({ uid: "u9", playerId: "adri", response: "no" }, [abs({})], DAY)).toBeNull();
    expect(absentBadge(undefined, [abs({})], DAY)).toBeNull();
  });

  it("an absence's answer whose absence isn't at hand: plain «Ausente»", () => {
    expect(absentBadge({ uid: "u1", playerId: "erik", response: "no", absenceId: "gone" }, [], DAY)).toBe("Ausente");
    expect(absentBadge({ uid: "u1", playerId: "erik", response: "no", absenceId: "" }, [], "")).toBe("Ausente");
  });

  it("matchDay: the Madrid date of a kick-off, none without one", () => {
    expect(matchDay(Date.UTC(2026, 9, 19, 21, 30))).toBe("2026-10-19");
    expect(matchDay(Date.UTC(2026, 9, 19, 22, 30))).toBe("2026-10-20");
    // the October DST change (25 Oct 2026): 23:30 Madrid is 22:30 UTC once it is winter time
    expect(matchDay(Date.UTC(2026, 9, 25, 22, 30))).toBe("2026-10-25");
    expect(matchDay(NaN)).toBe("");
  });
});
