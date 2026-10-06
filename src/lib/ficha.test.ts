import { describe, expect, it } from "vitest";
import type { MatchEvent, Participation } from "../../functions/src/matchEngine";
import { chapters, keyNumbers, onPitch, playerLine, pulse, stintRows } from "./ficha";

const e = (type: string, minute: number, playerId?: string, assistPlayerId?: string) => ({ id: `${type}${minute}`, type, minute, playerId, assistPlayerId }) as MatchEvent;
const names: Record<string, string> = { a: "ADRIÁN T.C.", h: "HUBEROSKI", i: "ILLESCAS", ev: "EVANS", er: "ERIK" };
const nameOf = (id: string) => names[id] ?? "?";
const J7 = [e("goal", 9, "a", "h"), e("opponent_goal", 18), e("yellow_card", 22, "i"), e("goal", 31, "a", "er"), e("penalty_saved", 41, "ev"), e("goal", 46, "h", "i")];

describe("chapters", () => {
  it("tells each goal with the score it leaves, saves, and the final whistle", () => {
    const c = chapters(J7, nameOf, "FUSION 7", { gf: 3, ga: 1 });
    expect(c.map((x) => [x.minute, x.title])).toEqual([
      [9, "Primero, el Piti"],
      [18, "Empata FUSION 7"],
      [31, "Por delante"],
      [41, "EVANS para un penalti"],
      [46, "Más distancia"],
      [null, "Final: 3–1"],
    ]);
    expect(c[0]).toMatchObject({ text: "ADRIÁN T.C. marca, con asistencia de HUBEROSKI. 1–0.", side: "us", playerId: "a" });
    expect(c.at(-1)?.text).toBe("Victoria ante FUSION 7.");
  });
  it("comebacks and rival leads read right", () => {
    const c = chapters([e("opponent_goal", 5), e("opponent_goal", 10), e("goal_penalty", 20, "a"), e("own_goal", 30, "i")], nameOf, "MAD SKY");
    expect(c.map((x) => x.title)).toEqual(["Golpe de MAD SKY", "MAD SKY amplía", "Recortamos", "MAD SKY amplía"]);
    expect(c[2].text).toBe("ADRIÁN T.C. marca de penalti. 1–2.");
    expect(c[3].text).toBe("Gol en propia puerta de ILLESCAS. 1–3.");
  });
});

describe("pulse", () => {
  it("one bar per minute, highest around the events, cut at the live minute", () => {
    const p = pulse(J7, 50, 30);
    expect(p).toHaveLength(50);
    expect(Math.max(...p.slice(0, 15).map((b) => b.us))).toBe(p[8].us); // the goal in the 9th is our early peak
    expect(p[17].them).toBeGreaterThan(p[17].us);
    expect([p[29].played, p[30].played]).toEqual([true, false]);
  });
});

describe("stintRows and playerLine", () => {
  const ledger = {
    a: { played: true, minutes: 50, stints: [{ from: 0, to: 50 }], goals: 2, assists: 0, yellowCards: 0, redCards: 0 },
    k: { played: true, minutes: 20, stints: [{ from: 30, to: 50 }], goals: 0, assists: 0, yellowCards: 1, redCards: 0 },
    b: { played: false, minutes: 0, stints: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  } as unknown as Record<string, Participation>;
  it("rows for who played, most minutes first, with goal marks", () => {
    const rows = stintRows(ledger, J7, 50);
    expect(rows.map((r) => r.id)).toEqual(["a", "k"]);
    expect(rows[0]).toMatchObject({ spans: [{ left: 0, width: 100 }], goals: [18, 62] });
    expect(rows[1].spans).toEqual([{ left: 60, width: 40 }]);
  });
  it("ledger line when published, events otherwise", () => {
    expect(playerLine("k", ledger, J7)).toEqual({ minutes: 20, goals: 0, assists: 0, cards: 1 });
    expect(playerLine("h", undefined, J7)).toEqual({ minutes: 0, goals: 1, assists: 1, cards: 0 });
  });
  it("key numbers", () => {
    expect(keyNumbers(J7)).toEqual({ saves: 1, woodwork: 0, cards: 1 });
  });
});

describe("onPitch", () => {
  it("applies substitutions and red cards in minute order", () => {
    const ev = [{ ...e("substitution", 30, "t"), inPlayerId: "k" }, e("red_card", 40, "i")] as MatchEvent[];
    expect(onPitch(["a", "t", "i"], ev)).toEqual(["a", "k"]);
  });
});
