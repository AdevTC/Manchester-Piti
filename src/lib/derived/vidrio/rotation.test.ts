import { describe, expect, it } from "vitest";
import type { ClubMatch, MatchEvent } from "../../clubData";
import { changesWord, edgeMinute, minutesText, rotationOf, stintsLabel, stintsText } from "./rotation";

const SEVEN = ["evans", "fer", "illescas", "jordi", "adrian", "eguzquiza", "alcides"];
const ev = (id: string, type: MatchEvent["type"], min: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, minute: min, period: min <= 25 ? 1 : 2, ...more });
const sub = (id: string, min: number, out: string, inn: string) => ev(id, "substitution", min, { playerId: out, inPlayerId: inn });
// F7 rolling substitutions: Erik and Fer go in and out several times
const EVENTS: MatchEvent[] = [
  ev("g1", "goal", 6, { playerId: "alcides" }),
  sub("s1", 10, "fer", "erik"),
  sub("s2", 18, "erik", "fer"),
  sub("s3", 35, "fer", "erik"),
  sub("s4", 44, "jordi", "fer"),
];
const NAMES: Record<string, string> = { evans: "Evans", fer: "Fer", illescas: "Illescas", jordi: "Jordi", adrian: "Adrián T.C.", eguzquiza: "Eguzquiza", alcides: "Alcides", erik: "Erik", kevin: "Kevin" };
const nameOf = (id: string) => NAMES[id] ?? id;
const j1: ClubMatch = { id: "j1", seasonId: "t1", version: 2, status: "scheduled", rival: "Orduña fc", duration: 50, home: true, starters: SEVEN, bench: ["erik", "kevin"], notCalled: [], events: EVENTS };

describe("rotation", () => {
  it("formats stints, minutes and the count as the pitch and the list say them", () => {
    expect(stintsText([{ from: 0, to: 10 }, { from: 18, to: 35 }])).toBe("0′–10′, 18′–35′");
    expect(stintsLabel([{ from: 0, to: 10 }, { from: 18, to: 35 }, { from: 44, to: 50 }])).toBe("Del minuto 0 al 10, del 18 al 35 y del 44 al 50");
    expect(stintsLabel([{ from: 0, to: 50 }])).toBe("Del minuto 0 al 50");
    // (in at 49:40 with the whistle at 50: one minute, not «50′–50′»)
    expect(stintsText([{ from: 0, to: 18 }, { from: 49.6, to: 50 }])).toBe("0′–18′, 50′");
    expect(stintsLabel([{ from: 0, to: 18 }, { from: 49.6, to: 50 }])).toBe("Del minuto 0 al 18 y en el 50");
    expect(changesWord(21)).toBe("21 cambios");
    expect(changesWord(1)).toBe("1 cambio");
    expect(minutesText(35)).toBe("35 min");
    // (a play's minute: 18.2 happened in the 19th; the kick-off is 0)
    expect(edgeMinute(0)).toBe(0);
    expect(edgeMinute(18)).toBe(18);
    expect(edgeMinute(18.2)).toBe(19);
  });

  it("walks the plays: every stint by player, the ones who changed first, minutes summed", () => {
    const r = rotationOf(j1, EVENTS, nameOf);
    expect(r.changes).toBe(4);
    const fer = r.rows.find((x) => x.id === "fer")!;
    expect(fer).toMatchObject({ name: "Fer", minutes: 33, text: "0′–10′, 18′–35′, 44′–50′", changed: true });
    expect(r.rows.find((x) => x.id === "erik")).toMatchObject({ minutes: 23, text: "10′–18′, 35′–50′" });
    expect(r.rows.find((x) => x.id === "jordi")).toMatchObject({ minutes: 44, text: "0′–44′", changed: true });
    // the ones who played throughout come after the ones who changed; Kevin never played
    const order = r.rows.map((x) => x.id);
    expect(order.slice(0, 3)).toEqual(["jordi", "fer", "erik"]);
    expect(r.rows.find((x) => x.id === "evans")).toMatchObject({ minutes: 50, text: "0′–50′", changed: false });
    expect(order).not.toContain("kevin");
    expect(r.minutes.get("erik")).toBe(23);
  });

  it("live: up to the minute given, the open stint ends now", () => {
    const r = rotationOf(j1, EVENTS.filter((e) => (e.minute ?? 0) <= 20), nameOf, 20);
    expect(r.changes).toBe(2);
    expect(r.rows.find((x) => x.id === "fer")).toMatchObject({ minutes: 12, text: "0′–10′, 18′–20′" });
    expect(r.minutes.get("evans")).toBe(20);
  });

  it("after the acta: the published ledger's stints", () => {
    const ledger = {
      fer: { played: true, minutes: 30, stints: [{ from: 0, to: 14 }, { from: 34, to: 50 }], subIn: 1, subOut: 1 },
      kevin: { played: false, minutes: 0, stints: [], subIn: 0, subOut: 0 },
    } as unknown as ClubMatch["ledger"];
    const r = rotationOf({ ...j1, status: "finished", ledger }, EVENTS, nameOf);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ id: "fer", minutes: 30, text: "0′–14′, 34′–50′" });
  });

  it("no changes: everyone played throughout", () => {
    const r = rotationOf(j1, EVENTS.filter((e) => e.type !== "substitution"), nameOf);
    expect(r.changes).toBe(0);
    expect(r.rows.every((x) => !x.changed && x.minutes === 50)).toBe(true);
  });
});
