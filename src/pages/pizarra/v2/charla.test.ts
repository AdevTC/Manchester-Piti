import { describe, expect, it } from "vitest";
import { libraryPlays } from "../playLibrary";
import { setTactic } from "./plan";
import {
  advance,
  charla0,
  charlaJugada,
  charlaLast,
  charlaView,
  consignas,
  goTo,
  hide,
  missingTxt,
  pushIn,
  show,
  stepKind,
  stepMs,
  stepQuedada,
  suplentes,
  toggle,
  type CharlaArgs,
} from "./charla";
import { demoSquad, lineupOf } from "./testkit";
import { tacSummary } from "./view";

// La charla as a running order: the steps (system, the seven, the plan, the jugada's pasos, «¡A por
// ellos!»), the controller (the clock's beat, play / pause / restart, prev-next-scrub, the hidden tab,
// reduced motion) and what the broadcast graphics say at every step.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = () => lineupOf(SEVEN, "2-3-1", sq);
const corner = (L = L7()) => libraryPlays(L)[0];
const args = (o: Partial<CharlaArgs> = {}): CharlaArgs => {
  const L = o.L ?? L7();
  return {
    L,
    sq,
    step: 0,
    play: corner(L),
    playShort: "Córner",
    match: { short: "J8 · MAD SKY", date: "dom 8 nov", time: "12:00", j: "J8" },
    boardName: "Mi tablero",
    sysName: L.freeMode ? "LIBRE" : L.formation,
    tacSum: tacSummary(L),
    qv: 77,
    in3d: false,
    playing: true,
    ...o,
  };
};

describe("la charla · the running order", () => {
  it("system, the seven, the suplentes, the pelotas paradas, the plan, every paso of the jugada, la quedada, «¡A por ellos!»", () => {
    const last = charlaLast(4);
    expect(last).toBe(16);
    expect([0, 1, 7, 8, 9, 10, 11, 14, 15, 16].map((s) => stepKind(s, last))).toEqual(["sistema", "siete", "siete", "banquillo", "balon", "plan", "jugada", "jugada", "quedada", "final"]);
    expect(stepQuedada(last)).toBe(15);
    // as designed: 2.6 s the system, 2.3 s each of the seven, 4.4 s the plan, 2.4 s each paso; the new
    // steps read a list: 3.2 s the banquillo and la quedada, 3 s the lanzadores
    expect([0, 3, 8, 9, 10, 12, 15, 16].map((s) => stepMs(s, last))).toEqual([2600, 2300, 3200, 3000, 4400, 2400, 3200, 2000]);
    // a jugada without pasos goes straight from the plan to la quedada
    expect([11, 12].map((s) => stepKind(s, charlaLast(0)))).toEqual(["quedada", "final"]);
  });

  it("plays one step after another and stops at the end", () => {
    let s = charla0(false);
    expect(s).toEqual({ step: 0, playing: true, resume: false });
    for (let i = 0; i < 12; i++) s = advance(s, 13);
    expect(s.step).toBe(12);
    s = advance(s, 13);
    expect(s).toMatchObject({ step: 13, playing: false });
    // a paused charla is not moved by a late beat (or a late report of the 3D stadium)
    expect(advance(goTo(4, 13), 13, 6)).toEqual(goTo(4, 13));
    // the stadium reports where it is: straight there
    expect(advance(charla0(false), 13, 8)).toMatchObject({ step: 8, playing: true });
  });

  it("play / pause; play at the end starts over; prev, next and the timeline pause it", () => {
    let s = charla0(false);
    s = toggle(s, 13, false);
    expect(s.playing).toBe(false);
    s = toggle(s, 13, false);
    expect(s).toMatchObject({ step: 0, playing: true });
    expect(toggle({ step: 13, playing: false, resume: false }, 13, false)).toEqual({ step: 0, playing: true, resume: false });
    expect(goTo(5, 13)).toEqual({ step: 5, playing: false, resume: false });
    expect(goTo(-3, 13).step).toBe(0);
    expect(goTo(99, 13).step).toBe(13);
    expect(goTo(Number.NaN, 13).step).toBe(0);
  });

  it("a hidden tab pauses it and the tab coming back resumes it (only if it was playing)", () => {
    const h = hide({ step: 3, playing: true, resume: false });
    expect(h).toEqual({ step: 3, playing: false, resume: true });
    expect(show(h)).toEqual({ step: 3, playing: true, resume: false });
    const paused = goTo(3, 13);
    expect(show(hide(paused))).toEqual(paused);
  });

  it("reduced motion: no clock — the big button walks it one step at a time, and back to the start", () => {
    const s = charla0(true);
    expect(s.playing).toBe(false);
    expect(toggle(s, 13, true)).toEqual({ step: 1, playing: false, resume: false });
    expect(toggle({ step: 13, playing: false, resume: false }, 13, true)).toEqual({ step: 0, playing: false, resume: false });
  });
});

describe("la charla · what it says", () => {
  it("the system: the bug, the counter, the big word and the lower third", () => {
    const v = charlaView(args());
    expect(v).toMatchObject({ kind: "sistema", kick: "LA CHARLA · DOM 8 NOV · 12:00", title: "J8 · MAD SKY", n: "1/17", nk: "SISTEMA", big: { txt: "2-3-1", fin: false }, hero: -1, paso: -1, plan: null });
    expect(v.lt).toMatchObject({ n: "2-3-1", nSm: true, k: "EL SISTEMA · J8 · MAD SKY", t: "Así salimos", d: tacSummary(L7()) + "." });
    expect(v.led).toBe("LA CHARLA · J8 · MAD SKY · 2-3-1 · QUÍMICA 77 · ");
    expect(charlaView(args({ in3d: true })).kick).toBe("LA CHARLA · ESTADIO 3D · DOM 8 NOV · 12:00");
  });

  it("each of the seven: dorsal, name, slot, numbers, galones and whether he goes", () => {
    const L = { ...L7(), roles: { ...L7().roles, captainId: "illescas", cornersId: "illescas" } };
    const sq2 = { ...sq, byId: new Map(sq.byId) };
    sq2.byId.set("illescas", { ...sq.byId.get("illescas")!, cv: "no", stats: { played: 7, goals: 1, assists: 1, minutes: 300, starts: 6, mvps: 0 } });
    const v = charlaView(args({ L, sq: sq2, step: 2 }));
    expect(v).toMatchObject({ kind: "siete", nk: "LOS SIETE", hero: 1, big: null });
    expect(v.lt).toEqual({
      n: "4",
      nSm: false,
      k: "LOS SIETE · 2 DE 7 · DFC",
      t: "ILLESCAS",
      d: "7 partidos · 1 gol · 1 asist. · forma 83 · dijo que no va",
      gal: [
        { l: "C", t: "Capitán" },
        { l: "E", t: "Córners" },
      ],
    });
  });

  it("an incomplete seven: the system says what is missing and the empty slot says it is free", () => {
    const L = lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
    expect(charlaView(args({ L })).lt?.d).toBe(tacSummary(L) + ". Falta 1 en el siete: sus huecos salen en la charla.");
    expect(charlaView(args({ L, step: 2 })).lt).toMatchObject({ n: "–", t: "Hueco libre", d: "Falta un jugador en DFC." });
    expect(missingTxt(lineupOf([], "2-3-1", sq), sq)).toBe("El siete está vacío: colócalo (o «Sugerir siete») y la charla lo presenta.");
    expect(missingTxt(lineupOf([null, ...SEVEN.slice(1)], "2-3-1", sq), sq)).toBe("Falta 1 en el siete: sus huecos salen en la charla.");
    expect(missingTxt(lineupOf(["illescas", "evans", ...SEVEN.slice(2)], "2-3-1", sq), sq)).toBe("Sin portero en la portería: la charla lo avisa.");
    expect(missingTxt(L7(), sq)).toBeNull();
    // the guion names the empty slot too
    expect(charlaView(args({ L })).guion[2].t).toBe("Hueco · DFC");
  });

  it("free mode: each of the seven is presented at the slot's exact code, not its line", () => {
    const base = lineupOf(["evans", "illescas", "tello", null, "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
    const F = { ...base, freeMode: true, slots: base.slots.map((s, i) => (i === 3 ? { ...s, x: 50, y: 50 } : i === 2 ? { ...s, x: 86, y: 70 } : s)) };
    expect(charlaView(args({ L: F, step: 3 })).lt?.k).toBe("LOS SIETE · 3 DE 7 · LD");
    expect(charlaView(args({ L: F, step: 4 })).lt).toMatchObject({ k: "LOS SIETE · 4 DE 7 · MC", d: "Falta un jugador en MC." });
    expect(charlaView(args({ L: F })).guion[4].t).toBe("Hueco · MC");
  });

  it("the plan: the consigna cards from the tactics (no lower third)", () => {
    const L = setTactic(setTactic(L7(), "press", "Alta"), "buildup", "En largo");
    const v = charlaView(args({ L, step: 10 }));
    expect(v).toMatchObject({ kind: "plan", nk: "EL PLAN", lt: null });
    expect(v.plan?.map((c) => c.t)).toEqual(["Presión alta", "Línea media", "Amplitud media", "En largo"]);
    expect(consignas(L)[0]).toEqual({ t: "Presión alta", d: "Mordemos arriba: que no salgan jugando.", dl: "0.00s" });
  });

  it("the jugada's pasos, and «¡A por ellos!» (with and without a match)", () => {
    const v = charlaView(args({ step: 12 }));
    expect(v).toMatchObject({ kind: "jugada", nk: "JUGADA", paso: 1 });
    expect(v.lt).toMatchObject({ n: "2/4", nSm: true, k: "LA JUGADA · CÓRNER · PASO 2 DE 4", t: "Bloqueo y desmarque" });
    const fin = charlaView(args({ step: 16 }));
    expect(fin).toMatchObject({ kind: "final", nk: "FINAL", n: "17/17", big: { txt: "¡A POR ELLOS!", fin: true } });
    expect(fin.lt).toMatchObject({ n: "J8", k: "J8 · MAD SKY · DOM 8 NOV · 12:00", t: "¡A por ellos!", d: "Juntos. Como lo hemos hablado." });
    const none = charlaView(args({ step: 16, match: null }));
    expect(none).toMatchObject({ kick: "LA CHARLA", title: "Mi tablero" });
    expect(none.lt).toMatchObject({ n: "¡YA!", k: "MANCHESTER PITI · MI TABLERO" });
    expect(none.board3d).toEqual({ start: ["La charla", "Mi tablero", "Sistema 2-3-1", "Vamos Piti"], end: ["¡A por ellos!", "Manchester Piti", "Mi tablero"] });
    // a step past the end (the jugada got shorter) is the end
    expect(charlaView(args({ step: 40 })).kind).toBe("final");
  });

  it("the progress segments and the guion follow the step", () => {
    const v = charlaView(args({ step: 2 }));
    expect(v.segs).toHaveLength(17);
    expect(v.segs.map((s) => s.w).slice(0, 3)).toEqual(["2.6", "2.3", "2.3"]);
    expect(v.segs.map((s) => s.w).slice(8, 11)).toEqual(["3.2", "3.0", "4.4"]);
    expect(v.segs.map((s) => s.cls).slice(0, 4)).toEqual(["done", "done", "cur", ""]);
    // paused, at the end, or filmed by the 3D stadium: the running segment holds still
    expect(charlaView(args({ step: 2, playing: false })).segs[2].cls).toBe("cur st");
    expect(charlaView(args({ step: 2, in3d: true })).segs[2].cls).toBe("cur st");
    expect(v.guion[0]).toEqual({ n: "00", t: "El sistema · 2-3-1", cls: "done" });
    expect(v.guion[2]).toEqual({ n: "02", t: "4 · ILLESCAS", cls: "now" });
    expect(v.guion[8].t).toBe("Los suplentes · 3");
    expect(v.guion[9].t).toBe("Las pelotas paradas");
    expect(v.guion[10].t).toBe("El plan · " + tacSummary(L7()));
    expect(v.guion[11].t).toBe("Córner · 1 · Colocación");
    expect(v.guion[15].t).toBe("La quedada · dom 8 nov");
    expect(v.guion[16]).toEqual({ n: "16", t: "¡A por ellos!", cls: "" });
  });

  it("the camera pushes in, kept inside the frame; the charla's jugada", () => {
    expect(pushIn(50, 46, 1.22, 46)).toBe("scale(1.22) translate(0.00%, 0.00%)");
    // a cromo at the edge: the frame never shows past the pitch
    expect(pushIn(0, 100, 1.2)).toBe("scale(1.2) translate(8.33%, -8.33%)");
    const lib = { own: false, id: "lib" };
    const own = { own: true, id: "own" };
    expect(charlaJugada([lib, own], null)).toBe(own);
    expect(charlaJugada([lib], null)).toBe(lib);
    expect(charlaJugada([lib, own], lib)).toBe(lib);
  });
});

describe("la charla · the suplentes, the pelotas paradas and la quedada", () => {
  // the squad with answers: kevin goes, erik doubts, fer hasn't answered, almachi said no
  const sqA = (() => {
    const byId = new Map(sq.byId);
    byId.set("kevin", { ...sq.byId.get("kevin")!, cv: "voy" as const });
    byId.set("erik", { ...sq.byId.get("erik")!, cv: "duda" as const });
    byId.set("almachi", { ...sq.byId.get("almachi")!, cv: "no" as const });
    return { ...sq, list: sq.list.map((c) => byId.get(c.id)!), byId };
  })();
  const SIX = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "adrian", null];
  const L6 = () => lineupOf(SIX, "2-3-1", sqA);

  it("the suplentes of the convocatoria: who it calls and isn't in the seven, the ones who go first, each with whether he goes", () => {
    const called = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "adrian", "erik", "fer", "brawan", "kevin", "almachi"];
    const v = charlaView(args({ L: L6(), sq: sqA, step: 8, match: { short: "J8 · MAD SKY", date: "dom 8 nov", time: "12:00", j: "J8", called } }));
    expect(v).toMatchObject({ kind: "banquillo", nk: "BANQUILLO", hero: -1, paso: -1 });
    expect(v.lt).toEqual({
      n: "5",
      nSm: false,
      k: "EL BANQUILLO · CONVOCATORIA",
      t: "Los suplentes",
      d: "KEVIN (va) · FER (sin responder) · ERIK (duda) · ALMACHI (no va) · BRAWAN (lesionado).",
      gal: [],
    });
  });

  it("without a convocatoria: the available off the pitch (no bajas, nobody who said no)", () => {
    const s = suplentes(L6(), sqA, undefined);
    expect(s.fromConv).toBe(false);
    expect(s.list.map((c) => c.id)).toEqual(["kevin", "fer", "erik"]);
    const v = charlaView(args({ L: L6(), sq: sqA, step: 8 }));
    expect(v.lt).toMatchObject({ k: "EL BANQUILLO · SIN CONVOCATORIA: LOS DISPONIBLES", d: "KEVIN (va) · FER (sin responder) · ERIK (duda)." });
    // a convocatoria that calls only the seven: nobody on the bench
    const only = charlaView(args({ step: 8, match: { short: "J8 · MAD SKY", date: "dom 8 nov", called: SEVEN } }));
    expect(only.lt).toMatchObject({ n: "0", d: "La convocatoria no deja a nadie en el banquillo: los siete y a jugar." });
  });

  it("the pelotas paradas: who wears each galón, and whether he's in the seven", () => {
    const L = { ...L7(), roles: { captainId: "illescas", penaltiesId: "adrian", cornersId: "kevin" } };
    const v = charlaView(args({ L, step: 9 }));
    expect(v).toMatchObject({ kind: "balon", nk: "BALÓN PARADO" });
    expect(v.lt).toEqual({
      n: "3/4",
      nSm: true,
      k: "LAS PELOTAS PARADAS · QUIÉN LA TOCA",
      t: "Los lanzadores",
      d: "Brazalete: ILLESCAS · Penaltis: ADRIAN · Faltas: sin asignar · Córners: KEVIN (no está en el siete).",
      gal: [
        { l: "C", t: "ILLESCAS" },
        { l: "P", t: "ADRIAN" },
        { l: "E", t: "KEVIN" },
      ],
    });
    expect(charlaView(args({ step: 9 })).lt).toMatchObject({ n: "0/4", t: "Sin lanzadores" });
  });

  it("la quedada: the day, the time and the campo of the match (or how to get them)", () => {
    const v = charlaView(args({ step: stepQuedada(charlaLast(4)), match: { short: "J8 · MAD SKY", date: "dom 8 nov", time: "12:00", j: "J8", place: "En casa · Campo de la Mina" } }));
    expect(v).toMatchObject({ kind: "quedada", nk: "QUEDADA" });
    expect(v.lt).toEqual({ n: "J8", nSm: true, k: "LA QUEDADA · J8 · MAD SKY", t: "Nos vemos allí", d: "Dom 8 nov · a las 12:00 · En casa · Campo de la Mina.", gal: [] });
    expect(charlaView(args({ step: 15, match: { short: "J9 · ROJOS", date: "" } })).lt?.d).toBe("Fecha por confirmar.");
    expect(charlaView(args({ step: 15, match: null })).lt).toMatchObject({ t: "Sin partido enlazado", d: "Enlaza el partido en Tableros y aquí saldrán el día, la hora y el campo." });
  });
});
