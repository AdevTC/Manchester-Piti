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
  it("system, the seven, the plan, every paso of the jugada, «¡A por ellos!»", () => {
    const last = charlaLast(4);
    expect(last).toBe(13);
    expect([0, 1, 7, 8, 9, 12, 13].map((s) => stepKind(s, last))).toEqual(["sistema", "siete", "siete", "plan", "jugada", "jugada", "final"]);
    // as designed: 2.6 s the system, 2.3 s each of the seven, 4.4 s the plan, 2.4 s each paso
    expect([0, 3, 8, 10].map((s) => stepMs(s, last))).toEqual([2600, 2300, 4400, 2400]);
    // a jugada without pasos goes straight from the plan to the end
    expect(stepKind(9, charlaLast(0))).toBe("final");
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
    expect(v).toMatchObject({ kind: "sistema", kick: "LA CHARLA · DOM 8 NOV · 12:00", title: "J8 · MAD SKY", n: "1/14", nk: "SISTEMA", big: { txt: "2-3-1", fin: false }, hero: -1, paso: -1, plan: null });
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

  it("the plan: the consigna cards from the tactics (no lower third)", () => {
    const L = setTactic(setTactic(L7(), "press", "Alta"), "buildup", "En largo");
    const v = charlaView(args({ L, step: 8 }));
    expect(v).toMatchObject({ kind: "plan", nk: "EL PLAN", lt: null });
    expect(v.plan?.map((c) => c.t)).toEqual(["Presión alta", "Línea media", "Amplitud media", "En largo"]);
    expect(consignas(L)[0]).toEqual({ t: "Presión alta", d: "Mordemos arriba: que no salgan jugando.", dl: "0.00s" });
  });

  it("the jugada's pasos, and «¡A por ellos!» (with and without a match)", () => {
    const v = charlaView(args({ step: 10 }));
    expect(v).toMatchObject({ kind: "jugada", nk: "JUGADA", paso: 1 });
    expect(v.lt).toMatchObject({ n: "2/4", nSm: true, k: "LA JUGADA · CÓRNER · PASO 2 DE 4", t: "Bloqueo y desmarque" });
    const fin = charlaView(args({ step: 13 }));
    expect(fin).toMatchObject({ kind: "final", nk: "FINAL", n: "14/14", big: { txt: "¡A POR ELLOS!", fin: true } });
    expect(fin.lt).toMatchObject({ n: "J8", k: "J8 · MAD SKY · DOM 8 NOV · 12:00", t: "¡A por ellos!", d: "Juntos. Como lo hemos hablado." });
    const none = charlaView(args({ step: 13, match: null }));
    expect(none).toMatchObject({ kick: "LA CHARLA", title: "Mi tablero" });
    expect(none.lt).toMatchObject({ n: "¡YA!", k: "MANCHESTER PITI · MI TABLERO" });
    expect(none.board3d).toEqual({ start: ["La charla", "Mi tablero", "Sistema 2-3-1", "Vamos Piti"], end: ["¡A por ellos!", "Manchester Piti", "Mi tablero"] });
    // a step past the end (the jugada got shorter) is the end
    expect(charlaView(args({ step: 40 })).kind).toBe("final");
  });

  it("the progress segments and the guion follow the step", () => {
    const v = charlaView(args({ step: 2 }));
    expect(v.segs).toHaveLength(14);
    expect(v.segs.map((s) => s.w).slice(0, 3)).toEqual(["2.6", "2.3", "2.3"]);
    expect(v.segs[8].w).toBe("4.4");
    expect(v.segs.map((s) => s.cls).slice(0, 4)).toEqual(["done", "done", "cur", ""]);
    // paused, at the end, or filmed by the 3D stadium: the running segment holds still
    expect(charlaView(args({ step: 2, playing: false })).segs[2].cls).toBe("cur st");
    expect(charlaView(args({ step: 2, in3d: true })).segs[2].cls).toBe("cur st");
    expect(v.guion[0]).toEqual({ n: "00", t: "El sistema · 2-3-1", cls: "done" });
    expect(v.guion[2]).toEqual({ n: "02", t: "4 · ILLESCAS", cls: "now" });
    expect(v.guion[8].t).toBe("El plan · " + tacSummary(L7()));
    expect(v.guion[9].t).toBe("Córner · 1 · Colocación");
    expect(v.guion[13]).toEqual({ n: "13", t: "¡A por ellos!", cls: "" });
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
