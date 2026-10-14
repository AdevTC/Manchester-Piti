import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../../../lib/clubData";
import { buildSquad, whyOf, type SquadPlayer } from "./ratings";
import { chem, togTxt } from "./quimica";
import { sevenMinutes, tape } from "./compare";
import { reparto } from "./bench";
import { cromo, lineupOf, squadOf } from "./testkit";

// The pizarra prints only the minutes the actas know (derived/minutesOf): a legacy acta (no ledger) adds
// no invented minutes to anything printed — «N partidos juntos», «—» — while the scores (form, links,
// the DEF bar) keep estimating presence internally, as before.

const row = (minutes: number) => ({ played: minutes > 0, started: true, minutes, secondsPlayed: minutes * 60, goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, stints: [] }) as unknown as Participation;
const ledgerMatch = (id: string, ledger: Record<string, Participation>): ClubMatch => ({ id, status: "finished", duration: 50, goalsFor: 1, goalsAgainst: 0, events: [], ledger });
const legacyMatch = (id: string, ids: string[]): ClubMatch => ({ id, status: "finished", duration: 50, goalsFor: 1, goalsAgainst: 0, events: ids.map((p, i) => ({ id: `${id}-${i}`, type: "match_played", playerId: p })) });
const sp = (id: string, pos = "DEF"): SquadPlayer => ({ id, shirtName: id.toUpperCase(), firstName: id, number: 1, naturalPosition: pos, injured: false, active: true });
const squad = (games: ClubMatch[]) => buildSquad({ players: [sp("ana"), sp("bea")], games, jornada: new Map(), suspended: new Set(), mvps: new Map() });

describe("minutes together: printed only when the actas know them", () => {
  it("ledger matches only: «N′ juntos»; with a legacy acta among them: «N partidos juntos» (the score keeps the estimate)", () => {
    const known = squad([ledgerMatch("a", { ana: row(50), bea: row(30) })]).pairs.get("ana|bea")!;
    expect(known).toMatchObject({ tog: 1, min: 30, known: 30 });
    expect(togTxt({ tog: known.tog, known: known.known ?? 0, unk: !!known.unk })).toBe("30′ juntos");
    const mixed = squad([ledgerMatch("a", { ana: row(50), bea: row(30) }), legacyMatch("b", ["ana", "bea"])]).pairs.get("ana|bea")!;
    expect(mixed).toMatchObject({ tog: 2, min: 80, known: 30, unk: true });
    expect(togTxt({ tog: mixed.tog, known: mixed.known ?? 0, unk: !!mixed.unk })).toBe("2 partidos juntos");
    expect(togTxt({ tog: 0, known: 0, unk: false })).toBe("sin minutos juntos");
  });

  it("the cromo prints no invented minutes, but presenceMin (internal) still estimates the legacy acta", () => {
    const c = squad([legacyMatch("b", ["ana"])]).byId.get("ana")!;
    expect(c.stats).toMatchObject({ played: 1, minutes: 0, timed: 0 });
    expect(c.presenceMin).toBe(50);
    expect(c.form).toEqual([{ j: null, played: true, min: null, ga: 0 }]);
  });

  it("whyOf says how many of the recent matches have minutes when some do not", () => {
    const r = { played: 3, goals: 0, assists: 0, mvps: 0, clean: 0, minutes: 80, timed: 2 };
    expect(whyOf(r, "MED", 3)).toBe("80 minutos en sus 3 últimos (2 con minutos), sin goles");
    expect(whyOf({ ...r, timed: 3 }, "MED", 3)).toBe("80 minutos en sus 3 últimos, sin goles");
    expect(whyOf({ ...r, timed: 0, minutes: 0 }, "MED", 3)).toBe("Jugó en sus 3 últimos, sin goles");
  });
});

describe("totals from unknown minutes print «—», never «0′»", () => {
  const unknown = { played: 3, goals: 0, assists: 0, minutes: 0, timed: 0, starts: 0, mvps: 0 };
  const sq = squadOf([
    cromo("gk", 1, "POR", { stats: unknown }),
    cromo("a", 2, "DEF", { stats: unknown, presenceMin: 150 }),
    cromo("b", 3, "DEF", { stats: { ...unknown, minutes: 120, timed: 3 } }),
    cromo("c", 5, "MED", { stats: unknown }),
    cromo("d", 6, "MED", { stats: { ...unknown, minutes: 40, timed: 1, played: 1 } }),
    cromo("e", 7, "MED", { stats: { ...unknown, played: 1 } }),
    cromo("f", 8, "MED", { stats: { ...unknown, minutes: 90, timed: 2, played: 2 } }),
  ]);

  it("«Minutos del siete»: «—» for a seven whose minutes nobody knows, and no winner against it", () => {
    const A = lineupOf(["gk", "a", null, "c"], "2-3-1", sq);
    const B = lineupOf(["gk", "b"], "2-3-1", sq);
    expect(sevenMinutes(A, sq)).toBeNull();
    expect(sevenMinutes(B, sq)).toBe(120);
    expect(tape(A, B, sq).find((r) => r.k === "Minutos del siete")).toEqual({ k: "Minutos del siete", a: "—", b: "120′", ca: "", cb: "" });
  });

  it("the química's lines: «—» (unk) for a line of unknowns; the DEF bar still scores presence", () => {
    const L = lineupOf(["gk", "a", null, "c"], "2-3-1", sq);
    const ch = chem(L, sq);
    expect(ch.lines.find((l) => l.z === "DEF")).toMatchObject({ min: 0, unk: true });
    expect(ch.lines.find((l) => l.z === "MED")).toMatchObject({ unk: true });
    expect(ch.lines.find((l) => l.z === "DEL")).toMatchObject({ unk: false });
    const noPresence = squadOf(sq.list.map((c) => (c.id === "a" ? { ...c, presenceMin: undefined } : c)));
    expect(ch.de).toBeGreaterThan(chem(L, noPresence).de);
  });

  it("the reparto: unknown minutes are not «who played least» (after the known, by matches, no bar, «—»)", () => {
    const L = lineupOf(["gk", "b", null, null, null, null, "f"], "2-3-1", sq);
    const rp = reparto(L, sq, null);
    expect(rp.rows.map((r) => r.id)).toEqual(["d", "f", "b", "e", "a", "c"]);
    expect(rp.rows.find((r) => r.id === "e")).toMatchObject({ m: "0%", min: "—" });
    expect(rp.rot?.id ?? null).not.toBe("e");
    expect(rp.txt).not.toMatch(/0′/);
  });
});

describe("a player who never played is a known 0, not unknown", () => {
  const base = { goals: 0, assists: 0, starts: 0, mvps: 0 };
  const sq = squadOf([
    cromo("gk", 1, "POR", { stats: { ...base, played: 3, minutes: 150, timed: 3 } }),
    cromo("b", 2, "DEF", { stats: { ...base, played: 3, minutes: 120, timed: 3 } }),
    cromo("u", 3, "DEF", { stats: { ...base, played: 3, minutes: 0, timed: 0 } }),
    cromo("z", 4, "DEF", { stats: { ...base, played: 0, minutes: 0, timed: 0 } }),
  ]);

  it("he surfaces in «Darle minutos» as who has played least, for the one with most known minutes", () => {
    const rp = reparto(lineupOf(["gk", "b", "u"], "2-3-1", sq), sq, null);
    expect(rp.rows.map((r) => [r.id, r.min])).toEqual([["z", "0′"], ["b", "120′"], ["u", "—"]]);
    expect(rp.rot).toMatchObject({ id: "z", out: "b" });
    expect(rp.txt).toBe("Z lleva 0′; B, 120′.");
  });

  it("an outgoing player whose minutes nobody knows: the words leave his minutes out", () => {
    const rp = reparto(lineupOf(["gk", "u"], "2-3-1", sq), sq, null);
    expect(rp.rot).toMatchObject({ id: "z", out: "u" });
    expect(rp.txt).toBe("Z lleva 0′; entra por U.");
  });

  it("a seven or a line of never-played players is «0′», not «—»", () => {
    const L = lineupOf([null, "z"], "2-3-1", sq);
    expect(sevenMinutes(L, sq)).toBe(0);
    expect(chem(L, sq).lines.find((l) => l.z === "DEF")).toMatchObject({ min: 0, unk: false });
  });
});
