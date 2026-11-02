// r14 · the pure data modules of the pizarra (plan, rival, «Si pasa…», reactions' version, guesses, quedada,
// pachanga from the entreno, prefs, the acta's moment, voices by content, history, mesa, fan view, lineupDoc).
import { describe, expect, it } from "vitest";
import { parsePlan, planToData } from "./plan";
import { dangerOf, parseRivalPlan, rivalPlanToData, setRivalDanger, setRivalVisible } from "./rival";
import { COND_KEEP, condPlanToData, liveRules, parseCondPlanR14 } from "./condPlan";
import { currentReactions, mapReactionR14 } from "./sevenRev";
import { guessHits, guessLine, guessWrite, mapGuess } from "./guesses";
import { quedadaError, mapQuedada } from "./quedada";
import { comesFromTraining, mapAttendance, pachangaTraining } from "./attendance";
import { parsePrefs, PREFS_DEFAULT } from "./prefs";
import { actaMoments, momentLabel, scoreAt, setPlayMoment } from "./moment";
import { huecoVoz, isLegacyVozKey, isVozKey, jugadaVoz, mapVozR14, sieteVoz, vozByKey, vozOrphans, vozSlotFor } from "./voz";
import { historyDiff, mapHistory, restoreFrom } from "./history";
import { mesaPlanOf, mesaSuggestions, penaltyTaker, versionChanges, versionOf } from "./mesa";
import { charlaHref, isMesaCopy, mesaCopiesToClean } from "./boards";
import { fanPath, parseFanBoard } from "./fan";
import { parseSeasonPlayRefs, withSeasonPlay } from "./seasonPlayRefs";
import { boardToData, dataToLineupDoc, extractLineup, lineupToData } from "../lineupDoc";
import { emptySlots } from "../formations";
import { defaultTactics } from "../tactics";
import { playToData } from "../plays";
import type { Play } from "../../../lib/schemas";

const seven = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];
const slotsOf = (ids: (string | null)[]) => emptySlots("2-3-1").map((s, i) => ({ ...s, playerId: ids[i] ?? null }));

describe("el plan (PZ-D22P/D23P)", () => {
  it("reads claves, viz, notes and parado, repairing what is wrong", () => {
    const p = parsePlan({ claves: ["  Presión alta  ", "", "Centros atrás", "Cuarta", "Quinta"], viz: [{ icon: "spark", zona: "arriba" }, { icon: "nope", zona: "su7" }], notes: "Si nos encierran, Plan B.", parado: { corners: { playId: "lib-corner", box: ["erik", "erik", 3, "alcides"] }, penalties: { rechace: ["adrian"] } } });
    expect(p).toEqual({
      claves: ["Presión alta", "Centros atrás", "Cuarta"],
      viz: [{ icon: "spark", zona: "arriba" }, { icon: "flag", zona: "su7" }],
      notes: "Si nos encierran, Plan B.",
      parado: { corners: { playId: "lib-corner", box: ["erik", "alcides"] }, freekicks: { playId: null, box: [] }, penalties: { rechace: ["adrian"] } },
    });
    expect(parsePlan(undefined)).toBeUndefined();
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan("nada")).toBeNull();
  });
  it("writes back the same shape (round trip)", () => {
    const p = parsePlan({ claves: ["A", "B"], viz: [{ icon: "eye", zona: "su7" }], notes: "x", parado: null })!;
    expect(parsePlan(planToData(p))).toEqual(p);
    expect(planToData(null)).toBeNull();
  });
});

describe("el rival se guarda (PZ-D21P)", () => {
  const raw = { formation: "2-3-1", players: [{ num: 1 }, {}, {}, { num: 7, note: "El mejor: encima" }, {}, {}, {}], visible: false, danger: 3 };
  it("keeps visible and danger; drops a bad danger", () => {
    const r = parseRivalPlan(raw)!;
    expect(r.visible).toBe(false);
    expect(r.danger).toBe(3);
    expect(rivalPlanToData(r)).toMatchObject({ visible: false, danger: 3 });
    expect(parseRivalPlan({ ...raw, danger: 9 })!.danger).toBeUndefined();
    expect(rivalPlanToData(parseRivalPlan({ formation: "2-3-1", players: [] })!)).not.toHaveProperty("visible");
  });
  it("finds the danger man and toggles", () => {
    const r = parseRivalPlan({ ...raw, danger: undefined })!;
    expect(dangerOf(r)).toMatchObject({ i: 3, num: 7 });
    expect(setRivalDanger(r, 1).danger).toBe(1);
    expect(setRivalVisible(setRivalVisible(r, true), false).visible).toBe(false);
    expect(setRivalVisible(r, false)).toBe(r);
  });
});

describe("«Si pasa…» con versión (PZ-D07)", () => {
  const rules = [
    { id: "c1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", sub: { out: "alcides", in: "brawan" }, ver: "planb" },
    { id: "c2", when: "empate", by: 0, from: 40, key: "press", value: COND_KEEP, ver: "segunda" },
    { id: "c3", when: "ganando", by: 1, from: 0, key: "press", value: "Inventada" },
  ];
  it("keeps ver and «sin cambiar nada»; drops an invalid value", () => {
    const r = parseCondPlanR14(rules);
    expect(r.map((x) => x.id)).toEqual(["c1", "c2"]);
    expect(r[0].ver).toBe("planb");
    expect(condPlanToData(r)[1]).toEqual({ id: "c2", when: "empate", by: 0, from: 40, key: "press", value: "=", ver: "segunda" });
  });
  it("la mesa: the rules that hold, with the cambio only when it can be made", () => {
    const r = parseCondPlanR14(rules);
    const on = new Set(seven);
    expect(liveRules(r, { minute: 30, gf: 0, ga: 1, onPitch: on })).toEqual([]);
    const now = liveRules(r, { minute: 36, gf: 0, ga: 1, onPitch: on });
    expect(now).toHaveLength(1);
    expect(now[0]).toMatchObject({ consigna: { key: "mentality", value: "Ofensiva" }, sub: { out: "alcides", in: "brawan" }, ver: "planb" });
    expect(liveRules(r, { minute: 36, gf: 0, ga: 1, onPitch: new Set(["brawan"]) })[0].sub).toBeNull();
    expect(liveRules(r, { minute: 41, gf: 1, ga: 1 })[0]).toMatchObject({ consigna: null, ver: "segunda" });
  });
});

describe("las reacciones vuelven a empezar (PZ-D01)", () => {
  it("a reaction without rev is version 0; only the current version counts", () => {
    const a = mapReactionR14("u1", { value: "ok" })!;
    const b = mapReactionR14("u2", { value: "dudas", rev: 2 })!;
    expect(a.rev).toBe(0);
    expect(currentReactions([a, b], 2)).toEqual([b]);
    expect(currentReactions([a, b], 0)).toEqual([a]);
    expect(mapReactionR14("u3", { value: "meh" })).toBeNull();
  });
});

describe("Adivina el siete (PZ-D04)", () => {
  it("hits and exact places against the official", () => {
    const off = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];
    const h = guessHits(["evans", "erik", "fer", "jordi", "adrian", "kevin", "alcides"], off);
    expect(h).toEqual({ hits: 6, exact: 4 });
    expect(guessLine(h)).toBe("Acertaste 6 de 7 · 4 en su sitio");
    expect(guessLine(guessHits(off, off))).toBe("Acertaste los 7 · 7 en su sitio");
  });
  it("a guess needs seven different players", () => {
    expect(() => guessWrite(["a", "b", null, "d", "e", "f", "g"])).toThrow("Pon a los siete");
    expect(() => guessWrite(["a", "a", "c", "d", "e", "f", "g"])).toThrow("dos veces");
    expect(guessWrite(seven).slots).toEqual(seven);
    expect(mapGuess("u", { slots: seven, at: 5 })).toEqual({ uid: "u", slots: seven, at: 5 });
    expect(mapGuess("u", { slots: ["a"] })).toBeNull();
  });
});

describe("la quedada (PZ-D03)", () => {
  it("checks and reads", () => {
    expect(quedadaError({ at: 10, where: " " })).toBe("Di dónde quedáis.");
    expect(quedadaError({ at: 10, where: "Puerta" }, 5)).toBe("La quedada tiene que ser antes del partido.");
    expect(quedadaError({ at: 4, where: "Puerta" }, 5)).toBeNull();
    expect(mapQuedada("j3", { at: { toMillis: () => 99 }, where: "Puerta del campo", by: "u" })).toEqual({ matchId: "j3", at: 99, where: "Puerta del campo", note: "", by: "u" });
    expect(mapQuedada("j3", { where: "x", by: "u" })).toBeNull();
  });
});

describe("la pachanga del entreno (PZ-D09)", () => {
  const t = { id: "t1", slots: [], note: "", proposedBy: "u", proposedByName: "", lastSlotAt: 0, confirmed: { slotId: "s2", at: 1000, place: "", byName: "" } };
  it("who said «voy» to the confirmed slot", () => {
    const votes = [
      { uid: "a", slotIds: ["s1", "s2"], name: "erik9", playerId: "erik" },
      { uid: "b", slotIds: ["s1"], name: "fer", playerId: "fer" },
      { uid: "c", slotIds: ["s2"], name: "Marta", playerId: null },
    ];
    expect(comesFromTraining(t, votes)).toEqual({ present: ["erik"], guests: ["Marta"], slotId: "s2" });
    expect(comesFromTraining({ confirmed: undefined }, votes)).toEqual({ present: [], guests: [], slotId: null });
    expect(pachangaTraining([t], 500)?.id).toBe("t1");
    expect(pachangaTraining([{ ...t, confirmed: undefined }], 500)).toBeNull();
    expect(mapAttendance("t1", { slotId: "s2", present: ["erik"], by: "u" })).toMatchObject({ present: ["erik"], guests: [] });
  });
});

describe("los ajustes te siguen (PZ-D21E)", () => {
  it("bad or unknown values fall back", () => {
    expect(parsePrefs({ sonido: true, camara: "dron", capa: "quimica", extra: 1 })).toEqual({ ...PREFS_DEFAULT, sonido: true, capa: "quimica" });
    expect(parsePrefs("x")).toEqual(PREFS_DEFAULT);
  });
});

describe("la jugada de verdad (PZ-D21J)", () => {
  const events = [
    { id: "e2", type: "opponent_goal", minute: 14 },
    { id: "e1", type: "goal", minute: 6, playerId: "alcides" },
    { id: "e3", type: "substitution", minute: 15 },
    { id: "e5", type: "goal", minute: 21, playerId: "erik" },
  ];
  it("lists, names and scores the moment", () => {
    expect(actaMoments(events).map((e) => e.id)).toEqual(["e1", "e2", "e5"]);
    expect(momentLabel({ matchId: "j2", min: 6, eventId: "e1" }, { jornada: 2, event: events[1], name: (id) => id.toUpperCase() })).toBe("J2 · 6′ · gol de ALCIDES");
    expect(momentLabel({ matchId: "j2", min: 14 }, { jornada: null, name: (id) => id })).toBe("14′");
    expect(scoreAt(events, 21)).toEqual({ gf: 2, ga: 1 });
  });
  it("the play keeps its moment when stored", () => {
    const play: Play = { id: "j", name: "Córner", kind: "corner", frames: [{ players: {}, ball: { x: 1, y: 1 }, rivals: [], arrows: [] }, { players: {}, ball: { x: 2, y: 2 }, rivals: [], arrows: [] }] };
    const tied = setPlayMoment(play, { matchId: "j2", min: 23, eventId: "e9" });
    expect(playToData(tied).moment).toEqual({ matchId: "j2", min: 23, eventId: "e9" });
    expect(setPlayMoment(tied, null)).not.toHaveProperty("moment");
    expect(setPlayMoment(play, null)).toBe(play);
  });
});

describe("la voz va con su contenido (PZ-D22F)", () => {
  it("keys by content; old keys read as orphans", () => {
    expect(isVozKey(sieteVoz("erik"))).toBe(true);
    expect(isVozKey(huecoVoz("MC"))).toBe(true);
    expect(isVozKey(jugadaVoz("lib-corner", 2))).toBe(true);
    expect(isVozKey("siete:a/b")).toBe(false);
    expect(isLegacyVozKey("siete-3")).toBe(true);
    const c = (slot: string, step: string, at = 1) => mapVozR14(slot, { step, mime: "audio/webm", ms: 1000, data: "AQID", at })!;
    const list = [c("v0", "siete:erik"), c("v1", "siete-3"), c("v2", "plan"), c("v3", "plan", 9)];
    expect(vozByKey(list).get("plan")?.slot).toBe("v3");
    expect(vozOrphans(list, new Set(["plan"])).map((x) => x.slot)).toEqual(["v0", "v1"]);
    expect(vozSlotFor(list, "plan")).toBe("v2");
    expect(vozSlotFor(list, "rival")).toBe("v4");
    expect(mapVozR14("v9", { step: "plan", mime: "audio/webm", ms: 1, data: "AQID" })).toBeNull();
  });
});

describe("la historia del tablero (PZ-D21T)", () => {
  const snap = mapHistory("h1", { kind: "sistema", label: "Pasa al 3-2-1", entra: [], formation: "3-2-1", freeMode: false, system: "3-2-1", slots: seven.map((p, i) => ({ playerId: p, code: i ? "MC" : "POR", x: 50, y: 50 })), roles: { captainId: "adrian" }, takers: { penalties: ["alcides"] }, tactics: { press: "Alta" }, isOfficial: false, at: 5 })!;
  it("restores the seven, sistema, galones and consignas, nothing else", () => {
    const now = { ...extractLineup(dataToLineupDoc("b", { formation: "2-3-1", slots: slotsOf([]), plan: { claves: ["X"] } })) };
    const r = restoreFrom(now, snap);
    expect(r.formation).toBe("3-2-1");
    expect(r.slots.map((s) => s.playerId)).toEqual(seven);
    expect(r.roles).toEqual({ captainId: "adrian" });
    expect(r.takers).toEqual({ penalties: ["alcides"], freekicks: [], corners: [] });
    expect(r.tactics.press).toBe("Alta");
    expect(r.plan).toEqual(now.plan);
    expect(historyDiff(snap, { slots: snap.slots.map((s, i) => (i === 1 ? { ...s, playerId: "illescas" } : s)) })).toEqual([{ code: "MC", from: "fer", to: "illescas" }]);
    expect(mapHistory("x", { kind: "otro" })).toBeNull();
  });
});

describe("la mesa lee el plan (PZ-D07, D10, 2ª parte)", () => {
  const d = {
    formation: "2-3-1",
    slots: slotsOf(seven),
    roles: { captainId: "adrian" },
    takers: { penalties: ["kevin", "alcides"], freekicks: [], corners: [] },
    variants: [{ id: "v2", name: "2ª parte", formation: "3-2-1", freeMode: false, slots: emptySlots("3-2-1").map((s, i) => ({ ...s, playerId: ["evans", "huberoski", "erik", "jordi", "adrian", "kevin", "brawan"][i] })), tactics: {} }],
    condPlan: [{ id: "c1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", ver: "segunda" }],
  };
  it("reads the plan and suggests", () => {
    const p = mesaPlanOf("b", d)!;
    expect(p.captainId).toBe("adrian");
    expect(p.segunda?.id).toBe("v2");
    expect(p.planb).toBeNull();
    const on = new Set(seven);
    expect(penaltyTaker(p, on)).toBe("alcides");
    const s = mesaSuggestions(p, { minute: 40, gf: 0, ga: 2, onPitch: on });
    expect(s[0].ver).toBe("segunda");
    expect(versionOf(p, s[0].ver)?.id).toBe("v2");
    const now = seven.map((playerId) => ({ playerId, code: "MC" as const, x: 0, y: 0 }));
    expect(versionChanges(now, p.segunda)).toEqual([
      { out: "fer", in: "huberoski" },
      { out: "eguzquiza", in: "kevin" },
      { out: "alcides", in: "brawan" },
    ]);
    expect(mesaPlanOf("b", undefined)).toBeNull();
  });
});

describe("tableros: charla, copias de la mesa, jugadas de la temporada, afición", () => {
  it("links and mesa copies", () => {
    expect(charlaHref("b 1", "t1")).toBe("/pizarra/charla?tablero=b%201&season=t1");
    expect(charlaHref("b", "all")).toBe("/pizarra/charla?tablero=b");
    const base = dataToLineupDoc("x", { name: "Siete del campo · J3", matchId: "j3", ownerUid: "jorge" });
    expect(isMesaCopy(base)).toBe(true);
    expect(isMesaCopy({ ...base, name: "Mi siete" })).toBe(false);
    expect(isMesaCopy({ ...base, name: "Mi siete", fromMesa: true })).toBe(true);
    expect(mesaCopiesToClean([base, { ...base, id: "y", isOfficial: true }, { ...base, id: "z", matchId: "j9" }], (m) => m === "j3").map((b) => b.id)).toEqual(["x"]);
  });
  it("season play refs", () => {
    expect(parseSeasonPlayRefs(["a", "a", 3, "b"])).toEqual(["a", "b"]);
    expect(withSeasonPlay(["a"], "b", true)).toEqual(["a", "b"]);
    expect(withSeasonPlay(["a", "b"], "a", false)).toEqual(["b"]);
    expect(() => withSeasonPlay(Array.from({ length: 24 }, (_, i) => "p" + i), "x", true)).toThrow("24");
  });
  it("fan board shape check", () => {
    expect(fanPath("abc")).toBe("/aficion/abc");
    expect(parseFanBoard({ v: 1, seven: [], system: "2-3-1", title: "J3" })).not.toBeNull();
    expect(parseFanBoard({ v: 2 })).toBeNull();
  });
});

describe("lineupDoc lleva los campos r14 sin romper los de hoy", () => {
  it("reads and writes plan, seasonPlays, rival extras, condPlan ver, server fields and fromMesa", () => {
    const d = dataToLineupDoc("b", {
      formation: "2-3-1",
      slots: slotsOf(seven),
      plan: { claves: ["Presión"], viz: [{ icon: "spark", zona: "arriba" }], notes: "", parado: null },
      seasonPlays: ["sp1"],
      rival: { formation: "2-3-1", players: [], visible: false, danger: 2 },
      condPlan: [{ id: "c1", when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", ver: "planb" }],
      fanToken: "T".repeat(24),
      sevenKey: "a,b",
      sevenRev: 3,
      fromMesa: true,
    });
    expect(d.sevenRev).toBe(3);
    expect(d.fanToken).toBe("T".repeat(24));
    expect(d.fromMesa).toBe(true);
    const data = boardToData(extractLineup(d));
    expect(data.plan).toEqual({ claves: ["Presión"], viz: [{ icon: "spark", zona: "arriba" }], notes: "", parado: null });
    expect(data.seasonPlays).toEqual(["sp1"]);
    expect(data.rival).toMatchObject({ visible: false, danger: 2 });
    expect((data.condPlan as { ver?: string }[])[0].ver).toBe("planb");
    // the server's fields never go back in a write
    expect(data).not.toHaveProperty("fanToken");
    expect(data).not.toHaveProperty("sevenRev");
  });
  it("an old board writes none of the new fields", () => {
    const data = boardToData(extractLineup(dataToLineupDoc("b", { formation: "2-3-1", slots: slotsOf(seven) })));
    expect(data).not.toHaveProperty("plan");
    expect(data).not.toHaveProperty("seasonPlays");
    expect(lineupToData(extractLineup(dataToLineupDoc("b", {})), { ownerUid: "u", ownerNickname: "n", seasonId: "s", name: "x", isOfficial: false, matchId: null, fromMesa: true })).toMatchObject({ fromMesa: true });
    expect(defaultTactics()).toBeTruthy();
  });
});
