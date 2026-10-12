import { describe, expect, it } from "vitest";
import { andList, avisoTxt, avisoUrl, benchGroups, calledOf, convHead, pitchFound, reparto, squadInfo, sysLines, type BenchFilter } from "./bench";
import { slotLabel } from "./geometry";
import { withConvocatoria, type CalMatch } from "./boards";
import { chem } from "./quimica";
import { tacRows } from "./plan";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const M8: CalMatch = { id: "m8", j: 8, rival: "MAD SKY", dateMs: 0, played: false, gf: null, ga: null, home: true, venue: "" };
const OFF: BenchFilter = { on: false, q: "", zf: "Todos", oc: false };
const off = (L: ReturnType<typeof lineupOf>, s = sq) => s.list.filter((c) => !L.slots.some((x) => x.playerId === c.id));

describe("the squad bars", () => {
  it("media of the seven on the pitch, the química's diamonds and the four axes (hi ≥ 80, lo < 50)", () => {
    const L = lineupOf(SEVEN, "2-3-1", sq);
    const ch = chem(L, sq);
    const info = squadInfo(L, sq, ch);
    expect(info.media).toBe(Math.round((87 + 83 + 79 + 95 + 81 + 74 + 96) / 7));
    expect(info.once).toBe("7/7");
    expect(info.bars.map((b) => b.k)).toEqual(["ATA", "DEF", "FOR", "EXP"]);
    expect(info.bars.map((b) => b.v)).toEqual([ch.at, ch.de, ch.fo, ch.ex]);
    info.bars.forEach((b) => expect(b.cls).toBe(b.v >= 80 ? "hi" : b.v < 50 ? "lo" : ""));
    const lit = ch.v >= 80 ? 3 : ch.v >= 60 ? 2 : ch.v >= 35 ? 1 : 0;
    expect(info.dm.filter(Boolean)).toHaveLength(lit);
    const empty = squadInfo(lineupOf([], "2-3-1", sq), sq, chem(lineupOf([], "2-3-1", sq), sq));
    expect(empty).toMatchObject({ media: 0, once: "0/7", dm: [false, false, false] });
  });

  it("each system's lines, as its tile says them", () => {
    expect(sysLines("2-3-1")).toBe("2 DEF · 3 MED · 1 DEL");
    expect(sysLines("3-2-1")).toBe("3 DEF · 2 MED · 1 DEL");
    expect(sysLines("2-1-2-1")).toBe("2 DEF · 3 MED · 1 DEL");
    expect(sysLines("1-3-2")).toBe("1 DEF · 3 MED · 2 DEL");
  });
});

describe("the convocatoria's head", () => {
  const conv = withConvocatoria(sq, new Map([["tello", "no"], ["kevin", "duda"], ["almachi", "duda"], ["erik", "voy"]]));

  it("counts the answers and names who is in doubt", () => {
    const h = convHead({ sq: conv, match: M8, loading: false, error: false });
    expect(h).toMatchObject({ kick: "Convocatoria · J8 · MAD SKY", voy: 1, duda: 2, no: 1, answered: true, dudas: ["ALMACHI", "KEVIN"] });
    expect(h.title).toBe("4 respuestas · 8 sin responder · 2 bajas");
    expect(h.aria).toBe("Respuestas: 1 voy, 2 duda, 1 no va");
  });

  it("the captain's convocatoria counts who it calls (the answers, those without one, the bajas)", () => {
    const h = convHead({ sq: conv, match: { ...M8, conv: { starters: SEVEN, bench: ["kevin"] } }, loading: false, error: false });
    // (erik said «Voy» but isn't called; the two bajas aren't either)
    expect(h.title).toBe("8 convocados · 5 sin responder");
    expect(h).toMatchObject({ voy: 0, duda: 2, no: 1 });
    const withBaja = convHead({ sq: conv, match: { ...M8, conv: { starters: SEVEN, bench: ["kevin", "brawan"] } }, loading: false, error: false });
    expect(withBaja.title).toBe("9 convocados · 6 sin responder · 1 baja");
  });

  it("«Avisar a los que dudan» calls on those in doubt and the called who haven't answered, never a baja or the uncalled", () => {
    const h = convHead({ sq: conv, match: { ...M8, conv: { starters: SEVEN, bench: ["kevin", "brawan"] } }, loading: false, error: false });
    expect(h.aviso).toEqual(["EVANS", "ILLESCAS", "HUBEROSKI", "EGUZQUIZA", "ALMACHI", "ADRIAN", "KEVIN"]);
    // without the captain's list, only those in doubt (nobody is «called» yet)
    expect(convHead({ sq: conv, match: M8, loading: false, error: false }).aviso).toEqual(["ALMACHI", "KEVIN"]);
    expect(avisoTxt(["KEVIN"], M8, avisoUrl("https://piti.club"))).toBe("J8 · MAD SKY: KEVIN, ¿venís? Contestad a la convocatoria en el vestuario: https://piti.club/vestuario");
  });

  it("says what is going on when there is nothing to count", () => {
    expect(convHead({ sq, match: null, loading: false, error: false }).title).toBe("Sin partido a la vista: sin convocatoria.");
    expect(convHead({ sq, match: M8, loading: true, error: false }).title).toBe("Leyendo la convocatoria de J8 · MAD SKY…");
    expect(convHead({ sq, match: M8, loading: false, error: true }).title).toBe("No se ha podido leer la convocatoria de J8 · MAD SKY.");
    expect(convHead({ sq, match: M8, loading: false, error: false })).toMatchObject({ title: "Nadie ha respondido aún a la convocatoria de J8 · MAD SKY.", answered: false, dudas: [] });
  });

  it("«Avisar a los que dudan»: the message for the group", () => {
    expect(andList(["A"])).toBe("A");
    expect(andList(["A", "B", "C"])).toBe("A, B y C");
    expect(avisoTxt(["KEVIN", "ALMACHI"], M8)).toBe("J8 · MAD SKY: KEVIN y ALMACHI, ¿venís? Contestad a la convocatoria en el vestuario.");
    expect(avisoTxt([], M8)).toBeNull();
  });

  it("who the captain called (none = nobody is left out)", () => {
    expect(calledOf(null)).toBeNull();
    expect(calledOf({ ...M8, conv: { starters: [], bench: [] } })).toBeNull();
    expect(calledOf({ ...M8, conv: { starters: ["a"], bench: ["b"] } })).toEqual(new Set(["a", "b"]));
  });
});

describe("the bench", () => {
  const conv = withConvocatoria(sq, new Map([["tello", "no"], ["kevin", "duda"], ["erik", "voy"]]));
  const L = lineupOf(["evans", "illescas", null, "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", conv);

  it("Banquillo (voy, duda, no, unanswered), Sin convocar and Bajas, with the FUT row's data", () => {
    const g = benchGroups({ bench: off(L, conv), called: null, filter: OFF, hand: null, selId: null, meId: "kevin" });
    expect(g.map((x) => [x.t, x.rows.map((r) => r.id)])).toEqual([
      ["Banquillo", ["erik", "kevin", "tello", "fer"]],
      ["Sin convocar", []],
      ["Bajas", ["brawan", "andia"]],
    ]);
    expect(g[1].emptyTxt).toBe("Nadie fuera de la convocatoria.");
    const [erik, kevin, tello, fer] = g[0].rows;
    expect(erik).toMatchObject({ cvCls: "voy", cv: "Voy", icon: "check", zone: "b", line: "0 PJ · 0 G · 0 A · 0'", tg: null });
    expect(kevin).toMatchObject({ cvCls: "duda", icon: "doubt", me: true });
    expect(kevin.aria).toBe("KEVIN, dorsal 11, DEL, forma 75, convocatoria: duda, 0 minutos esta temporada, eres tú");
    expect(tello).toMatchObject({ cvCls: "no", cv: "No va", icon: "x" });
    expect(tello.cls).toContain("no-va");
    expect(fer).toMatchObject({ cvCls: "sin", cv: "Sin respuesta", icon: null });
    expect(fer.cls).toContain("gk");
    const [brawan, andia] = g[2].rows;
    expect(brawan).toMatchObject({ zone: "x", baja: true, cvCls: "les", cv: "Lesionado", icon: "x" });
    expect(brawan.aria).toMatch(/lesionado, no disponible/);
    expect(andia).toMatchObject({ cvCls: "san", cv: "Sancionado" });
    const ina = benchGroups({ bench: [cromo("x", 7, "MED", { baja: "Inactivo" })], called: null, filter: OFF, hand: null, selId: null, meId: null });
    expect(ina[2].rows[0]).toMatchObject({ cvCls: "ina", cv: "Inactivo", zone: "x" });
  });

  it("the captain's convocatoria leaves the others «Sin convocar»", () => {
    const g = benchGroups({ bench: off(L, conv), called: new Set([...SEVEN, "erik"]), filter: OFF, hand: null, selId: "erik", meId: null });
    expect(g[0].rows.map((r) => r.id)).toEqual(["erik", "tello"]);
    expect(g[0].rows[0].sel).toBe(true);
    expect(g[1].rows.map((r) => [r.id, r.cv, r.cvCls])).toEqual([
      ["fer", "Sin convocar", "sin"],
      ["kevin", "Sin convocar", "sin"],
    ]);
  });

  it("while someone is in the hand the ones who can come in are targets (the natural fit is the best)", () => {
    const slot = benchGroups({ bench: off(L, conv), called: null, filter: OFF, hand: { kind: "slot", zone: "DEF" }, selId: null, meId: null });
    const by = (id: string) => slot.flatMap((x) => x.rows).find((r) => r.id === id)!;
    expect(by("erik")).toMatchObject({ tg: "Entra aquí" });
    expect(by("erik").aria).toMatch(/\. Toca: entra en el hueco$/);
    expect(by("tello").tg).toBeNull(); // said no
    expect(by("brawan").tg).toBeNull(); // baja
    expect(by("fer").cls).toContain("tgt");
    expect(by("fer").cls).not.toContain("best");
    const p = benchGroups({ bench: off(L, conv), called: null, filter: OFF, hand: { kind: "p", name: "ADRIAN", zone: "DEL" }, selId: null, meId: null });
    const kevin = p[0].rows.find((r) => r.id === "kevin")!;
    expect(kevin).toMatchObject({ tg: "Entra por él" });
    expect(kevin.cls).toContain("best");
    expect(kevin.aria).toMatch(/\. Toca: entra por ADRIAN$/);
  });

  it("«Buscar en la plantilla» filters only while it is open", () => {
    const run = (f: Partial<BenchFilter>) => benchGroups({ bench: off(L, conv), called: null, filter: { ...OFF, ...f }, hand: null, selId: null, meId: null });
    expect(run({ q: "kev" })[0].rows).toHaveLength(4);
    expect(run({ on: true, q: "kev" })[0].rows.map((r) => r.id)).toEqual(["kevin"]);
    expect(run({ on: true, q: "12" })[0].rows.map((r) => r.id)).toEqual(["fer"]);
    expect(run({ on: true, zf: "POR" })[0].rows.map((r) => r.id)).toEqual(["fer"]);
    const oc = run({ on: true, oc: true });
    expect(oc[0].rows.map((r) => r.id)).toEqual(["erik"]);
    expect(oc[2].emptyTxt).toBe("Nadie con ese filtro.");
  });

  it("«Buscar en la plantilla» finds the ones on the pitch too (with their slot), only while it filters", () => {
    const lab = (i: number) => slotLabel(L, i);
    expect(pitchFound(L, conv, { ...OFF, on: true, q: "hub" }, lab)).toEqual([{ id: "huberoski", name: "HUBEROSKI", num: 14, slot: "MI" }]);
    expect(pitchFound(L, conv, { ...OFF, on: true, q: "10" }, lab).map((h) => h.slot)).toEqual(["DC"]);
    expect(pitchFound(L, conv, { ...OFF, on: true, zf: "DEF" }, lab).map((h) => h.id)).toEqual(["illescas"]);
    expect(pitchFound(L, conv, { ...OFF, on: true }, lab)).toEqual([]);
    expect(pitchFound(L, conv, { ...OFF, q: "hub" }, lab)).toEqual([]);
  });
});

describe("the reparto de minutos", () => {
  const mins = squadOf([
    cromo("gk", 1, "POR", { stats: { played: 5, goals: 0, assists: 0, minutes: 250, starts: 5, mvps: 0 } }),
    cromo("a", 2, "DEF", { stats: { played: 5, goals: 0, assists: 0, minutes: 300, starts: 5, mvps: 0 } }),
    cromo("b", 3, "DEF", { stats: { played: 1, goals: 0, assists: 0, minutes: 20, starts: 0, mvps: 0 } }),
    cromo("c", 4, "MED", { stats: { played: 2, goals: 0, assists: 0, minutes: 60, starts: 0, mvps: 0 }, cv: "no" }),
    cromo("d", 5, "MED", { stats: { played: 3, goals: 0, assists: 0, minutes: 120, starts: 0, mvps: 0 }, baja: "Lesionado" }),
  ]);

  it("the outfield players who can play, least first; the siete marked; the change that evens it", () => {
    const L = lineupOf(["gk", "a"], "2-3-1", mins);
    const r = reparto(L, mins, null);
    expect(r.rows.map((x) => [x.id, x.inS, x.min])).toEqual([
      ["b", false, "20′"],
      ["a", true, "300′"],
    ]);
    expect(r.rows[1].m).toBe("100%");
    expect(r.rot).toEqual({ id: "b", i: 1, out: "a" });
    expect(r.txt).toBe("B lleva 20′; A, 300′.");
    expect(reparto(lineupOf(["gk"], "2-3-1", mins), mins, null)).toMatchObject({ rot: null, txt: "El reparto está equilibrado." });
    // uncalled players are left out
    expect(reparto(L, mins, new Set(["gk", "a"])).rows.map((x) => x.id)).toEqual(["a"]);
  });
});

describe("the plan's cards", () => {
  it("every consigna carries what it tells the team", () => {
    const rows = tacRows(lineupOf([], "2-3-1", sq));
    expect(rows.map((r) => r.ct)).toEqual(["Línea media", "Presión media", "Amplitud media", "Equilibrados", "Ritmo medio", "Salida mixta", "Por todo el frente"]);
    expect(rows[0].cd).toBe("Ni encima del portero ni a la espalda.");
  });
});
