import { describe, expect, it } from "vitest";
import { findOfficialBoard, type BoardDb } from "../../functions/src/officialBoard";

type Data = Record<string, unknown>;
const ms = (n: number) => ({ toMillis: () => n });

/** An in-memory stand-in for the few admin-SDK calls the lookup makes. */
function fakeDb(docs: Record<string, Data>, opts: { failOn?: string } = {}): BoardDb & { reads: string[] } {
  const reads: string[] = [];
  const snap = (path: string) => {
    const data = docs[path];
    return {
      id: path.split("/").pop() ?? "",
      exists: data !== undefined,
      get: (f: string) => data?.[f],
      data: () => data,
      updateTime: ms(0),
    };
  };
  const query = (col: string, filters: [string, unknown][]) => ({
    where: (f: string, _op: "==", v: unknown) => query(col, [...filters, [f, v]]),
    get: async () => {
      reads.push(`${col}?${filters.map(([f, v]) => `${f}=${String(v)}`).join("&")}`);
      return {
        docs: Object.keys(docs)
          .filter((p) => p.startsWith(col + "/") && filters.every(([f, v]) => docs[p][f] === v))
          .map(snap),
      };
    },
  });
  return {
    reads,
    doc: (path: string) => ({
      get: async () => {
        reads.push(path);
        if (opts.failOn === path) throw new Error("boom");
        return snap(path);
      },
    }),
    collection: (col: string) => query(col, []),
  };
}

const board = (extra: Data): Data => ({ seasonId: "s1", formation: "2-3-1", freeMode: false, slots: [], isOfficial: true, ...extra });

describe("findOfficialBoard (the match-bound official board)", () => {
  it("the lock doc names the board when it is official for that match", async () => {
    const db = fakeDb({
      "lineupOfficials/s1__m1": { lineupId: "b1", seasonId: "s1", matchId: "m1" },
      "lineups/b1": board({ matchId: "m1" }),
      "lineups/b2": board({ matchId: "m1", updatedAt: ms(99) }),
    });
    expect((await findOfficialBoard(db, "s1", "m1"))?.id).toBe("b1");
    expect(db.reads).toEqual(["lineupOfficials/s1__m1", "lineups/b1"]);
  });

  it("a stale lock (board no longer official, or for another match) falls back to the newest official for the match", async () => {
    const db = fakeDb({
      "lineupOfficials/s1__m1": { lineupId: "b1", seasonId: "s1", matchId: "m1" },
      "lineups/b1": board({ matchId: "m2" }),
      "lineups/b2": board({ matchId: "m1", updatedAt: ms(10) }),
      "lineups/b3": board({ matchId: "m1", updatedAt: ms(30) }),
      "lineups/b4": board({ matchId: "m1", isOfficial: false, updatedAt: ms(50) }),
      "lineups/b5": board({ seasonId: "s2", matchId: "m1", updatedAt: ms(60) }),
    });
    const found = await findOfficialBoard(db, "s1", "m1");
    expect(found?.id).toBe("b3");
    expect(found?.board.formation).toBe("2-3-1");
  });

  it("no lock doc: the query alone", async () => {
    const db = fakeDb({ "lineups/b2": board({ matchId: "m1" }) });
    expect((await findOfficialBoard(db, "s1", "m1"))?.id).toBe("b2");
  });

  it("a season-wide official never counts", async () => {
    const db = fakeDb({
      "lineupOfficials/s1__temporada": { lineupId: "bt", seasonId: "s1", matchId: null },
      "lineups/bt": board({ matchId: null }),
    });
    expect(await findOfficialBoard(db, "s1", "m1")).toBeNull();
  });

  it("a lock naming a missing board, or an odd lineupId, falls back without crashing; odd ids are reported", async () => {
    const db = fakeDb({ "lineupOfficials/s1__m1": { lineupId: "gone", seasonId: "s1", matchId: "m1" } });
    expect(await findOfficialBoard(db, "s1", "m1")).toBeNull();
    const odd = fakeDb({ "lineupOfficials/s1__m1": { lineupId: "a/b", seasonId: "s1", matchId: "m1" } });
    const invalid: string[] = [];
    const onInvalidId = (what: string, id: string) => invalid.push(`${what}:${id}`);
    expect(await findOfficialBoard(odd, "s1", "m1", { onInvalidId })).toBeNull();
    expect(odd.reads).not.toContain("lineups/a/b");
    expect(await findOfficialBoard(odd, "s/1", "m1", { onInvalidId })).toBeNull();
    expect(await findOfficialBoard(odd, "s1", "", { onInvalidId })).toBeNull();
    expect(invalid).toEqual(["pizarra:a/b", "temporada:s/1", "partido:"]);
  });

  it("a lock naming a board of another season is not trusted", async () => {
    const db = fakeDb({
      "lineupOfficials/s1__m1": { lineupId: "b1", seasonId: "s1", matchId: "m1" },
      "lineups/b1": board({ seasonId: "s0", matchId: "m1" }),
    });
    expect(await findOfficialBoard(db, "s1", "m1")).toBeNull();
  });

  it("ties on updatedAt (or none at all) break by id, whatever the order the query returns", async () => {
    const docs = {
      "lineups/bz": board({ matchId: "m1", updatedAt: ms(5) }),
      "lineups/ba": board({ matchId: "m1", updatedAt: ms(5) }),
      "lineups/bold": board({ matchId: "m1", updatedAt: ms(1) }),
    };
    expect((await findOfficialBoard(fakeDb(docs), "s1", "m1"))?.id).toBe("ba");
    const reversed = Object.fromEntries(Object.entries(docs).reverse());
    expect((await findOfficialBoard(fakeDb(reversed), "s1", "m1"))?.id).toBe("ba");
    const undated = { "lineups/y": board({ matchId: "m1" }), "lineups/x": board({ matchId: "m1" }) };
    expect((await findOfficialBoard(fakeDb(undated), "s1", "m1"))?.id).toBe("x");
    // a dated board beats an undated one
    expect((await findOfficialBoard(fakeDb({ ...undated, "lineups/z": board({ matchId: "m1", updatedAt: ms(0) }) }), "s1", "m1"))?.id).toBe("z");
  });

  it("read failures are the caller's to handle (it throws)", async () => {
    const db = fakeDb({}, { failOn: "lineupOfficials/s1__m1" });
    await expect(findOfficialBoard(db, "s1", "m1")).rejects.toThrow("boom");
  });
});
