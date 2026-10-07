import { describe, expect, it } from "vitest";
import { chem, hops, links, tierOf } from "./quimica";
import { formRating, buildSquad } from "./ratings";
import { hud, ago, pitchView, positionsOf, FX0 } from "./view";
import { parseV2 } from "./flag";
import type { ClubMatch } from "../../../lib/clubData";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";

const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];

describe("química as light", () => {
  it("links every cromo to its nearest neighbours, scored by fit, assists and matches together", () => {
    const sq = squadOf(demoSquad().list, [["evans", "illescas", { tog: 6, ast: 2 }]]);
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const ls = links(L, sq);
    const back = ls.find((l) => l.i === 0 && l.j === 1);
    expect(back).toMatchObject({ s: 1 + 1 + 2 + 1, t: 3, nat: true });
    // no history together: just the fit
    expect(ls.find((l) => l.i === 0 && l.j === 2)).toMatchObject({ s: 2, t: 2 });
    // neighbours only: the goalkeeper never links to the striker
    expect(ls.some((l) => l.i === 0 && l.j === 6)).toBe(false);
    ls.forEach((l) => expect(l.i).toBeLessThan(l.j));
  });
  it("an out-of-position pair is a weaker link", () => {
    const sq = demoSquad();
    const L = lineupOf(["evans", "adrian", "tello", "huberoski", "eguzquiza", "almachi", "illescas"], "2-3-1", sq);
    const l = links(L, sq).find((x) => x.a === "adrian" || x.b === "adrian");
    expect(l?.nat).toBe(false);
    expect(l?.t).toBe(1);
  });
  it("scores the seven 0–100; empty is 0, full and natural beats out of position", () => {
    const sq = demoSquad();
    expect(chem(lineupOf([]), sq).v).toBe(0);
    const good = chem(lineupOf(SEVEN, "2-3-1", sq), sq);
    const bad = chem(lineupOf(["adrian", "evans", "tello", "huberoski", "eguzquiza", "almachi", "illescas"], "2-3-1", sq), sq);
    expect(good.v).toBeGreaterThan(bad.v);
    expect(good.gk).toBe(true);
    expect(bad.gk).toBe(false);
    expect(good.natN).toBe(7);
    expect(good.v).toBeLessThanOrEqual(100);
    expect(tierOf(90)[0]).toBe("De campeones");
    expect(tierOf(39)[0]).toBe("Floja");
  });
  it("ripples hop by hop from who changed", () => {
    const sq = demoSquad();
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const ch = chem(L, sq);
    const h = hops(L, ch.links, ["evans"]);
    expect(h.get(0)).toBe(0);
    expect([...h.values()].some((d) => d >= 2)).toBe(true);
    expect(hops(L, ch.links, []).size).toBe(0);
  });
});

describe("form rating", () => {
  it("is the design's formula over a 7-match half season", () => {
    // 55 + 7·2 + min(16, 10·1.6) + 150/150·12 + 0 + 2·1.5 = 100 → capped at 96
    expect(formRating({ played: 7, ga: 10, recentMin: 150, recentMax: 150, saves: 0, mvps: 2, games: 7 })).toBe(96);
    // 55 + 3·2 + 1.6 + 60/150·12 = 67.4
    expect(formRating({ played: 3, ga: 1, recentMin: 60, recentMax: 150, saves: 0, mvps: 0, games: 7 })).toBe(67);
    expect(formRating({ played: 0, ga: 0, recentMin: 0, recentMax: 0, saves: 0, mvps: 0, games: 0 })).toBe(55);
  });
  it("scales longer seasons to the same range", () => {
    expect(formRating({ played: 14, ga: 0, recentMin: 0, recentMax: 150, saves: 0, mvps: 0, games: 14 })).toBe(69);
  });
});

describe("the squad from the season's matches", () => {
  const m = (id: string, date: number, ledger: Record<string, { minutes: number; started: boolean; played: boolean }>, events: ClubMatch["events"] = []): ClubMatch =>
    ({ id, date, status: "finished", duration: 50, events, ledger: Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, { goals: 0, assists: 0, penaltySaved: 0, ...v }])) }) as unknown as ClubMatch;
  const players = [
    { id: "a", shirtName: "Aaa", firstName: "A", number: 1, naturalPosition: "POR" as const, injured: false, active: true },
    { id: "b", shirtName: "", firstName: "Álex", number: 2, naturalPosition: "Defensa central", injured: true, active: true },
    { id: "c", shirtName: "Ce", firstName: "C", number: 3, naturalPosition: "DEL" as const, injured: false, active: false },
  ];
  it("counts matches together, assists between them, bajas and the recent window", () => {
    const games = [
      m("g1", 1, { a: { minutes: 50, started: true, played: true }, b: { minutes: 30, started: false, played: true } }, [{ type: "goal", playerId: "b", assistPlayerId: "a" } as never]),
      m("g2", 2, { a: { minutes: 50, started: true, played: true }, b: { minutes: 50, started: true, played: true } }),
    ];
    const sq = buildSquad({ players, games, jornada: new Map([["g1", 4], ["g2", 5]]), suspended: new Set(["a"]), mvps: new Map([["g2", ["a"]]]) });
    expect(sq.pairs.get("a|b")).toEqual({ tog: 2, ast: 1 });
    expect(sq.byId.get("a")?.stats).toMatchObject({ played: 2, minutes: 100, starts: 2, mvps: 1 });
    expect(sq.byId.get("a")?.baja).toBe("Sancionado");
    expect(sq.byId.get("b")?.baja).toBe("Lesionado");
    expect(sq.byId.get("c")?.baja).toBe("Inactivo");
    // names in capitals, positions as codes whatever the spelling stored
    expect(sq.byId.get("b")?.name).toBe("ÁLEX");
    expect(sq.byId.get("b")?.pos).toBe("DEF");
    expect(sq.byId.get("a")?.name).toBe("AAA");
    expect(sq.recentLabel).toBe("J4–J5");
    expect(sq.byId.get("c")?.rt).toBe(55);
  });
});

describe("the HUD", () => {
  const sq = demoSquad();
  it("reads the 7/7 chip", () => {
    const full = lineupOf(SEVEN, "2-3-1", sq);
    expect(hud(full, sq, chem(full, sq), FX0, false, null)).toMatchObject({ valN: "7/7", valTxt: "Listo", valOk: true });
    const noGk = lineupOf([null, ...SEVEN.slice(1)], "2-3-1", sq);
    expect(hud(noGk, sq, chem(noGk, sq), FX0, false, null)).toMatchObject({ valTxt: "Sin POR", valCls: "bad" });
    const outGk = lineupOf(["tello", "illescas", "fer", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
    expect(hud(outGk, sq, chem(outGk, sq), FX0, false, null).valTxt).toBe("POR fuera");
    const short = lineupOf(SEVEN.slice(0, 5), "2-3-1", sq);
    expect(hud(short, sq, chem(short, sq), FX0, false, null).valTxt).toBe("Faltan 2");
    const hurt = lineupOf(["evans", "brawan", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
    expect(hud(hurt, sq, chem(hurt, sq), FX0, false, null)).toMatchObject({ valTxt: "1 aviso", valCls: "warn" });
  });
  it("lights the LED boards: the system, the plan and the match; «¡Siete listo!» on the celebration", () => {
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const h = hud(L, sq, chem(L, sq), FX0, false, { short: "J8 · MAD SKY", date: "sáb 8 nov" });
    expect(h.ledTop).toContain("2-3-1 · PRESIÓN MEDIA · LÍNEA MEDIA · MEDIA");
    expect(h.ledTop).toContain("J8 · MAD SKY");
    expect(h.ledNear).toBe("MANCHESTER PITI · J8 · MAD SKY · SÁB 8 NOV · VAMOS PITI · ");
    const cele = hud(L, sq, chem(L, sq), { ...FX0, cele: true }, false, null);
    expect(cele.ledTop.startsWith("¡SIETE LISTO!")).toBe(true);
    expect(hud(L, sq, chem(L, sq), { ...FX0, cele: true }, true, null).celeOn).toBe(false);
  });
  it("flips the scoreboard digits and shows the rise when the química goes up", () => {
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const v = chem(L, sq).v;
    const h = hud(L, sq, chem(L, sq), { ...FX0, k: 3, from: {}, q0: v - 5 }, false, null);
    expect(h.qUp).toBe(5);
    expect(h.qDigits.every((d) => d.k === "fa")).toBe(true);
    expect(h.ledTop.startsWith("¡SUBE LA QUÍMICA! · +5")).toBe(true);
  });
});

describe("the cromos on the pitch", () => {
  const sq = squadOf([...demoSquad().list, cromo("nopos", 30, undefined)]);
  it("morphs each cromo from where it was drawn, marks out of position, galones and «Tu sitio»", () => {
    const L = { ...lineupOf(["evans", "adrian", "tello", "huberoski", "eguzquiza", "almachi", "nopos"], "2-3-1", sq), roles: { captainId: "tello" } };
    const ch = chem(L, sq);
    const from = positionsOf(L);
    from.tello = [10, 10];
    const v = pitchView({ L, sq, ch, cam: "tv", modo: "editar", fx: { ...FX0, k: 1, from, rip: ["tello"] }, selId: null, pick: null, ro: false, rm: false, meId: "tello" });
    const t = v.cards.find((c) => c.id === "tello")!;
    expect([t.fx, t.fy]).toEqual([10, 10]);
    expect(t.cls).toContain("ma");
    expect(t.cls).toContain("land");
    expect(t.cls).toContain("me");
    expect(t.gal).toEqual(["C"]);
    const a = v.cards.find((c) => c.id === "adrian")!;
    expect(a.oop).toBe(true);
    expect(a.zoneTxt).toBe("DEL›DEF");
    // no natural position known: never out of position
    expect(v.cards.find((c) => c.id === "nopos")?.oop).toBe(false);
    expect(v.gslots).toHaveLength(7);
    expect(v.slots).toHaveLength(0);
  });
  it("shows empty slots, and no ghost slots when read-only or in free mode", () => {
    const L = lineupOf(["evans"], "2-3-1", sq);
    const v = pitchView({ L, sq, ch: chem(L, sq), cam: "tv", modo: "editar", fx: FX0, selId: null, pick: 3, ro: true, rm: false, meId: null });
    expect(v.slots).toHaveLength(6);
    expect(v.slots.find((s) => s.i === 3)?.on).toBe(true);
    expect(v.gslots).toHaveLength(0);
  });
});

describe("small things", () => {
  it("says when it was saved", () => {
    expect(ago(null, 0)).toBe("ahora");
    expect(ago(1000, 30_000)).toBe("ahora");
    expect(ago(0 + 1, 5 * 60_000)).toBe("hace 4 min");
    expect(ago(1, 3 * 3600_000)).toBe("hace 2 h");
    expect(ago(1, 30 * 3600_000)).toBe("ayer");
  });
  it("reads the v2 switch from the URL", () => {
    expect(parseV2("?v2")).toBe(true);
    expect(parseV2("v2=1&season=x")).toBe(true);
    expect(parseV2("?v2=0")).toBe(false);
    expect(parseV2("?season=x")).toBeNull();
    expect(parseV2("")).toBeNull();
  });
});
