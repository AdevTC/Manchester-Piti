import { describe, expect, it } from "vitest";
import { albumLine, albumOf } from "./album";

const played = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { played: true, minutes: 50 }]));
const SQUAD = ["jordi", "alcides", "evans", "fer", "kevin", "erik"];
const M = [
  { id: "j1", seasonId: "t1", date: 1_000, ledger: { ...played(["jordi", "alcides", "evans", "guest:x"]), kevin: { played: false } } },
  { id: "j2", seasonId: "t1", date: 2_000, ledger: played(["jordi", "fer", "alcides"]) },
  { id: "j3", seasonId: "t1", date: 3_000, ledger: played(["kevin", "erik"]) },
  { id: "old", seasonId: "t0", date: 500, ledger: played(["jordi", "kevin"]) },
];

describe("albumOf", () => {
  it("a cromo per teammate he has played a match with this season (his own too), newest first", () => {
    const a = albumOf("jordi", M as never, SQUAD, "t1");
    expect(a.owned.map((c) => c.id)).toEqual(["fer", "jordi", "alcides", "evans"]);
    expect(a.total).toBe(6);
    expect(a.missing).toEqual(["kevin", "erik"]);
  });
  it("nothing before his first match", () => {
    const a = albumOf("nuevo", M as never, [...SQUAD, "nuevo"], "t1");
    expect(a.owned).toEqual([]);
    expect(albumLine(a, [])).toBe("El primero llega con tu primer partido.");
  });
  it("the line: who debuts tonight, how many are left, or all of them", () => {
    const a = albumOf("jordi", M as never, SQUAD, "t1");
    expect(albumLine(a, ["kevin", "erik", "jordi"])).toBe("Te faltan los de los que debutan hoy.");
    expect(albumLine(a, ["kevin"])).toBe("Hoy cae uno de los que te faltan.");
    expect(albumLine(a, [])).toBe("Te faltan 2: juega con ellos y los tienes.");
    expect(albumLine(albumOf("jordi", M as never, ["jordi", "alcides"], "t1"), [])).toBe("Los tienes todos.");
  });
});
