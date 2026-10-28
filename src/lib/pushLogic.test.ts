import { describe, expect, it } from "vitest";
import { kickoffNotice, legacyKickoff, lineupNotice, noticesFor, TOPICS } from "../../functions/src/pushLogic";
import { resultLetter, resultTitle } from "./derived/result";

const NOW = Date.UTC(2026, 10, 8, 11, 20);
const nameOf = (id: string) => ({ e: "ERIK", a: "ADRIÁN T.C." })[id] ?? "Jugador";
const base = { rival: "MAD SKY", status: "scheduled", date: Date.UTC(2026, 10, 8, 11) };
const g = (id: string, minute: number, playerId?: string, type = "goal") => ({ id, type, minute, playerId });

describe("push notices", () => {
  it("a goal written live: ours and theirs, with the score it leaves", () => {
    const before = { ...base, events: [g("r6", 6, undefined, "opponent_goal")] };
    const after = { ...base, events: [...before.events, g("live-1", 19, "e")] };
    expect(noticesFor("j8", before, after, nameOf, NOW)).toEqual([
      {
        topic: "goals",
        title: "¡Gol de ERIK!",
        body: "Minuto 19. Piti 1, MAD SKY 1.",
        tag: "goal-j8",
        url: "/partidos/j8",
        log: "goal-j8-live-1",
        actions: [
          { action: "open", title: "Abrir el partido" },
          { action: "solo-goles", title: "Solo goles" },
        ],
        matchId: "j8",
      },
    ]);
    const rival = noticesFor("j8", after, { ...after, events: [...after.events, g("live-2", 30, undefined, "opponent_goal")] }, nameOf, NOW);
    expect(rival[0]).toMatchObject({ title: "Gol de MAD SKY", body: "Minuto 30. Piti 1, MAD SKY 2." });
  });
  it("the board's goal copy: the pass instead of the minute, a name that ends in a stop, the rival's own goal", () => {
    const before = { ...base, rival: "Orduña fc", events: [g("r1", 6, undefined, "opponent_goal"), g("o1", 9, "e")] };
    const pass = { ...g("x", 21, "a"), assistPlayerId: "e" };
    expect(noticesFor("j8", before, { ...before, events: [...before.events, pass] }, nameOf, NOW)[0]).toMatchObject({ title: "¡Gol de ADRIÁN T.C.!", body: "Pase de ERIK. Piti 2, Orduña fc 1." });
    const byAdrian = { ...g("y", 30, "e"), assistPlayerId: "a" };
    expect(noticesFor("j8", before, { ...before, events: [...before.events, byAdrian] }, nameOf, NOW)[0].body).toBe("Pase de ADRIÁN T.C. Piti 2, Orduña fc 1.");
    expect(noticesFor("j8", before, { ...before, events: [...before.events, g("z", 40, undefined, "opponent_own_goal")] }, nameOf, NOW)[0]).toMatchObject({ title: "¡Gol del Piti!", body: "En propia puerta de Orduña fc. Piti 2, Orduña fc 1." });
  });
  it("cards while it is played («Tarjetas», once each), never substitutions; nothing for goals in a finished acta's edit", () => {
    const before = { ...base, events: [] };
    expect(noticesFor("j8", before, { ...base, events: [g("y", 22, "e", "yellow_card")] }, nameOf, NOW)).toEqual([
      { topic: "cards", title: "Amarilla a ERIK", body: "Minuto 22. Piti 0, MAD SKY 0.", tag: "card-j8", url: "/partidos/j8", log: "card-j8-y" },
    ]);
    expect(noticesFor("j8", before, { ...base, events: [g("r", 50, undefined, "opponent_red")] }, nameOf, NOW)[0].title).toBe("Roja para MAD SKY");
    expect(noticesFor("j8", before, { ...base, events: [g("s", 30, "e", "substitution")] }, nameOf, NOW)).toEqual([]);
    // (a card already there says nothing again)
    const carded = { ...base, events: [g("y", 22, "e", "yellow_card")] };
    expect(noticesFor("j8", carded, { ...carded, events: [...carded.events, g("s", 30, "e", "substitution")] }, nameOf, NOW)).toEqual([]);
    const done = { ...base, status: "finished", goalsFor: 2, goalsAgainst: 1, events: [g("a", 1, "a")] };
    expect(noticesFor("j8", done, { ...done, events: [...done.events, g("b", 2, "a"), g("y2", 3, "a", "yellow_card")] }, nameOf, NOW)).toEqual([]);
  });
  it("the final whistle, and the MVP vote while it's open", () => {
    const after = { ...base, status: "finished", goalsFor: 3, goalsAgainst: 1, voteClosesAt: NOW + 48 * 3600_000, events: [] };
    const n = noticesFor("j7", { ...base, events: [] }, after, nameOf, NOW);
    expect(n.map((x) => [x.topic, x.title])).toEqual([
      ["final", "Final: Manchester Piti 3–1 MAD SKY"],
      ["mvp", "Vota al MVP"],
    ]);
    // the final opens the match page itself (the crónica); the vote opens its Vestuario screen
    expect(n.map((x) => x.url)).toEqual(["/partidos/j7", "/partidos/j7/vestuario"]);
  });
  it("the «Final» push opens with the verdict, the result's own word (resultTitle)", () => {
    const fin = (gf: number, ga: number) => noticesFor("j7", { ...base, events: [] }, { ...base, status: "finished", goalsFor: gf, goalsAgainst: ga, events: [] }, nameOf, NOW).find((x) => x.topic === "final")!;
    expect(fin(3, 1).body).toBe("Victoria. La crónica, los minutos y el pulso del partido ya están en la web.");
    expect(fin(2, 2).body.startsWith("Empate. ")).toBe(true);
    expect(fin(0, 1).body.startsWith("Derrota. ")).toBe(true);
    for (const [gf, ga] of [[3, 1], [2, 2], [0, 1]] as const) expect(fin(gf, ga).body.startsWith(resultTitle(resultLetter(gf, ga)) + ". ")).toBe(true);
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
    expect(kickoffNotice("j8", "MAD SKY")).toMatchObject({ topic: "start", title: "¡Empieza el partido! Piti vs MAD SKY", url: "/partidos/j8" });
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
    const kickoffs = (b: object, a: object) => noticesFor("j8", b, a, nameOf, NOW).filter((n) => n.log === "start-j8");
    expect(noticesFor("j8", ready, ready, nameOf, NOW)).toEqual([]);
    expect(kickoffs(running, at("halftime"))).toEqual([]);
    expect(kickoffs(at("halftime"), at("second"))).toEqual([]);
    expect(kickoffs(at("second"), at("ended"))).toEqual([]);
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
  it("a board that becomes the official one for a match: the notice with the match, to its Campo", () => {
    expect(lineupNotice("b1", { isOfficial: false, matchId: null }, { isOfficial: true, matchId: "j8" }, j8)).toEqual({
      topic: "lineup",
      title: "Ya está el siete",
      body: "Contra MAD SKY (domingo, 8 nov, 12:00): el capitán ya ha publicado el siete. Míralo en el partido.",
      tag: "lineup-b1-j8",
      url: "/partidos/j8/siete",
    });
    expect(TOPICS).toContain("lineup");
  });
  it("the official for the whole season, and one whose match can't be read", () => {
    expect(lineupNotice("b2", undefined, { isOfficial: true, matchId: null }, null)).toMatchObject({
      body: "El capitán ya ha publicado el siete de la temporada. Ábrelo y mira la charla.",
      tag: "lineup-b2-temporada",
      url: "/pizarra?tablero=b2#charla",
    });
    expect(lineupNotice("b2", undefined, { isOfficial: true, matchId: "gone" }, undefined)?.body).toBe("El capitán ya ha publicado el siete del partido. Míralo en el partido.");
  });
  it("the season's official opens the board in its own season; a match's, the match's Campo", () => {
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: null, seasonId: "t2" }, null)?.url).toBe("/pizarra?tablero=b1&season=t2#charla");
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j8", seasonId: "t2" }, j8)?.url).toBe("/partidos/j8/siete");
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
  it("PZ-B-PAR-03: nothing for a match already kicked off, past its hour or postponed", () => {
    const before8 = j8.date - 3600_000;
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j8" }, j8, before8)?.title).toBe("Ya está el siete");
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j8" }, j8, j8.date + 60_000)).toBeNull();
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j8" }, { ...j8, clock: { phase: "first" } }, before8)).toBeNull();
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j8" }, { ...j8, clock: { phase: "ended" } }, before8)).toBeNull();
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j8" }, { ...j8, liveEndedAt: before8 }, before8)).toBeNull();
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: "j8" }, { ...j8, status: "postponed" }, before8)).toBeNull();
    // (the season's official has no match: always news)
    expect(lineupNotice("b1", undefined, { isOfficial: true, matchId: null }, null, j8.date + 60_000)).not.toBeNull();
  });
});
