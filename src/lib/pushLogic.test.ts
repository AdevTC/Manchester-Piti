import { describe, expect, it } from "vitest";
import { kickoffNotice, legacyKickoff, lineupNotice, noticesFor, TOPICS } from "../../functions/src/pushLogic";
import { matchSearchSchema } from "./matchTabs";

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
    // the final opens the first tab (the crónica); the vote opens the match's Vestuario tab
    expect(n.map((x) => x.url)).toEqual(["/matches/j7", "/matches/j7?tab=vestuario"]);
    const tab = new URL(n[1].url, "https://piti.test").searchParams.get("tab");
    expect(matchSearchSchema.parse({ tab }).tab).toBe("vestuario");
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

describe("«¡Empieza el partido!» follows the real clock", () => {
  const ready = { ...base, version: 2, clock: { phase: "ready" } };
  const running = { ...ready, clock: { phase: "first" } };
  it("ready → first sends the start notice, with the same tag as the legacy job", () => {
    expect(noticesFor("j8", ready, running, nameOf, NOW)).toEqual([kickoffNotice("j8", "MAD SKY")]);
    expect(kickoffNotice("j8", "MAD SKY").tag).toBe("start-j8");
    // a v2 match stored without a clock starts the same way (an absent clock is a ready one)
    expect(noticesFor("j8", { ...base, version: 2 }, running, nameOf, NOW).map((n) => n.topic)).toEqual(["start"]);
  });
  it("no start notice for any other clock move, a plain save, or an archived or finished match", () => {
    const at = (phase: string) => ({ ...ready, clock: { phase } });
    expect(noticesFor("j8", ready, ready, nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", running, at("halftime"), nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", at("halftime"), at("second"), nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", at("second"), at("ended"), nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", at("ended"), at("second"), nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", running, ready, nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", undefined, running, nameOf, NOW).filter((n) => n.topic === "start")).toEqual([]);
    expect(noticesFor("j8", ready, { ...running, archived: true }, nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", ready, { ...running, status: "cancelled" }, nameOf, NOW)).toEqual([]);
  });
  it("the scheduled job only notifies legacy matches without a clock", () => {
    expect(legacyKickoff(base)).toBe(true);
    expect(legacyKickoff(ready)).toBe(false);
    expect(legacyKickoff(running)).toBe(false);
    expect(legacyKickoff({ ...base, version: 2 })).toBe(false);
  });
});

describe("«Ya está el siete» (the official seven on the pizarra)", () => {
  const j8 = { rival: "MAD SKY", status: "scheduled", date: Date.UTC(2026, 10, 8, 11) };
  it("a board that becomes the official one for a match: the notice with the match, to the charla", () => {
    expect(lineupNotice("b1", { isOfficial: false, matchId: null }, { isOfficial: true, matchId: "j8" }, j8)).toEqual({
      topic: "lineup",
      title: "Ya está el siete",
      body: "Contra MAD SKY (domingo, 8 nov, 12:00): el capitán ya ha publicado el siete. Ábrelo y mira la charla.",
      tag: "lineup-b1-j8",
      url: "/pizarra?tablero=b1#charla",
    });
    expect(TOPICS).toContain("lineup");
  });
  it("the official for the whole season, and one whose match can't be read", () => {
    expect(lineupNotice("b2", undefined, { isOfficial: true, matchId: null }, null)).toMatchObject({
      body: "El capitán ya ha publicado el siete de la temporada. Ábrelo y mira la charla.",
      tag: "lineup-b2-temporada",
      url: "/pizarra?tablero=b2#charla",
    });
    expect(lineupNotice("b2", undefined, { isOfficial: true, matchId: "gone" }, undefined)?.body).toBe("El capitán ya ha publicado el siete del partido. Ábrelo y mira la charla.");
  });
  it("the notice opens the board in its own season", () => {
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j8", seasonId: "t2" }, j8)?.url).toBe("/pizarra?tablero=b1&season=t2#charla");
  });
  it("its alcance changes: a new notice (with its own tag); edits of an official that stays put: none", () => {
    const off = { isOfficial: true, matchId: "j8" };
    expect(lineupNotice("b1", off, { isOfficial: true, matchId: null }, null)?.tag).toBe("lineup-b1-temporada");
    expect(lineupNotice("b1", { isOfficial: true, matchId: null }, off, j8)?.tag).toBe("lineup-b1-j8");
    expect(lineupNotice("b1", off, { ...off }, j8)).toBeNull();
    expect(lineupNotice("b1", { isOfficial: true }, { isOfficial: true, matchId: null }, null)).toBeNull();
  });
  it("nothing for boards that are not official, unpublishing, deleting, or a match already over", () => {
    expect(lineupNotice("b1", undefined, { isOfficial: false, matchId: "j8" }, j8)).toBeNull();
    expect(lineupNotice("b1", { isOfficial: true, matchId: "j8" }, { isOfficial: false, matchId: "j8" }, j8)).toBeNull();
    expect(lineupNotice("b1", { isOfficial: true, matchId: "j8" }, undefined, j8)).toBeNull();
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j7" }, { ...j8, status: "finished" })).toBeNull();
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j7" }, { ...j8, status: "cancelled" })).toBeNull();
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j7" }, { ...j8, archived: true })).toBeNull();
  });
});
