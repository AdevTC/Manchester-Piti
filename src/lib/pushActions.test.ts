import { describe, expect, it } from "vitest";
import { absenceNotice, convocatoriaMessage, convocatoriaNotice, kickoffNotice, lineupNotice, pushPayload, RSVP_ACTIONS } from "../../functions/src/pushLogic";
import { lateChangeNotice, reminderNotice } from "../../functions/src/remindersLogic";

// «Responder desde el aviso»: only the RSVP reminders (members only) carry «Voy» / «No puedo»; the
// convocatoria's notices go on the public `lineup` topic, and a fan must never see the buttons.
const NOW = Date.UTC(2026, 10, 2, 9, 0);
const HOUR = 3_600_000;
const match = { rival: "MAD SKY", status: "scheduled", date: NOW + 48 * HOUR, seasonId: "t1" };
const BUTTONS = [
  { action: "yes", title: "Voy" },
  { action: "no", title: "No puedo" },
];

describe("the members' reminders carry the buttons", () => {
  it("the reminders to who hasn't answered (48 h and 24 h): Voy / No puedo, with its match", () => {
    for (const kind of ["48", "24"] as const) {
      const n = reminderNotice("m8", kind, { rival: "MAD SKY", date: match.date });
      expect(n.topic).toBe("convocatoria");
      expect(n.actions).toEqual(BUTTONS);
      expect(n.matchId).toBe("m8");
    }
  });

  it("two buttons, «Duda» stays in the web", () => {
    expect(RSVP_ACTIONS.map((a) => a.action)).toEqual(["yes", "no"]);
  });
});

describe("the rest carry none", () => {
  it("the convocatoria's notices, public (fans get them too): «Ya está la convocatoria» and «Cambios»", () => {
    for (const n of [
      convocatoriaMessage("m8", "first", match, 8),
      convocatoriaMessage("m8", "changes", match, 8),
      convocatoriaNotice("m8", { ...match, starters: [] }, { ...match, starters: ["a"] }, 8, NOW)!,
    ]) {
      expect(n.topic).toBe("lineup");
      expect(n.actions).toBeUndefined();
      expect(n.matchId).toBeUndefined();
    }
  });

  it("the captains' notices: late changes and absences", () => {
    const late = lateChangeNotice("m8", "ERIK", "yes", "no", { rival: "MAD SKY", date: NOW + 5 * HOUR }, NOW);
    expect(late?.actions).toBeUndefined();
    const absence = absenceNotice({ id: "a1", from: "2026-11-07", to: "2026-11-09" }, "ERIK", [{ id: "m8" }]);
    expect(absence.actions).toBeUndefined();
  });

  it("the match's news («Ya está el siete», the kick-off)", () => {
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "m8" }, match)?.actions).toBeUndefined();
    expect(kickoffNotice("m8", "MAD SKY").actions).toBeUndefined();
  });
});

describe("the payload the phone gets (push.ts sendTo)", () => {
  it("the buttons and their match travel with the reminders", () => {
    const n = reminderNotice("m8", "24", { rival: "MAD SKY", date: match.date });
    expect(pushPayload(n)).toEqual({ title: n.title, body: n.body, tag: "remind-m8", url: "/partidos/m8/vestuario", actions: BUTTONS, matchId: "m8" });
    expect(JSON.parse(JSON.stringify(pushPayload(reminderNotice("m8", "48", { date: match.date }))))).toMatchObject({ actions: BUTTONS, matchId: "m8" });
  });

  it("the rest send only their words, tag and link (no log or topic either)", () => {
    for (const kind of ["first", "changes"] as const) {
      const n = convocatoriaMessage("m8", kind, match, 8);
      expect(pushPayload(n)).toEqual({ title: n.title, body: n.body, tag: "conv-m8", url: "/partidos/m8" });
    }
    expect(Object.keys(pushPayload(kickoffNotice("m8", "MAD SKY")))).toEqual(["title", "body", "tag", "url"]);
  });

  it("buttons without their match are left out (nothing to answer)", () => {
    expect(pushPayload({ title: "t", body: "b", tag: "x", url: "/", actions: RSVP_ACTIONS })).toEqual({ title: "t", body: "b", tag: "x", url: "/" });
  });
});
