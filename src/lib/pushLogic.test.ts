import { describe, expect, it } from "vitest";
import { kickoffNotice, noticesFor } from "../../functions/src/pushLogic";

const NOW = Date.UTC(2026, 10, 8, 11, 20);
const nameOf = (id: string) => ({ e: "ERIK", a: "ADRIÁN T.C." })[id] ?? "Jugador";
const base = { rival: "MAD SKY", status: "scheduled", date: Date.UTC(2026, 10, 8, 11) };
const g = (id: string, minute: number, playerId?: string, type = "goal") => ({ id, type, minute, playerId });

describe("push notices", () => {
  it("a goal written live: ours and theirs, with the score it leaves", () => {
    const before = { ...base, events: [g("r6", 6, undefined, "opponent_goal")] };
    const after = { ...base, events: [...before.events, g("live-1", 19, "e")] };
    expect(noticesFor("j8", before, after, nameOf, NOW)).toEqual([
      { topic: "goals", title: "¡GOL del Piti! 1–1", body: "ERIK, minuto 19 · Manchester Piti 1–1 MAD SKY", tag: "goal-j8", url: "/matches/j8" },
    ]);
    const rival = noticesFor("j8", after, { ...after, events: [...after.events, g("live-2", 30, undefined, "opponent_goal")] }, nameOf, NOW);
    expect(rival[0].title).toBe("Gol de MAD SKY. 1–2");
  });
  it("cards or substitutions don't notify; nothing for goals in a finished acta's edit", () => {
    const before = { ...base, events: [] };
    expect(noticesFor("j8", before, { ...base, events: [g("y", 22, "e", "yellow_card")] }, nameOf, NOW)).toEqual([]);
    const done = { ...base, status: "finished", goalsFor: 2, goalsAgainst: 1, events: [g("a", 1, "a")] };
    expect(noticesFor("j8", done, { ...done, events: [...done.events, g("b", 2, "a")] }, nameOf, NOW)).toEqual([]);
  });
  it("the final whistle, and the MVP vote while it's open", () => {
    const after = { ...base, status: "finished", goalsFor: 3, goalsAgainst: 1, voteClosesAt: NOW + 48 * 3600_000, events: [] };
    const n = noticesFor("j7", { ...base, events: [] }, after, nameOf, NOW);
    expect(n.map((x) => [x.topic, x.title])).toEqual([
      ["final", "Final: Manchester Piti 3–1 MAD SKY"],
      ["mvp", "Vota al MVP"],
    ]);
  });
  it("a new match or a new kick-off time, only when it's in the future", () => {
    const future = { rival: "EL CUARTEL CF", status: "scheduled", date: Date.UTC(2026, 10, 15, 10) };
    expect(noticesFor("j9", undefined, future, nameOf, NOW)[0]).toMatchObject({ topic: "dates", title: "Nuevo partido: EL CUARTEL CF", body: "Domingo, 15 nov, 11:00. Añádelo a tu calendario desde la web." });
    expect(noticesFor("j9", future, { ...future, date: future.date + 3600_000 }, nameOf, NOW)[0].title).toBe("Cambio de hora: EL CUARTEL CF");
    expect(noticesFor("j9", future, future, nameOf, NOW)).toEqual([]);
    expect(noticesFor("j0", undefined, { ...future, date: NOW - 1 }, nameOf, NOW)).toEqual([]);
  });
  it("archived matches never notify; kick-off notice", () => {
    expect(noticesFor("x", undefined, { ...base, date: NOW + 1e9, archived: true }, nameOf, NOW)).toEqual([]);
    expect(kickoffNotice("j8", "MAD SKY")).toMatchObject({ topic: "start", title: "¡Empieza el partido! Piti vs MAD SKY", url: "/matches/j8" });
  });
});
