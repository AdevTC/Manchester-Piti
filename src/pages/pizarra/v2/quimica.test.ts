import { describe, expect, it } from "vitest";
import { chem, hops, links, tierOf } from "./quimica";
import { formRating, buildSquad } from "./ratings";
import { hud, ago, pitchView, positionsOf, FX0 } from "./view";
import type { ClubMatch } from "../../../lib/clubData";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";

const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];

describe("química as light", () => {
  it("links every cromo to its nearest neighbours, scored by fit, assists and minutes together", () => {
    // 7 matches of 50′: 300′ together is more than half the team's minutes
    const sq = squadOf(demoSquad().list, [["evans", "illescas", { tog: 6, min: 300, ast: 2 }]]);
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const ls = links(L, sq);
    const back = ls.find((l) => l.i === 0 && l.j === 1);
    expect(back).toMatchObject({ s: 1 + 2 + 2, t: 3, nat: true, min: 300 });
    // no minutes together: the fit alone is a weak link
    expect(ls.find((l) => l.i === 0 && l.j === 2)).toMatchObject({ s: 1, t: 1 });
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
  const base = { teamW: 10, playedW: 0, shareW: 0, minW: 0, gaW: 0, concW: 0, mvpW: 0, cardsW: 0, savesW: 0 };
  // four matches of 50′, the last three counting double: Σw = 7
  const allIn = { ...base, teamW: 7, playedW: 7, shareW: 7, minW: 350 };
  it("is null before the first match (shown as «—»)", () => {
    expect(formRating(base)).toBeNull();
  });
  it("follows the documented formula", () => {
    // presence 1, nothing else, a forward: 45 + 50·0.35 = 62.5 → 63
    expect(formRating({ ...allIn, role: "DEL" })).toBe(63);
    // + 1.5 G+A per 90 and an MVP every match: 45 + 50·(0.35 + 0.45 + 0.2) = 95, the top
    expect(formRating({ ...allIn, role: "DEL", gaW: 50, mvpW: 7 })).toBe(95);
    // a keeper who concedes nothing: defence = 1 − (3·90 / 440) / 6 ≈ 0.90
    expect(formRating({ ...allIn, role: "POR" })).toBe(Math.round(45 + 50 * (0.35 + 0.45 * (1 - (3 * 90) / 440 / 6))));
  });
  it("spreads the squad over 45–95: a scorer in form, a regular, a cameo", () => {
    const scorer = formRating({ ...allIn, role: "DEL", gaW: 12 })!;
    const regular = formRating({ ...allIn, role: "MED" })!;
    const cameo = formRating({ ...base, role: "DEL", playedW: 1, shareW: 0.2, minW: 10 })!;
    expect(scorer).toBeGreaterThan(regular);
    expect(regular).toBeGreaterThan(cameo);
    expect(cameo).toBeGreaterThanOrEqual(45);
    expect(scorer).toBeLessThanOrEqual(95);
    expect(scorer - cameo).toBeGreaterThanOrEqual(25);
  });
  it("a defender who concedes less while on the pitch is in better form; cards cost", () => {
    const solid = formRating({ ...allIn, role: "DEF", concW: 2 })!;
    const leaky = formRating({ ...allIn, role: "DEF", concW: 20 })!;
    expect(solid).toBeGreaterThan(leaky);
    expect(formRating({ ...allIn, role: "MED", cardsW: 7 })!).toBeLessThan(formRating({ ...allIn, role: "MED" })!);
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
  it("counts matches and minutes together, assists between them, bajas and the recent window", () => {
    const games = [
      m("g1", 1, { a: { minutes: 50, started: true, played: true }, b: { minutes: 30, started: false, played: true } }, [{ type: "goal", playerId: "b", assistPlayerId: "a" } as never]),
      m("g2", 2, { a: { minutes: 50, started: true, played: true }, b: { minutes: 50, started: true, played: true } }),
    ];
    const sq = buildSquad({ players, games, jornada: new Map([["g1", 4], ["g2", 5]]), suspended: new Set(["a"]), mvps: new Map([["g2", ["a"]]]) });
    // (no stints in these ledgers: the shorter of their minutes, 30′ + 50′)
    expect(sq.pairs.get("a|b")).toEqual({ tog: 2, ast: 1, min: 80 });
    expect(sq.byId.get("a")?.stats).toMatchObject({ played: 2, minutes: 100, starts: 2, mvps: 1 });
    expect(sq.byId.get("a")?.baja).toBe("Sancionado");
    expect(sq.byId.get("a")?.sancion).toBeUndefined();
    // with chemistry.suspensions(): what is left and why ride on the cromo (an injury still wins the baja)
    const map = new Map([
      ["a", { left: 2, source: "manual" as const, reason: "Federación" }],
      ["b", { left: 1, source: "acta" as const }],
    ]);
    const sq2 = buildSquad({ players, games, jornada: new Map([["g1", 4], ["g2", 5]]), suspended: map, mvps: new Map() });
    expect(sq2.byId.get("a")).toMatchObject({ baja: "Sancionado", sancion: { left: 2, reason: "Federación" } });
    expect(sq2.byId.get("b")?.baja).toBe("Lesionado");
    expect(sq2.byId.get("b")?.sancion).toBeUndefined();
    expect(sq.byId.get("b")?.baja).toBe("Lesionado");
    expect(sq.byId.get("c")?.baja).toBe("Inactivo");
    // names in capitals, positions as codes whatever the spelling stored
    expect(sq.byId.get("b")?.name).toBe("ÁLEX");
    expect(sq.byId.get("b")?.pos).toBe("DEF");
    expect(sq.byId.get("a")?.name).toBe("AAA");
    expect(sq.recentLabel).toBe("J4–J5");
    // never played: no form yet, the floor for sorting and «—» on the cromo
    expect(sq.byId.get("c")).toMatchObject({ rt: 45, unrated: true, why: "Sin partidos esta temporada" });
    expect(sq.teamMin).toBe(100);

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
    expect(a.zoneTxt).toBe("DEL›DFC"); // his line › the slot's exact code
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
});
