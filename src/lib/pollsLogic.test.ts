import { describe, expect, it } from "vitest";
import { pollNotice, pollUrl, POLL_URL } from "../../functions/src/pollsLogic";
import { noticeRecord } from "../../functions/src/noticesLogic";

describe("«Nueva encuesta» (onPollCreated)", () => {
  it("one team notice on lineup, with the author and the question, logged once per poll", () => {
    expect(pollNotice("abc", { question: "¿Cena el viernes?", authorName: "nico" })).toEqual({
      topic: "lineup",
      title: "Nueva encuesta",
      body: "nico: ¿Cena el viernes?",
      tag: "poll-abc",
      url: "/vestuario/encuestas/abc",
      log: "poll-abc",
    });
    expect(POLL_URL).toBe("/vestuario/encuestas");
    expect(pollUrl("a b")).toBe("/vestuario/encuestas/a%20b");
  });

  it("is kept in the centro de avisos for the team", () => {
    const n = pollNotice("abc", { question: "¿Cena?", authorName: "nico" })!;
    expect(noticeRecord(n, undefined, 0)?.doc.audience).toBe("team");
  });

  it("trims, and without an author says just the question", () => {
    expect(pollNotice("x", { question: "  ¿Torneo?  ", authorName: " ana " })?.body).toBe("ana: ¿Torneo?");
    expect(pollNotice("x", { question: "¿Torneo?" })?.body).toBe("¿Torneo?");
    expect(pollNotice("x", { question: "¿Torneo?", authorName: 3 })?.body).toBe("¿Torneo?");
  });

  it("nothing for a doc without a question", () => {
    expect(pollNotice("x", undefined)).toBeNull();
    expect(pollNotice("x", { question: "   ", authorName: "ana" })).toBeNull();
    expect(pollNotice("x", { question: 7 })).toBeNull();
  });
});
