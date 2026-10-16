import { describe, expect, it } from "vitest";
import {
  actaPublishedAt,
  formatNota,
  MAX_MOMENTS,
  momentsFull,
  momentTally,
  nextMoments,
  notaLine,
  parseRatingDoc,
  parseReactionDoc,
  ratingFields,
  ratingSummary,
  ratingWindow,
  reactionFields,
  reactionsOpen,
  whoReacted,
  type RatingDoc,
  type ReactionDoc,
  type ReactionId,
} from "./trasElPartido";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PUBLISHED = Date.UTC(2026, 9, 10, 20);
// saveMatchSheet stamps voteClosesAt = first publication + 48 h
const done = { status: "finished", voteClosesAt: PUBLISHED + 48 * HOUR };

describe("the windows (firestore.rules actaPublished / ratingOpen)", () => {
  it("the acta's publication is voteClosesAt − 48 h; before the acta there is none", () => {
    expect(actaPublishedAt(done)).toBe(PUBLISHED);
    expect(actaPublishedAt({ status: "scheduled", voteClosesAt: null })).toBeNull();
    expect(actaPublishedAt({ status: "finished" })).toBeNull(); // legacy acta without the MVP window
    expect(actaPublishedAt({ ...done, archived: true } as typeof done)).toBeNull();
  });
  it("reactions: from the publication on, for good", () => {
    expect(reactionsOpen(done)).toBe(true);
    expect(reactionsOpen({ status: "scheduled" })).toBe(false);
  });
  it("the nota: open for 7 days from the publication, then closed (to the millisecond)", () => {
    expect(ratingWindow({ status: "scheduled" }, PUBLISHED)).toEqual({ state: "none" });
    expect(ratingWindow(done, PUBLISHED)).toEqual({ state: "open", closesAt: PUBLISHED + 7 * DAY });
    expect(ratingWindow(done, PUBLISHED + 7 * DAY - 1).state).toBe("open");
    expect(ratingWindow(done, PUBLISHED + 7 * DAY)).toEqual({ state: "closed", closedAt: PUBLISHED + 7 * DAY });
  });
});

describe("the docs as read", () => {
  it("a reactions doc keeps only known reactions on well-formed moment ids", () => {
    expect(parseReactionDoc("u1", { moments: { g1: "fuego", final: "uy", "mal id": "risa", g2: "meh" }, name: "Hugo", playerId: "hugo" })).toEqual({ uid: "u1", name: "Hugo", playerId: "hugo", moments: { g1: "fuego", final: "uy" } });
    expect(parseReactionDoc("u1", { name: "Hugo" })).toBeNull();
    expect(parseReactionDoc("u1", { moments: {}, playerId: 3 })).toEqual({ uid: "u1", name: "Miembro", playerId: null, moments: {} });
  });
  it("a rating doc is a whole 1–5", () => {
    expect(parseRatingDoc("u1", { score: 4, name: "Hugo", playerId: null })).toEqual({ uid: "u1", name: "Hugo", playerId: null, score: 4 });
    for (const score of [0, 6, 3.5, "4", null]) expect(parseRatingDoc("u1", { score, name: "Hugo" })).toBeNull();
  });
});

describe("what is shown", () => {
  const r = (uid: string, name: string, moments: Record<string, ReactionId>): ReactionDoc => ({ uid, name, playerId: null, moments });
  it("«X, Y y N más»", () => {
    expect(whoReacted([])).toBe("");
    expect(whoReacted(["Hugo"])).toBe("Hugo");
    expect(whoReacted(["Hugo", "Mario"])).toBe("Hugo y Mario");
    expect(whoReacted(["Hugo", "Mario", "Raúl"])).toBe("Hugo, Mario y Raúl");
    expect(whoReacted(["Hugo", "Mario", "Raúl", "Iván", "Leo"])).toBe("Hugo, Mario y 3 más");
  });
  it("counts per reaction for one moment, «Tú» first when it is mine, the rest by name", () => {
    const docs = [r("u1", "Yo", { g1: "fuego" }), r("u2", "Mario", { g1: "fuego", g2: "uy" }), r("u3", "Hugo", { g1: "fuego" }), r("u4", "Ana", { g1: "risa" })];
    const t = momentTally(docs, "g1", "u1");
    expect(t.map((x) => [x.id, x.count, x.mine])).toEqual([["fuego", 3, true], ["aplauso", 0, false], ["risa", 1, false], ["uy", 0, false]]);
    expect(t[0].names).toEqual(["Tú", "Hugo", "Mario"]);
    expect(whoReacted(t[0].names)).toBe("Tú, Hugo y Mario");
    // a fan (no uid): the same counts, nobody is «Tú»
    expect(momentTally(docs, "g1")[0]).toMatchObject({ count: 3, mine: false, names: ["Hugo", "Mario", "Yo"] });
    expect(momentTally(docs, "g2").map((x) => x.count)).toEqual([0, 0, 0, 1]);
  });
  it("one reaction per moment: another one replaces it, the same one takes it back", () => {
    expect(nextMoments({}, "g1", "fuego")).toEqual({ g1: "fuego" });
    expect(nextMoments({ g1: "fuego", g2: "uy" }, "g1", "aplauso")).toEqual({ g1: "aplauso", g2: "uy" });
    expect(nextMoments({ g1: "fuego", g2: "uy" }, "g1", "fuego")).toEqual({ g2: "uy" });
  });
  it("at most 30 moments: a 31st is full, changing one of the 30 is not", () => {
    const thirty = Object.fromEntries(Array.from({ length: MAX_MOMENTS }, (_, i) => [`e${i}`, "fuego" as const]));
    expect(momentsFull(thirty, "nuevo")).toBe(true);
    expect(momentsFull(thirty, "e3")).toBe(false);
    expect(momentsFull({}, "nuevo")).toBe(false);
  });
  it("the average with one decimal in es-ES, and the line «Nota del vestuario: 4,2 · 11 votos»", () => {
    const rating = (score: number, i: number): RatingDoc => ({ uid: `u${i}`, name: `N${i}`, playerId: null, score });
    const eleven = [5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4].map(rating); // 46 / 11 = 4,18…
    expect(ratingSummary(eleven)).toEqual({ count: 11, average: 46 / 11 });
    expect(notaLine(ratingSummary(eleven))).toBe("Nota del vestuario: 4,2 · 11 votos");
    expect(notaLine(ratingSummary([rating(3, 0)]))).toBe("Nota del vestuario: 3,0 · 1 voto");
    expect(ratingSummary([])).toEqual({ count: 0, average: null });
    expect(notaLine(ratingSummary([]))).toBe("");
    expect(formatNota(4.25)).toBe("4,3");
  });
});

describe("the write fields (firestore.rules: exactly these, plus `at`)", () => {
  const me = { uid: "u1", name: "erik", playerId: "erik" };
  it("reactions and ratings are signed with the member's name and ficha", () => {
    expect(reactionFields(me, { g1: "fuego" })).toEqual({ moments: { g1: "fuego" }, name: "erik", playerId: "erik" });
    expect(ratingFields({ name: "raul", playerId: null }, 4)).toEqual({ score: 4, name: "raul", playerId: null });
  });
});
