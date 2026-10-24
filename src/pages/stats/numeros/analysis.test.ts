import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../../../functions/src/narrated/types";
import type { ClubMatch } from "../../../lib/clubData";
import { numerosActions, numerosMetrics } from "./analysis";
import { seasonData, squadOf } from "./adapt";
import { seasonStrip } from "../../../lib/derived/vidrio/strip";
import { makeND } from "./nd";
import { numerosView, type Act, type NuState } from "./view";
import { loadCatalog } from "./catalog";
import * as narratedEngine from "../../../../functions/src/narrated/engine";

const observation = (id: string, period: number, facts: Observation["facts"], patch: Partial<Observation> = {}): Observation => ({
  id, order: Number(id.replace(/\D/g, "")) || 0, kind: "pass", team: "us", actorId: "a", period,
  time: { from: period === 1 ? 60 : 1500, to: period === 1 ? 120 : 1560, precision: "interval" },
  validity: "valid", facts, ...patch,
});
function match(): ClubMatch {
  return { id: "narrated", status: "finished", seasonId: "season", date: 1, duration: 50, goalsFor: 2, goalsAgainst: 0, starters: ["a", "b", "c"], bench: [],
    events: [{ id: "canonical-pass", type: "pass", playerId: "a", receiverId: "b", minute: 1, period: 1, outcome: "complete" }],
    analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE,
      coverage: ["pass", "save", "keeper", "shot"].map(family => ({ family, team: "us", state: "complete" })),
      observations: [
        observation("p1", 1, { outcome: "complete" }, { canonicalEventId: "canonical-pass", receiverId: "b" }),
        observation("p2", 1, { outcome: "failed" }),
        observation("p3", 1, { outcome: "unknown" }, { actorId: "b" }),
        observation("p4", 1, { outcome: "complete" }, { validity: "void", receiverId: "b" }),
        observation("p5", 1, { outcome: "complete" }, { validity: "pending", receiverId: "b" }),
        observation("p6", 1, { outcome: "complete", restart: "throw_in" }, { receiverId: "b" }),
        observation("p7", 2, { outcome: "complete", bodyPart: "hand" }, { kind: "distribution", receiverId: "b" }),
        observation("p8", 2, { outcome: "complete" }, { actorId: "b", receiverId: "a", quantity: 2 }),
        observation("p9", 2, { outcome: "failed" }),
        observation("p10", 2, { outcome: "complete" }, { actorId: undefined }),
        observation("p11", 2, { outcome: "failed" }, { team: "opponent", actorId: undefined }),
        observation("period1", 1, { intervalStart: 0, intervalEnd: 1440 }, { kind: "context", time: undefined }),
        observation("period2", 2, { intervalStart: 1500, intervalEnd: 3000 }, { kind: "context", time: undefined }),
      ],
    },
  };
}

describe("Números · shared acta calculations", () => {
  it("splits both actual halves, deduplicates linked events and excludes void/pending and non-pass deliveries", () => {
    const m = match();
    const whole = numerosActions([m], { team: "us" });
    const first = numerosActions([m], { team: "us", period: 1 });
    const second = numerosActions([m], { team: "us", period: 2 });
    expect(first.teams.us).toMatchObject({ passes: 3, passesCompleted: 1, passesFailed: 1, passesUnknown: 1 });
    expect(second.teams.us).toMatchObject({ passes: 4, passesCompleted: 3, passesFailed: 1, passesUnknown: 0 });
    expect(whole.teams.us.passes).toBe(first.teams.us.passes + second.teams.us.passes);
    for (const scope of [whole, first, second]) expect(scope.teams.us.passes).toBe(scope.teams.us.passesCompleted + scope.teams.us.passesFailed + scope.teams.us.passesUnknown);
    expect(first.links).toEqual([{ from: "a", to: "b", count: 1, crosses: 0 }]);
    expect(second.links).toEqual([{ from: "b", to: "a", count: 2, crosses: 0 }]);
    expect(first.tramos[5].pas).toBe(0);
    expect(second.tramos[5].pas).toBe(4);
    expect(second.periodWindows).toEqual([{ from: 1500, to: 3000 }]);
    expect(numerosActions([m], { team: "opponent", period: 2 }).teams.opponent.passesFailed).toBe(1);
  });

  it("does not invent a half for an unlabelled interval and keeps catalogue uncertainty", () => {
    const m = match(); m.analysis!.observations.push(observation("unknown-half", 1, { outcome: "complete" }, { period: undefined }));
    expect(numerosActions([m], { team: "us" }).teams.us.passes).toBe(8);
    expect(numerosActions([m], { team: "us", period: 1 }).teams.us.passes).toBe(3);
    expect(numerosMetrics([m], { team: "us", period: 1 }).get("067")).toMatchObject({ value: 3, status: "partial", pending: 2 });
  });

  it("separates confirmed zero from unavailable families, and invalidates memoized metrics on a new acta", () => {
    const m = match(); const filters = { team: "us" as const, period: 2 };
    const metrics = numerosMetrics([m], filters);
    expect(metrics.get("067")?.value).toBe(4);
    expect(metrics.get("272")).toMatchObject({ value: 0, status: "complete" });
    expect(metrics.get("173")).toMatchObject({ value: null, status: "unknown" });
    expect(numerosMetrics([m], filters)).toBe(metrics);
    const next = structuredClone(m); next.analysis!.observations.push(observation("p12", 2, { outcome: "complete" }));
    expect(numerosMetrics([next], filters).get("067")?.value).toBe(5);
  });
  it("calculates only missing requested IDs and keeps cache entries isolated by scope and acta", () => {
    const m = match(), filters = { team: "us" as const, period: 2 };
    const evaluate = vi.spyOn(narratedEngine, "evaluateNarrated");
    try {
      const first = numerosMetrics([m], filters, ["067"]);
      expect([...first.keys()]).toEqual(["067"]);
      const extended = numerosMetrics([m], filters, ["067", "068", "068"]);
      expect(extended).toBe(first);
      expect(evaluate.mock.calls.map(call => call[2])).toEqual([["067"], ["068"]]);
      expect(numerosMetrics([m], filters, ["068"])).toBe(first);
      expect(evaluate).toHaveBeenCalledTimes(2);
      expect(numerosMetrics([m], { ...filters, period: 1 }, ["067"]).get("067")?.value).toBe(3);
      const next = structuredClone(m); next.analysis!.observations.push(observation("extra", 2, { outcome: "complete" }));
      expect(numerosMetrics([next], filters, ["067"]).get("067")?.value).toBe(5);
      expect(first.get("067")?.value).toBe(4);
    } finally { evaluate.mockRestore(); }
  });
});

const state: NuState = {
  place: "juego", upto: 1, playing: false, raceK: "goles", star: null, temporada: "esta", campo: "todo", jug: [], partidos: [], grow: "mesa", sheet: null, sheetId: null,
  rankK: "goles", pick: null, rival: null, campoView: "pases", puesto: "", team: "us", parte: "2", recView: "rachas", cromoK: "todos", evoK: "goles", ysi: {}, sortK: "goles",
  q: "", rq: "", catQ: "", catFam: "", catN: 24, catX: false, allStats: false, colSet: "basico", wsSet: "pases", clockK: "ambos", streakK: "g", evoIds: null, sq: "",
  wsColumns: ["067", "068", "069", "070", "272", "173"],
};
const act: Act = { set: vi.fn(), open: vi.fn(), closeSheet: vi.fn(), go: vi.fn(), grow: vi.fn(), say: vi.fn(), stop: vi.fn(), seek: vi.fn(), narrow: () => false, ask: vi.fn(), csv: vi.fn(), json: vi.fn() };

describe("Números · period-aware table, catalogue and detail", () => {
  async function view(patch: Partial<NuState> = {}, rawMatches: ClubMatch[] = [match()]) {
    const segments = seasonStrip(rawMatches, "season", 100000).segments;
    const S = seasonData({ segments, seasonId: "season", seasonName: "Temporada", league: "Liga", standings: [], mvpOf: () => [], mvpResults: new Map(), porra: null, real: true });
    const people = ["a", "b", "c"].map((id, i) => ({ id, name: id.toUpperCase(), num: String(i + 1), first: "", last: "", line: "", spots: [] }));
    return numerosView({ ...state, ...patch }, { nd: makeND(squadOf(people, S.matches)), S, moment: { edge: rawMatches.length, live: false, closed: false }, others: [], viewer: { kind: "fan", playerId: null, name: "", porraKey: null }, catalog: await loadCatalog(), demo: false, today: "2026-10-24" }, act);
  }
  it("shows real period metrics without requiring a ledger, and the footer includes unattributed actions and weighted rates", async () => {
    const v = await view();
    expect(v.juego.tiles.find(t => t.id === "067")).toMatchObject({ v: "4", status: "ok" });
    expect(v.juego.passes).toEqual({ attempted: 4, completed: 3, failed: 1, unknown: 0 });
    expect(v.ws.foot.find(c => c.key === "067")?.v).toBe("4");
    expect(v.ws.foot.find(c => c.key === "070")?.v).toBe("75%");
    expect(v.ws.rows.reduce((sum, r) => sum + Number(r.cells.find(c => c.key === "067")?.v || 0), 0)).toBe(3);
    expect(v.ws.totalLabel).toContain("sin jugador");
  });
  it("calculates a catalogue metric outside the old 16 tiles and exposes confirmed zeros as selectable", async () => {
    const v = await view({ sheet: "metric", sheetId: "068" });
    expect(v.mt).toMatchObject({ id: "068", v: "3", st: "Completo", noEv: false });
    expect(v.mt?.evid[0].href).toBe("/partidos/narrated/numeros");
    expect(v.ws.columns.find(c => c.key === "272")).toMatchObject({ available: true });
    expect(v.ws.columns.find(c => c.key === "173")).toMatchObject({ available: false, selected: true });
    act.set = vi.fn(); v.ws.columns.find(c => c.key === "173")!.toggle();
    expect(act.set).toHaveBeenCalledWith({ wsColumns: ["067", "068", "069", "070", "272"] });
  });
  it("applies player selection without losing pass recipients and does not attribute rival totals to our players", async () => {
    const own = await view({ jug: ["b"] });
    expect(own.juego.passes).toMatchObject({ attempted: 2, completed: 2 });
    expect(own.juego.pairs[0]).toMatchObject({ a: "B", b: "A", n: 2 });
    expect(own.ws.foot.find(c => c.key === "067")?.v).toBe("2");
    const rival = await view({ team: "them" });
    expect(rival.ws.rows).toEqual([]);
    expect(rival.ws.foot.find(c => c.key === "067")?.v).toBe("1");
  });
  it("keeps unknown player rates last in both sort directions", async () => {
    for (const wsDirection of ["asc", "desc"] as const) {
      const v = await view({ parte: "1", wsSort: "070", wsDirection });
      expect(v.ws.rows.map(r => r.key)).toEqual(["a", "b", "c"]);
      expect(v.ws.rows.slice(1).map(r => r.cells.find(c => c.key === "070")?.v)).toEqual(["-", "-"]);
    }
  });
  it("uses the same participated matches for cards, catalogue, columns and charts", async () => {
    const first = match(), absent = structuredClone(first);
    absent.id = "absent"; absent.date = 2; absent.starters = ["b", "c"]; absent.notCalled = ["a"];
    absent.analysis!.profile = structuredClone(DEFAULT_ANALYSIS_PROFILE);
    absent.analysis!.profile.passes.keeperHands = true;
    absent.events = [];
    absent.analysis!.observations = [observation("other", 2, { outcome: "complete" }, { actorId: "b", receiverId: "c" })];
    const v = await view({ jug: ["a"], upto: 2, sheet: "metric", sheetId: "067" }, [first, absent]);
    expect(v.analysis.matches.map(m => m.id)).toEqual([first.id]);
    expect(v.juego.tiles.find(t => t.id === "067")).toMatchObject({ v: "1", status: "ok" });
    expect(v.mt).toMatchObject({ v: "1", st: "Completo" });
    expect(v.ws.foot.find(c => c.key === "067")?.v).toBe("1");
    expect(v.ws.columns.find(c => c.key === "067")).toMatchObject({ available: true });
    // With no participation, never fall back to unfiltered legacy totals or connections.
    const empty = await view({ jug: ["a"], upto: 1, sheet: "metric", sheetId: "067" }, [absent]);
    expect(empty.analysis.matches).toEqual([]);
    expect(empty.juego.tiles.find(t => t.id === "067")).toMatchObject({ v: "-", status: "none" });
    expect(empty.juego.pairs).toEqual([]);
    expect(empty.juego.tramos.every(t => t.v === 0)).toBe(true);
    expect(empty.mt).toMatchObject({ v: "-", noEv: true });
    expect(empty.ws.columns.find(c => c.key === "067")).toMatchObject({ available: false });
  });
  it("selects every available column across search/family and preserves an intentionally empty selection", async () => {
    const v = await view({ wsQuery: "pases" });
    act.set = vi.fn(); v.ws.selectAll();
    const selected = vi.mocked(act.set).mock.calls[0][0].wsColumns!;
    expect(selected).toContain("272");
    expect(selected).not.toContain("173");
    expect(selected).toHaveLength(v.ws.availableCount);
    v.ws.clearColumns(); expect(act.set).toHaveBeenLastCalledWith({ wsColumns: [] });
    const empty = await view({ wsColumns: [] });
    expect(empty.ws.cols).toEqual([]);
    expect(empty.ws.selectedCount).toBe(0);
  });
  it("finds the pass accuracy column with or without Spanish accents", async () => {
    const v = await view({ wsQuery: "precision de pase" });
    expect(v.ws.columns.map(c => c.key)).toContain("070");
  });
  it("loads metric values for the visible catalogue page and detail while the closed table stays idle", async () => {
    const evaluate = vi.spyOn(narratedEngine, "evaluateNarrated");
    try {
      await view({ grow: null });
      expect(evaluate).toHaveBeenCalledTimes(1);
      expect(evaluate.mock.calls[0][2]).toHaveLength(16);
      expect(evaluate.mock.calls[0][2]).not.toContain("378");
      evaluate.mockClear();
      const catalog = await loadCatalog();
      const visible = catalog.filter(row => !row[5]).slice(0, 24).map(row => row[0]);
      await view({ grow: "catalogo", catN: 24 });
      expect(evaluate).toHaveBeenCalledTimes(1);
      expect(evaluate.mock.calls[0][2]).toEqual(expect.arrayContaining(visible));
      expect(evaluate.mock.calls[0][2]!.length).toBeLessThanOrEqual(40);
      evaluate.mockClear();
      await view({ grow: "catalogo", catQ: "Recuperaciones", catN: 24, sheet: "metric", sheetId: "378" });
      expect(evaluate.mock.calls[0][2]).toContain("378");
      expect(evaluate.mock.calls[0][2]!.length).toBeLessThan(40);
      evaluate.mockClear();
      const table = await view({ grow: "mesa" });
      expect(evaluate.mock.calls[0][2]).toHaveLength(412);
      expect(table.ws.columns).toHaveLength(412);
      expect(table.ws.columns.find(c => c.key === "272")?.available).toBe(true);
    } finally { evaluate.mockRestore(); }
  });
});
