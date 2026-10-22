import { describe, expect, it } from "vitest";
import type { ClubMatch, MatchEvent } from "../../clubData";
import { nightTags, squadLive } from "./squadLive";

const KO = Date.UTC(2026, 9, 18, 17); // Sunday 18 Oct 2026, 19:00 Madrid
const ts = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });
const SEVEN = ["evans", "fer", "illescas", "jordi", "adrian", "eguzquiza", "alcides"];
const SQUAD = [...SEVEN, "erik", "kevin", "josito"];
const ev = (id: string, type: MatchEvent["type"], min: number, more: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, elapsedSeconds: min * 60 - 30, period: min <= 25 ? 1 : 2, ...more });
const EVENTS: MatchEvent[] = [
  ev("g1", "goal", 6, { playerId: "alcides", assistPlayerId: "adrian" }),
  ev("g2", "opponent_goal", 11),
  ev("y1", "yellow_card", 15, { playerId: "eguzquiza" }),
  ev("g3", "goal", 21, { playerId: "adrian", assistPlayerId: "jordi" }),
  ev("s1", "substitution", 30, { playerId: "illescas", inPlayerId: "erik" }),
];
const j1: ClubMatch = { id: "j1", seasonId: "t1", version: 2, status: "scheduled", rival: "Orduña fc", date: ts(KO), duration: 50, home: true, starters: SEVEN, bench: ["erik", "kevin"], notCalled: ["josito"], events: EVENTS };

describe("squadLive", () => {
  it("before the whistle: the seven, the called-up and who doesn't play tonight", () => {
    const s = squadLive({ day: { phase: "antes", match: { ...j1, events: [] }, kickoff: KO }, squad: SQUAD, matches: [j1] });
    expect(s.stage).toBe("pre");
    expect(s.rows.get("jordi")).toEqual({ status: "En el siete", tone: "on", tags: [] });
    expect(s.rows.get("kevin")?.status).toBe("Convocado");
    expect(s.rows.get("josito")).toEqual({ status: "No juega hoy", tone: "off", tags: [] });
    expect(s.lede).toBe("Los 10 de la temporada. Esta noche, siete en el siete y dos en el banquillo.");
  });

  it("while it is played: on the pitch (since the change), on the bench, out, with the marks of the night", () => {
    const s = squadLive({ day: { phase: "directo2", match: j1, kickoff: KO }, squad: SQUAD, matches: [j1] });
    expect(s.rows.get("erik")?.status).toBe("En el campo desde el 30′");
    expect(s.rows.get("illescas")).toMatchObject({ status: "Salió en el 30′", tone: "bench" });
    expect(s.rows.get("kevin")).toMatchObject({ status: "En el banquillo", tone: "bench" });
    expect(s.rows.get("josito")?.tone).toBe("off");
    // the latest goal of ours is gold; the pass and the card carry their minutes; with a change, his minutes so far first
    expect(s.rows.get("adrian")?.tags.map((t) => [t.kind, t.text, t.gold])).toEqual([["minutos", "30 min", false], ["asis", "6′", false], ["gol", "21′", true]]);
    expect(s.rows.get("adrian")?.tags[0].label).toBe("30 minutos jugados hasta ahora");
    expect(s.rows.get("eguzquiza")?.tags[1]).toMatchObject({ kind: "amarilla", text: "15′", label: "Amarilla en el 15" });
    expect(s.onPitch).toHaveLength(7);
    expect(s.ledeShort).toBe("Ahora, siete en el campo.");
  });

  it("after: who played, the debut once the acta is out, the MVP once the vote has closed", () => {
    const done: ClubMatch = { ...j1, status: "finished", goalsFor: 2, goalsAgainst: 1 };
    const s = squadLive({ day: { phase: "acta", match: done, kickoff: KO }, squad: SQUAD, matches: [done], mvp: ["alcides"] });
    expect(s.rows.get("alcides")).toMatchObject({ status: "MVP del partido", tone: "on" });
    expect(s.rows.get("jordi")?.status).toBe("Logro «Debut»");
    expect(s.rows.get("kevin")).toMatchObject({ status: "No jugó", tone: "off" });
    expect(s.lede).toBe("Los 10 de la temporada. Ocho jugaron el debut.");
    expect(s.rows.get("adrian")?.tags.some((t) => t.gold)).toBe(false);
  });

  it("any other day: no stage, only the size", () => {
    const s = squadLive({ day: { phase: "semana", match: j1, kickoff: KO }, squad: SQUAD, matches: [j1] });
    expect(s).toMatchObject({ stage: null, lede: "Los 10 de la temporada." });
    expect(s.rows.size).toBe(0);
  });

  it("a pending duplicate doesn't mark anyone", () => {
    const tags = nightTags([...EVENTS, ev("g4", "goal", 23, { playerId: "jordi", dupOf: "g3" })], true);
    expect(tags.get("jordi")?.some((t) => t.kind === "gol")).toBeFalsy();
  });
});

describe("nightTags with F7's rolling changes", () => {
  it("each player's minutes instead of a chip per change, and his goal never pushed out", () => {
    const rolling: MatchEvent[] = [
      ev("i1", "substitution", 5, { playerId: "fer", inPlayerId: "erik" }),
      ev("i2", "substitution", 10, { playerId: "erik", inPlayerId: "fer" }),
      ev("i3", "substitution", 15, { playerId: "fer", inPlayerId: "erik" }),
      ev("i4", "substitution", 20, { playerId: "erik", inPlayerId: "fer" }),
      ev("i5", "substitution", 25, { playerId: "fer", inPlayerId: "erik" }),
      ev("gE", "goal", 28, { playerId: "erik" }),
    ];
    // (before: three «Entró» chips and no room for his goal)
    expect(nightTags(rolling, false).get("erik")?.map((t) => t.kind)).toEqual(["cambio", "cambio", "cambio"]);
    const tags = nightTags(rolling, false, new Map([["erik", 18], ["fer", 32]]));
    expect(tags.get("erik")?.map((t) => [t.kind, t.text])).toEqual([["minutos", "18 min"], ["gol", "28′"]]);
    expect(tags.get("erik")?.[0].label).toBe("Jugó 18 minutos");
    expect(tags.get("fer")?.map((t) => t.kind)).toEqual(["minutos"]);
  });
});
