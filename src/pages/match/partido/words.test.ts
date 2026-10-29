import { describe, expect, it } from "vitest";
import { scoreLabelOf } from "./words";

const opts = { played: true, pre: false, dragged: false, live: false, m: 50, kickTime: "14:00", word: "Sin acta" };

describe("scoreLabelOf: the score as the board shows it", () => {
  it("at home we come first; away the home side does («Pitutis 1, Manchester Piti 2»)", () => {
    expect(scoreLabelOf("Pitutis", { us: 2, them: 1 }, { ...opts, home: true })).toBe("Manchester Piti 2, Pitutis 1");
    expect(scoreLabelOf("Pitutis", { us: 2, them: 1 }, opts)).toBe("Manchester Piti 2, Pitutis 1");
    expect(scoreLabelOf("Pitutis", { us: 2, them: 1 }, { ...opts, home: false, live: true })).toBe("Pitutis 1, Manchester Piti 2, en directo");
  });
});
