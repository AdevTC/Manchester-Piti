// The push notices of the whole match (functions/src/pushLogic.ts): the clock's whistles, «Gol anulado»,
// the MVP's winner, the personal notices, and the pushLog ids that keep each one to a single send.
import { describe, expect, it } from "vitest";
import { claimNotice, kickoffNotice, mvpWinnerIds, mvpWinnerNotice, noticesFor, positionsNotice } from "../../functions/src/pushLogic";
import { mvpWinners } from "./vestuario";
import type { ClubMatch } from "./clubData";

const NOW = Date.UTC(2026, 10, 8, 11, 20);
const nameOf = (id: string) => ({ e: "ERIK", a: "ADRIÁN T.C." })[id] ?? "Jugador";
const base = { rival: "MAD SKY", status: "scheduled", date: Date.UTC(2026, 10, 8, 11) };
const g = (id: string, minute: number, playerId?: string, type = "goal") => ({ id, type, minute, playerId });

describe("the clock's whistles: descanso, 2ª parte and the provisional final", () => {
  const live = { ...base, version: 2, events: [g("a", 12, "e"), g("b", 20, undefined, "opponent_goal"), g("c", 28, "a")] };
  const at = (phase: string) => ({ ...live, clock: { phase } });
  it("first → halftime: «Descanso · 2–1», once per match, with the kick-off's tag", () => {
    expect(noticesFor("j8", at("first"), at("halftime"), nameOf, NOW)).toEqual([
      { topic: "start", title: "Descanso · 2–1", body: "Manchester Piti 2–1 MAD SKY. Sigue el directo en la web.", tag: "start-j8", url: "/matches/j8", log: "half-j8" },
    ]);
  });
  it("halftime → second: «Arranca la 2ª parte»", () => {
    expect(noticesFor("j8", at("halftime"), at("second"), nameOf, NOW)).toEqual([
      { topic: "start", title: "Arranca la 2ª parte", body: "Manchester Piti 2–1 MAD SKY. Sigue el directo en la web.", tag: "start-j8", url: "/matches/j8", log: "second-j8" },
    ]);
  });
  it("→ ended: «Final (provisional) · 2–1», with the acta's «Final» tag so the official one replaces it", () => {
    const provisional = noticesFor("j8", at("second"), at("ended"), nameOf, NOW);
    expect(provisional).toEqual([
      { topic: "final", title: "Final (provisional) · 2–1", body: "Manchester Piti 2–1 MAD SKY. El resultado oficial llega con el acta del capitán.", tag: "final-j8", url: "/matches/j8", log: "final-live-j8" },
    ]);
    // ended straight from the 1ª parte too (a match cut short)
    expect(noticesFor("j8", at("first"), at("ended"), nameOf, NOW).map((n) => n.log)).toEqual(["final-live-j8"]);
    const acta = noticesFor("j8", at("ended"), { ...at("ended"), status: "finished", goalsFor: 2, goalsAgainst: 1 }, nameOf, NOW).find((n) => n.topic === "final");
    expect(acta).toMatchObject({ title: "Final: Manchester Piti 2–1 MAD SKY", tag: provisional[0].tag, log: "final-j8" });
  });
  it("an undone whistle blown again keeps its pushLog id: push.ts sends it once", () => {
    const first = noticesFor("j8", at("first"), at("halftime"), nameOf, NOW);
    expect(noticesFor("j8", at("halftime"), at("first"), nameOf, NOW)).toEqual([]);
    const again = noticesFor("j8", at("first"), { ...at("halftime"), events: [...live.events, g("d", 31, "e")] }, nameOf, NOW).find((n) => n.topic === "start");
    expect(again?.log).toBe(first[0].log);
    expect(noticesFor("j8", at("ended"), at("second"), nameOf, NOW)).toEqual([]);
    const reEnded = noticesFor("j8", at("second"), at("ended"), nameOf, NOW);
    expect(reEnded[0].log).toBe("final-live-j8");
  });
  it("nothing for undoing a whistle, a plain save, legacy matches without a clock, a new doc, or a finished acta", () => {
    expect(noticesFor("j8", at("second"), at("halftime"), nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", at("halftime"), at("halftime"), nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", { ...base, events: [] }, { ...base, events: [] }, nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", undefined, at("halftime"), nameOf, NOW).filter((n) => n.topic !== "goals")).toEqual([]);
    const done = { ...at("second"), status: "finished", goalsFor: 2, goalsAgainst: 1 };
    expect(noticesFor("j8", done, { ...done, clock: { phase: "ended" } }, nameOf, NOW)).toEqual([]);
    expect(noticesFor("j8", at("first"), { ...at("halftime"), archived: true }, nameOf, NOW)).toEqual([]);
  });
});

describe("«Gol anulado»", () => {
  const live = { ...base, version: 2, clock: { phase: "first" }, events: [g("r1", 6, undefined, "opponent_goal"), g("e1", 19, "e")] };
  it("a pushed goal undone live: same goal tag (it replaces the «¡GOL!»), only if its own pushLog exists", () => {
    const undone = { ...live, events: live.events.slice(0, 1) };
    expect(noticesFor("j8", live, undone, nameOf, NOW)).toEqual([
      { topic: "goals", title: "Gol anulado. 0–1", body: "Se anula el gol de ERIK (minuto 19) · Manchester Piti 0–1 MAD SKY", tag: "goal-j8", url: "/matches/j8", requires: "goal-j8-e1", log: "goal-off-j8-e1" },
    ]);
    // the «¡GOL!» it answers claims exactly the id «Gol anulado» requires
    expect(noticesFor("j8", undone, live, nameOf, NOW)[0].log).toBe("goal-j8-e1");
    // theirs, and ours without a scorer yet
    expect(noticesFor("j8", live, { ...live, events: live.events.slice(1) }, nameOf, NOW)[0].body).toBe("Se anula el gol de MAD SKY (minuto 6) · Manchester Piti 1–0 MAD SKY");
    const anon = { ...live, events: [g("x", 30)] };
    expect(noticesFor("j8", anon, { ...anon, events: [] }, nameOf, NOW)[0].body).toBe("Se anula el gol del Piti (minuto 30) · Manchester Piti 0–0 MAD SKY");
    // a legacy match followed live (no clock) too
    const legacy = { ...base, events: live.events };
    expect(noticesFor("j8", legacy, { ...legacy, events: [] }, nameOf, NOW).map((n) => n.log)).toEqual(["goal-off-j8-r1", "goal-off-j8-e1"]);
  });
  it("an edited goal (one gone, another in): the annulment, then the new goal", () => {
    const after = { ...live, events: [live.events[0], g("e2", 19, "a")] };
    expect(noticesFor("j8", live, after, nameOf, NOW).map((n) => [n.title, n.log])).toEqual([
      ["Gol anulado. 1–1", "goal-off-j8-e1"],
      ["¡GOL del Piti! 1–1", "goal-j8-e2"],
    ]);
  });
  it("never for the corrections of an old acta, after the final whistle, or for other events", () => {
    const done = { ...live, status: "finished", goalsFor: 1, goalsAgainst: 1 };
    expect(noticesFor("j8", done, { ...done, events: [] }, nameOf, NOW)).toEqual([]);
    // un-publishing an old acta (finished → scheduled) doesn't annul its goals either
    expect(noticesFor("j8", done, { ...live, events: [] }, nameOf, NOW).filter((n) => n.title.startsWith("Gol anulado"))).toEqual([]);
    const ended = { ...live, clock: { phase: "ended" } };
    expect(noticesFor("j8", ended, { ...ended, events: [] }, nameOf, NOW)).toEqual([]);
    const card = { ...live, events: [...live.events, g("y", 22, "e", "yellow_card")] };
    expect(noticesFor("j8", card, live, nameOf, NOW)).toEqual([]);
  });
});

describe("dedup ids of the notices that could repeat", () => {
  it("kick-off, the acta's final and the MVP vote opening each claim their pushLog", () => {
    expect(kickoffNotice("j8", "MAD SKY").log).toBe("start-j8");
    const after = { ...base, status: "finished", goalsFor: 1, goalsAgainst: 0, voteClosesAt: NOW + 1, events: [] };
    expect(noticesFor("j8", { ...base, events: [] }, after, nameOf, NOW).map((n) => n.log)).toEqual(["final-j8", "mvp-open-j8"]);
  });
});

describe("«MVP de la J5»: the winner when the vote closes", () => {
  const closes = NOW - 60_000;
  it("the winner the web shows (ties share it), only once the vote has closed and with votes", () => {
    const r = { counts: { e: 3, a: 3, x: 1 }, total: 7 };
    expect(mvpWinnerIds(closes, r, NOW).sort()).toEqual(["a", "e"]);
    expect(mvpWinnerIds(closes, r, closes - 1)).toEqual([]);
    expect(mvpWinnerIds(closes, { counts: {}, total: 0 }, NOW)).toEqual([]);
    expect(mvpWinnerIds(closes, { counts: { e: 0 }, total: 1 }, NOW)).toEqual([]);
    expect(mvpWinnerIds(null, r, NOW)).toEqual([]);
    expect(mvpWinnerIds(closes, undefined, NOW)).toEqual([]);
    // the web's mvpWinners is this same rule
    const m = { id: "j5", voteClosesAt: closes } as unknown as ClubMatch;
    expect(mvpWinners(m, { id: "j5", counts: r.counts, total: r.total }, NOW)).toEqual(mvpWinnerIds(closes, r, NOW));
  });
  it("one winner: «MVP de la J5: ERIK», to the vote's tab, replacing «Vota al MVP» (same tag), once", () => {
    expect(mvpWinnerNotice("j5", { rival: "MAD SKY" }, ["e"], nameOf, 5)).toEqual({
      topic: "mvp",
      title: "MVP de la J5: ERIK",
      body: "Elegido por el vestuario ante MAD SKY. Mira la votación en la web.",
      tag: "mvp-j5",
      url: "/matches/j5?tab=vestuario",
      log: "mvp-win-j5",
    });
    const vote = noticesFor("j5", { ...base, events: [] }, { ...base, status: "finished", goalsFor: 1, goalsAgainst: 0, voteClosesAt: NOW + 1, events: [] }, nameOf, NOW).find((n) => n.topic === "mvp");
    expect(vote?.tag).toBe("mvp-j5");
  });
  it("a tie: «MVP compartido de la J5: ERIK y ADRIÁN T.C.»; without a jornada; nobody: no notice", () => {
    const tie = mvpWinnerNotice("j5", { rival: "MAD SKY" }, ["e", "a"], nameOf, 5);
    expect(tie?.title).toBe("MVP compartido de la J5: ERIK y ADRIÁN T.C.");
    expect(tie?.body).toBe("Empate en la votación ante MAD SKY. Mira el recuento en la web.");
    expect(tie?.log).toBe("mvp-win-j5");
    expect(mvpWinnerNotice("j5", {}, ["e", "a", "x"], nameOf, 5)?.title).toBe("MVP compartido de la J5: ERIK, ADRIÁN T.C. y Jugador");
    expect(mvpWinnerNotice("j5", {}, ["e"], nameOf, null)?.title).toBe("MVP del partido: ERIK");
    expect(mvpWinnerNotice("j5", {}, [], nameOf, 5)).toBeNull();
  });
});

describe("personal notices (to the member's own devices)", () => {
  it("«Tu ficha ya es tuya» when a captain approves the claim, once per member and ficha", () => {
    expect(claimNotice("u1", { playerId: "erik", status: "pending" }, { playerId: "erik", status: "approved", resolvedBy: "cap" })).toEqual({
      topic: "personal",
      title: "Tu ficha ya es tuya",
      body: "El capitán ha aprobado tu ficha: tus partidos, tus goles y tu carta ya cuentan contigo.",
      tag: "claim-u1",
      url: "/profile",
      log: "claim-u1-erik",
    });
  });
  it("nothing for a pending or rejected claim, an approved one saved again, or a captain's own claim", () => {
    expect(claimNotice("u1", undefined, { playerId: "erik", status: "pending" })).toBeNull();
    expect(claimNotice("u1", { status: "pending", playerId: "erik" }, { playerId: "erik", status: "rejected", resolvedBy: "cap" })).toBeNull();
    expect(claimNotice("u1", { status: "approved", playerId: "erik" }, { playerId: "erik", status: "approved", resolvedBy: "cap" })).toBeNull();
    expect(claimNotice("cap", { status: "pending", playerId: "erik" }, { playerId: "erik", status: "approved", resolvedBy: "cap" })).toBeNull();
    expect(claimNotice("u1", { status: "pending" }, undefined)).toBeNull();
  });
  it("«El capitán revisó tus posiciones»: each new review, in its own words, once per review date", () => {
    const review = (status: string, at: unknown = 1_700_000_000_000) => ({ positionsReview: { status, at, by: "cap" } });
    expect(positionsNotice("erik", { positionsReview: null }, review("aprobada"), "u1")).toEqual({
      topic: "personal",
      title: "El capitán revisó tus posiciones",
      body: "Ha aprobado tus posiciones: tu ficha ya sale así.",
      tag: "positions-erik",
      url: "/profile",
      log: "positions-erik-1700000000000",
    });
    expect(positionsNotice("erik", undefined, review("ajustada"), "u1")?.body).toBe("Ha ajustado un poco tus posiciones. Mira cómo quedan en tu perfil.");
    expect(positionsNotice("erik", undefined, review("rechazada"), "u1")?.body).toBe("Esta vez tus posiciones se quedan como estaban. Míralo en tu perfil.");
    // a Firestore Timestamp (what the trigger sees) dates it the same way
    expect(positionsNotice("erik", undefined, review("aprobada", { toMillis: () => 42 }), "u1")?.log).toBe("positions-erik-42");
    // a later review (a new date) is news again
    expect(positionsNotice("erik", review("rechazada", 1), review("aprobada", 2), "u1")?.log).toBe("positions-erik-2");
  });
  it("nothing for the same review saved again, a cleared one, no member linked, the member's own review, or junk", () => {
    const r = { status: "aprobada", at: 5, by: "cap" };
    expect(positionsNotice("erik", { positionsReview: r }, { positionsReview: { ...r } }, "u1")).toBeNull();
    expect(positionsNotice("erik", { positionsReview: r }, { positionsReview: null }, "u1")).toBeNull();
    expect(positionsNotice("erik", undefined, { positionsReview: r }, null)).toBeNull();
    expect(positionsNotice("erik", undefined, { positionsReview: { ...r, by: "u1" } }, "u1")).toBeNull();
    expect(positionsNotice("erik", undefined, { positionsReview: { ...r, status: "toString" } }, "u1")).toBeNull();
    expect(positionsNotice("erik", undefined, { positionsReview: { status: "aprobada", by: "cap" } }, "u1")).toBeNull();
  });
});
