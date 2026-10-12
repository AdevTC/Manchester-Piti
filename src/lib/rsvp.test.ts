import { describe, expect, it } from "vitest";
import { rsvpSummary } from "./rsvp";

describe("the convocatoria's answers, «Sin responder» included", () => {
  it("counts the answers and the convocados who haven't answered", () => {
    const answers = [
      { response: "yes" as const, playerId: "a" },
      { response: "yes" as const, playerId: "b" },
      { response: "maybe" as const, playerId: "c" },
      // (a member with no ficha linked counts as an answer, never as a convocado)
      { response: "no" as const, playerId: null },
    ];
    const s = rsvpSummary(answers, ["a", "b", "c", "d", "e", "d"]);
    expect(s).toMatchObject({ yes: 2, maybe: 1, no: 1, sin: 2 });
    expect(s.txt).toBe("2 van · 1 en duda · 1 no puede · 2 sin responder");
  });

  it("without a convocatoria nobody is «sin responder»; the zeros say nothing", () => {
    expect(rsvpSummary([{ response: "yes", playerId: "a" }], [])).toMatchObject({ sin: 0, txt: "1 va" });
    expect(rsvpSummary([], ["a", "b"]).txt).toBe("2 sin responder");
    expect(rsvpSummary([], []).txt).toBe("");
  });
});
