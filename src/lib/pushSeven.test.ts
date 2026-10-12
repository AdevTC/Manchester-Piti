import { describe, expect, it } from "vitest";
import { PERSONAL_TOPICS, SEVEN_DEBOUNCE_MS, sevenChangeNotice, sevenChangeTxt, sevenDiff, sevenNewsworthy, sevenOf, sevenStep } from "../../functions/src/pushLogic";
import { HOUR, lateChangeNotice, reminderDue, reminderNotice, unanswered } from "../../functions/src/remindersLogic";

const NOW = Date.UTC(2026, 10, 6, 10);
const nameOf = (id: string) => id.toUpperCase();
const slots = (ids: (string | null)[]) => ids.map((playerId, i) => ({ slotId: "pz-slot-" + i, playerId }));

describe("«Cambio en el siete»", () => {
  it("the seven as stored: who is in each slot (nobody twice, malformed slots are nobody)", () => {
    expect(sevenOf(slots(["a", null, "b", "a"]))).toEqual(["a", "b"]);
    expect(sevenOf([{ playerId: 3 }, null, "x", { playerId: "c" }])).toEqual(["c"]);
    expect(sevenOf(undefined)).toEqual([]);
  });

  it("who comes in and who goes out, in words", () => {
    const d = sevenDiff(["a", "b", "c"], ["a", "c", "e"]);
    expect(d).toEqual({ ins: ["e"], outs: ["b"] });
    expect(sevenChangeTxt(d, nameOf)).toBe("entra E por B");
    expect(sevenChangeTxt(sevenDiff(["a", "b", "c"], ["a", "d", "e"]), nameOf)).toBe("entran D y E por B y C");
    expect(sevenChangeTxt(sevenDiff(["a", "b"], ["a"]), nameOf)).toBe("sale B");
    expect(sevenChangeTxt(sevenDiff(["a"], ["a", "b"]), nameOf)).toBe("entra B");
    // moved around, or changed back: nothing to say
    expect(sevenChangeTxt(sevenDiff(["a", "b"], ["b", "a"]), nameOf)).toBeNull();
  });

  it("the notice: to the «lineup» topic, one per board on the phone, with the link to the official", () => {
    const n = sevenChangeNotice("b1", ["a", "b"], ["a", "e"], { isOfficial: true, matchId: "m8", seasonId: "t 1" }, { rival: "MAD SKY", status: "scheduled", date: NOW + HOUR }, nameOf);
    expect(n).toEqual({
      topic: "lineup",
      title: "Cambio en el siete",
      body: "Entra E por B · contra MAD SKY. Mira el oficial en la pizarra.",
      tag: "seven-b1",
      url: "/pizarra?tablero=b1&season=t%201",
    });
    expect(sevenChangeNotice("b1", ["a", "b"], ["b", "a"], { isOfficial: true }, null, nameOf)).toBeNull();
  });

  it("only while it is news: an official of a match still to be played (or the season's)", () => {
    const off = { isOfficial: true, matchId: "m8" };
    expect(sevenNewsworthy(off, { status: "scheduled", date: NOW + HOUR }, NOW)).toBe(true);
    expect(sevenNewsworthy(off, { status: "scheduled", date: NOW - 1 }, NOW)).toBe(false);
    expect(sevenNewsworthy(off, { status: "finished" }, NOW)).toBe(false);
    expect(sevenNewsworthy(off, { status: "scheduled", archived: true }, NOW)).toBe(false);
    expect(sevenNewsworthy(off, null, NOW)).toBe(false);
    expect(sevenNewsworthy({ isOfficial: true, matchId: null }, null, NOW)).toBe(true);
    expect(sevenNewsworthy({ isOfficial: false, matchId: null }, null, NOW)).toBe(false);
  });

  it("at most one every 10 minutes per board: the first goes, the next ones wait for the job", () => {
    expect(sevenStep(null, NOW)).toBe("send");
    expect(sevenStep(NOW - SEVEN_DEBOUNCE_MS + 1, NOW)).toBe("hold");
    expect(sevenStep(NOW - SEVEN_DEBOUNCE_MS, NOW)).toBe("send");
  });
});

describe("la convocatoria que persigue sola", () => {
  it("the reminder due: 48 h before, then 24 h before, never in the last hour", () => {
    expect(reminderDue(NOW + 49 * HOUR, NOW)).toBeNull();
    expect(reminderDue(NOW + 48 * HOUR, NOW)).toBe("48");
    expect(reminderDue(NOW + 25 * HOUR, NOW)).toBe("48");
    expect(reminderDue(NOW + 24 * HOUR, NOW)).toBe("24");
    expect(reminderDue(NOW + 2 * HOUR, NOW)).toBe("24");
    expect(reminderDue(NOW + HOUR - 1, NOW)).toBeNull();
    expect(reminderDue(NOW - HOUR, NOW)).toBeNull();
  });

  it("who it chases: the convocados (siete then banquillo, once each) without an answer", () => {
    expect(unanswered(["a", "b", "c"], ["d", "a", ""], new Set(["b"]))).toEqual(["a", "c", "d"]);
    expect(unanswered([], [], new Set())).toEqual([]);
  });

  it("«¿Vas el domingo?»: personal, one per match on the phone, to the match's page", () => {
    // Sunday 8 Nov 2026, 12:00 in Madrid
    const date = Date.UTC(2026, 10, 8, 11);
    expect(PERSONAL_TOPICS).toContain("convocatoria");
    expect(reminderNotice("m8", "48", { rival: "MAD SKY", date })).toEqual({
      topic: "convocatoria",
      title: "¿Vas el domingo?",
      body: "Estás convocado contra MAD SKY (domingo, 12:00). Contesta en la web: Voy, Duda o No puedo.",
      tag: "remind-m8",
      url: "/matches/m8",
    });
    expect(reminderNotice("m8", "24", { date }).title).toBe("Mañana se juega: ¿vas?");
  });

  it("the captains hear of an answer changed in the last 24 h (not a first answer, not the same one)", () => {
    const m = { rival: "MAD SKY", date: NOW + 5 * HOUR };
    expect(lateChangeNotice("m8", "ERIK", "yes", "no", m, NOW)).toEqual({
      topic: "convocatoria",
      title: "Baja de última hora: ERIK",
      body: "ERIK ahora dice «No puedo» (antes «Voy») para el partido contra MAD SKY.",
      tag: "late-m8",
      url: "/matches/m8",
    });
    expect(lateChangeNotice("m8", "ERIK", "no", "maybe", m, NOW)?.title).toBe("Cambio de última hora: ERIK");
    expect(lateChangeNotice("m8", "ERIK", undefined, "no", m, NOW)).toBeNull();
    expect(lateChangeNotice("m8", "ERIK", "no", "no", m, NOW)).toBeNull();
    expect(lateChangeNotice("m8", "ERIK", "yes", "no", { ...m, date: NOW + 25 * HOUR }, NOW)).toBeNull();
    expect(lateChangeNotice("m8", "ERIK", "yes", "no", { ...m, date: NOW - 1 }, NOW)).toBeNull();
  });
});
