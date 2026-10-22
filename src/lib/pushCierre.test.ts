// The backend's new notices and stamps of the Vidrio cierre (pure parts): a device's payload («Vibrar con
// los goles», «Solo goles»), the postponement and its new date, «Ya la he pagado», «Turno hecho», the .ics
// slot of an aplazado and when the weather at kick-off is owed.
import { describe, expect, it } from "vitest";
import { cajaClaimNotice, devicePayload, GOAL_ACTIONS, noticesFor, postponedNotices, turnDoneNotice, type Notice } from "../../functions/src/pushLogic";
import { calendarSlot } from "../../functions/src/calendarLogic";
import { weatherStampDue } from "../../functions/src/weatherLogic";

const NOW = Date.UTC(2026, 10, 8, 11, 20);
const goal: Notice = { topic: "goals", title: "¡Gol de ERIK!", body: "Minuto 3. Piti 1, MAD SKY 0.", tag: "goal-m1", url: "/partidos/m1", log: "goal-m1-e1", actions: GOAL_ACTIONS, matchId: "m1" };

describe("a device's payload", () => {
  it("a goal carries its buttons, and vibrates on a device that asked", () => {
    expect(devicePayload(goal, {})).toEqual({ title: goal.title, body: goal.body, tag: "goal-m1", url: "/partidos/m1", actions: GOAL_ACTIONS, matchId: "m1" });
    expect(devicePayload(goal, { vibrate: true })).toMatchObject({ vibrate: true });
    expect(devicePayload({ ...goal, topic: "final", actions: undefined, matchId: undefined }, { vibrate: true })).not.toHaveProperty("vibrate");
  });
  it("«Solo goles» is left out on a device already there", () => {
    expect(devicePayload(goal, { preset: "goles" }).actions).toEqual([{ action: "open", title: "Abrir el partido" }]);
  });
  it("and on one that only chose this match's avisos (its worker has nothing to call)", () => {
    expect(devicePayload(goal, { preset: "nada" }).actions).toEqual([{ action: "open", title: "Abrir el partido" }]);
    expect(devicePayload(goal, { preset: "custom" }).actions).toEqual(GOAL_ACTIONS);
  });
});

describe("aplazado and its new date (topic dates)", () => {
  const base = { rival: "Orduña fc", status: "scheduled", date: NOW + 86_400_000 };
  it("«Aplazado: …» with its reason, the new date when it already has one", () => {
    const after = { ...base, status: "postponed", postponedReason: "Campo inundado" };
    expect(postponedNotices("m1", base, after, NOW)).toEqual([
      { topic: "dates", title: "Aplazado: Orduña fc", body: "Campo inundado. La nueva fecha, por decidir.", tag: "date-m1", url: "/partidos/m1", log: `postponed-m1-${base.date}` },
    ]);
    const dated = postponedNotices("m1", base, { ...after, postponedTo: Date.UTC(2026, 10, 15, 11) }, NOW)[0];
    expect(dated.body).toBe("Campo inundado. Nueva fecha: Domingo, 15 nov, 12:00.");
  });
  it("«Nueva fecha: …» when a postponed match gets (or changes) its date, once per date", () => {
    const was = { ...base, status: "postponed", postponedReason: "Campo inundado", postponedTo: null };
    const to = Date.UTC(2026, 10, 15, 11);
    expect(postponedNotices("m1", was, { ...was, postponedTo: to }, NOW)).toEqual([
      { topic: "dates", title: "Nueva fecha: Orduña fc", body: "Domingo, 15 nov, 12:00. Campo inundado. Añádelo a tu calendario desde la web.", tag: "date-m1", url: "/partidos/m1", log: `rescheduled-m1-${to}` },
    ]);
    expect(postponedNotices("m1", { ...was, postponedTo: to }, { ...was, postponedTo: to }, NOW)).toEqual([]);
    expect(postponedNotices("m1", was, { ...was, postponedTo: NOW - 1 }, NOW)).toEqual([]);
    expect(postponedNotices("m1", base, base, NOW)).toEqual([]);
  });
  it("comes out of noticesFor too", () => {
    expect(noticesFor("m1", base, { ...base, status: "postponed" }, () => "", NOW).map((n) => n.title)).toEqual(["Aplazado: Orduña fc"]);
  });
});

describe("the captains' personal notices", () => {
  it("«Pago avisado: ERIK»", () => {
    const n = cajaClaimNotice("c1", { amount: 2500, concept: "Cuota octubre" }, "ERIK");
    expect({ ...n, body: n.body.replace(/\s/g, " ") }).toEqual({ topic: "personal", title: "Pago avisado: ERIK", body: "25,00 € · Cuota octubre. Confírmalo en La caja.", tag: "cajaclaim-c1", url: "/admin/caja", log: "cajaclaim-c1" });
  });
  it("«Turno hecho: ERIK»", () => {
    expect(turnDoneNotice("m1", "u1", "ERIK", ["Lavar la equipación"], "Orduña fc")).toMatchObject({ title: "Turno hecho: ERIK", body: "Lavar la equipación · contra Orduña fc.", log: "turno-done-m1-u1" });
  });
});

describe("the .ics slot", () => {
  const date = Date.UTC(2026, 10, 8, 11);
  it("an aplazado moves to its new date, or stays tentative", () => {
    expect(calendarSlot({ date, status: "postponed", postponedTo: { toMillis: () => date + 7 * 86_400_000 }, postponedReason: "Lluvia" })).toEqual({ start: date + 7 * 86_400_000, status: "CONFIRMED", prefix: "", note: "Aplazado: Lluvia. Nueva fecha." });
    expect(calendarSlot({ date, status: "postponed", postponedTo: null })).toEqual({ start: date, status: "TENTATIVE", prefix: "Aplazado · ", note: "Nueva fecha por decidir." });
    expect(calendarSlot({ date: { toMillis: () => date }, status: "scheduled" })).toEqual({ start: date, status: "CONFIRMED", prefix: "", note: "" });
    expect(calendarSlot({ status: "scheduled" })).toBeNull();
  });
});

describe("the weather at kick-off is owed", () => {
  it("by a published acta kicked off in the past, without its stamp", () => {
    expect(weatherStampDue({ status: "finished", date: { toMillis: () => NOW - 1 } }, NOW)).toBe(NOW - 1);
    expect(weatherStampDue({ status: "finished", date: NOW - 1, weatherAtKickoff: { temp: 1 } }, NOW)).toBeNull();
    expect(weatherStampDue({ status: "scheduled", date: NOW - 1 }, NOW)).toBeNull();
    expect(weatherStampDue({ status: "finished", date: NOW + 1 }, NOW)).toBeNull();
    expect(weatherStampDue({ status: "finished", date: NOW - 1, archived: true }, NOW)).toBeNull();
  });
});
