import { describe, expect, it } from "vitest";
import { remember } from "./remember";

describe("remember", () => {
  it("works a result out once for the same documents", () => {
    let runs = 0;
    const sum = remember((xs: readonly { n: number }[]) => {
      runs++;
      return xs.reduce((a, x) => a + x.n, 0);
    });
    const a = { n: 1 };
    const b = { n: 2 };
    expect(sum([a, b])).toBe(3);
    // (a new array of the same documents: the same result, not worked out again)
    expect(sum([a, b])).toBe(3);
    expect(runs).toBe(1);
  });

  it("works it out again when a document changed (the store gives it a new object)", () => {
    let runs = 0;
    const count = remember((xs: readonly { id: string; goals: number[] }[]) => {
      runs++;
      return xs.length;
    });
    const a = { id: "a", goals: [1] };
    count([a]);
    count([{ id: "a", goals: [1, 2] }]);
    expect(runs).toBe(2);
  });

  it("takes a list rebuilt as plain objects, and a filter written again, as the same", () => {
    let runs = 0;
    const f = remember((seasons: readonly { id: string; name: string }[], filters: { team?: string; playerIds?: string[] }) => {
      runs++;
      return seasons.length + (filters.playerIds?.length ?? 0);
    });
    f([{ id: "s1", name: "Temporada 1" }], { team: "us", playerIds: ["p1"] });
    f([{ id: "s1", name: "Temporada 1" }], { team: "us", playerIds: ["p1"], period: undefined } as { team: string; playerIds: string[] });
    expect(runs).toBe(1);
    f([{ id: "s1", name: "Temporada 1" }], { team: "them", playerIds: ["p1"] });
    expect(runs).toBe(2);
  });

  it("keeps only the last few", () => {
    let runs = 0;
    const id = remember((n: number) => {
      runs++;
      return n;
    }, 2);
    id(1);
    id(2);
    id(3);
    id(1);
    expect(runs).toBe(4);
    id(3);
    expect(runs).toBe(4);
  });
});
