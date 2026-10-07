import { describe, expect, it } from "vitest";
import { libraryPlayId } from "../playLibrary";
import { isValidPlay, moveBall, movePlayer, type Play } from "../plays";
import { CAMS, proj, slotPos } from "./geometry";
import {
  addPlayers,
  ballMove,
  boardSpots,
  DEFAULT_JUGADA,
  dropPlayers,
  followCam,
  forkName,
  forkPlay,
  freeName,
  goneFrom,
  jugadaList,
  jugadaStage,
  missingFrom,
  ownName,
  participants,
  pickJugada,
  playFromBoard,
  rederive,
  replayHud,
  rivalSpot,
  type JugadaStageArgs,
} from "./jugadas";
import { FX0 } from "./view";
import { demoSquad, lineupOf } from "./testkit";

// The jugadas around the board: the library for the seven on it and your own, the editor's rules, and
// what the replay draws for a paso (discs, rivals, the ball's arc, the calco, the estelas, the
// follow-cam, the «REPETICIÓN» bug).

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = lineupOf(SEVEN, "2-3-1", sq);
const own = (L = L7): Play => playFromBoard(L, "Tu jugada 1") as Play;
/** The keeper carries the ball upfield (it starts at his feet and stays there). */
const carried = (): Play => rederive(movePlayer(moveBall(moveBall(own(), 0, { x: 50, y: 92 }), 1, { x: 50, y: 60 }), 1, "evans", { x: 50, y: 60 }));

describe("the library and your jugadas", () => {
  it("lists córner, falta, banda and salida for the seven on the board, then the board's own", () => {
    const mine = own();
    const list = jugadaList({ ...L7, plays: [mine] });
    expect(list.map((j) => j.short)).toEqual(["Córner", "Falta", "Banda", "Salida", "Tu jugada 1"]);
    expect(list.map((j) => j.own)).toEqual([false, false, false, false, true]);
    // the library moves the people in those slots
    expect(participants(list[0].play).sort()).toEqual([...SEVEN].sort());
    expect(pickJugada(list, mine.id).play).toBe(mine);
    expect(pickJugada(list, "gone").play.id).toBe(DEFAULT_JUGADA);
    expect(DEFAULT_JUGADA).toBe(libraryPlayId("corner"));
  });

  it("a new jugada starts where the seven stand: two pasos, the first one the «Salida»", () => {
    const p = own();
    expect(p.frames).toHaveLength(2);
    expect(p.frames[0].title).toBe("Salida");
    const spot = slotPos(L7, 1);
    expect(p.frames[0].players.illescas).toEqual({ x: Math.round(spot.u), y: Math.round(spot.v) });
    expect(isValidPlay(p)).toBe(true);
    // nobody on the pitch: no jugada
    expect(playFromBoard(lineupOf([], "2-3-1", sq), "X")).toBeNull();
    expect(Object.keys(boardSpots(lineupOf(["evans", null, "tello"], "2-3-1", sq)))).toEqual(["evans", "tello"]);
  });

  it("names: «Tu jugada N» free, «(tuya)» for a built-in one made yours, numbered when taken", () => {
    expect(ownName([])).toBe("Tu jugada 1");
    expect(ownName([own()])).toBe("Tu jugada 2");
    expect(forkName("Córner a favor", [])).toBe("Córner a favor (tuya)");
    expect(forkName("Córner a favor", ["córner a favor (tuya)"])).toBe("Córner a favor (tuya) 2");
    expect(freeName("x".repeat(60), []).length).toBe(40);
    const lib = jugadaList(L7)[0].play;
    const f = forkPlay(lib, [], "j1");
    expect(f).toMatchObject({ id: "j1", kind: "corner", name: "Córner a favor (tuya)" });
    expect(f.frames).toEqual(lib.frames);
    expect(f.frames[0]).not.toBe(lib.frames[0]);
  });

  it("the arrows follow the moves after every change", () => {
    let p = own();
    p = moveBall(p, 1, { x: 20, y: 40 });
    p = movePlayer(p, 1, "adrian", { x: 50, y: 5 });
    const r = rederive(p);
    expect(r.frames[0].arrows.map((a) => a.kind)).toEqual(["pase", "carrera"]);
    expect(r.frames[1].arrows).toEqual([]);
    expect(ballMove(r, 1)).toBe("pase");
    expect(ballMove(r, 0)).toBeNull();
    // the ball with one of ours: a conducción
    const c = carried();
    expect(ballMove(c, 1)).toBe("conduccion");
  });

  it("whoever of the seven is not in the jugada can be added to every paso at his spot", () => {
    const L5 = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza"], "2-3-1", sq);
    const p = own(L5);
    const L7b = lineupOf(SEVEN, "2-3-1", sq);
    expect(missingFrom(p, L7b)).toEqual(["almachi", "adrian"]);
    const q = addPlayers(p, ["almachi", "adrian"], L7b);
    expect(q.frames.every((f) => Object.keys(f.players).length === 7)).toBe(true);
    expect(missingFrom(q, L7b)).toEqual([]);
    // never more than seven in a paso
    expect(Object.keys(addPlayers(q, ["kevin"], { ...L7b }).frames[0].players)).toHaveLength(7);
    // whoever left the seven can leave the jugada (and make room)
    const L6 = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "kevin"], "2-3-1", sq);
    expect(goneFrom(q, L6)).toEqual(["adrian"]);
    const r = dropPlayers(q, ["adrian"]);
    expect(r.frames.every((f) => !("adrian" in f.players) && Object.keys(f.players).length === 6)).toBe(true);
    expect(missingFrom(r, L6)).toEqual(["kevin"]);
  });

  it("a new rival starts in the rival half, off the ones already there", () => {
    const p = own();
    const at = rivalSpot(p);
    expect(at.y).toBeLessThan(50);
    expect(p.frames[0].rivals.some((r) => Math.abs(r.x - at.x) + Math.abs(r.y - at.y) < 6)).toBe(false);
  });
});

describe("what the replay draws for a paso", () => {
  const corner = jugadaList(L7)[0].play;
  const args = (o: Partial<JugadaStageArgs> = {}): JugadaStageArgs => ({
    play: corner,
    frame: 1,
    L: L7,
    sq,
    cam: "tv",
    fx: FX0,
    meId: "tello",
    edit: true,
    selRival: null,
    onion: true,
    trails: true,
    rivals: true,
    ball: true,
    follow: false,
    ...o,
  });

  it("our seven as discs at the paso's spots, the rivals and the ball", () => {
    const v = jugadaStage(args());
    expect(v.cards).toHaveLength(7);
    expect(v.cards.every((c) => c.cls.includes("mini"))).toBe(true);
    const evans = v.cards.find((c) => c.id === "evans");
    const q = proj(CAMS.tv, corner.frames[1].players.evans.x, corner.frames[1].players.evans.y);
    expect(evans?.x).toBeCloseTo(q.x, 1);
    expect(evans?.cls).toContain("gk");
    expect(v.cards.find((c) => c.id === "tello")?.me).toBe(true);
    expect(evans?.aria).toBe("EVANS, dorsal 1, paso 2 de 4: arrástralo para recolocarlo en este paso");
    expect(v.rivals.map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
    expect(v.ball).not.toBeNull();
    expect(v.drawn.b).toEqual([+v.ball!.x, +v.ball!.y]);
    expect(Object.keys(v.drawn.p)).toHaveLength(7);
    expect(v.camT).toBe("none");
  });

  it("the toggles: no rivals, no ball, no calco, no estelas", () => {
    const v = jugadaStage(args({ rivals: false, ball: false, onion: false, trails: false }));
    expect(v.rivals).toEqual([]);
    expect(v.ball).toBeNull();
    expect(v.ghosts).toEqual([]);
    expect(v.trails).toEqual([]);
  });

  it("the calco and the estelas show the paso before (nothing on the first one)", () => {
    const v = jugadaStage(args());
    expect(v.ghosts).toHaveLength(7);
    // only those who moved leave a trail; the ball's is dotted
    expect(v.trails.length).toBeGreaterThan(0);
    expect(v.trails.length).toBeLessThan(8);
    expect(jugadaStage(args({ frame: 0 })).ghosts).toEqual([]);
    expect(jugadaStage(args({ frame: 0 })).trails).toEqual([]);
    const toCross = jugadaStage(args({ frame: 2 }));
    expect(toCross.trails.find((t) => t.key === "ball")).toMatchObject({ cls: "c-g", k: "b" });
  });

  it("the ball glides on an arc on a pase, along the grass on a conducción", () => {
    const from = { ...FX0, k: 1, bfrom: [10, 10] as [number, number], from: {} };
    const pase = jugadaStage(args({ frame: 2, fx: from })).ball!;
    expect(+pase.my).toBeLessThan((+pase.fy + +pase.y) / 2);
    const carry = carried();
    const c = jugadaStage(args({ play: carry, frame: 1, fx: from })).ball!;
    expect(+c.my).toBeCloseTo((+c.fy + +c.y) / 2, 1);
  });

  it("the follow-cam zooms on the ball and keeps the frame covered", () => {
    expect(followCam({ x: 50, y: 54 })).toBe("scale(1.34) translate(0.00%, 0.00%)");
    const edge = followCam({ x: 0, y: 0 });
    const lim = (50 - 50 / 1.34 + 4).toFixed(2);
    expect(edge).toBe("scale(1.34) translate(" + lim + "%, " + lim + "%)");
    expect(jugadaStage(args({ follow: true })).camT).toMatch(/^scale\(1\.34\)/);
  });

  it("the bug, the timeline and the caption", () => {
    const item = jugadaList(L7)[0];
    const h = replayHud(item, 1, " · CÁMARA TV", true);
    expect(h).toMatchObject({ bugA: "REPETICIÓN · CÓRNER · 2/4 · CÁMARA TV", bugB: "Bloqueo y desmarque", bugK: "ba", lab: "2/4", stepT: "Paso 2 · Bloqueo y desmarque" });
    expect(h.bugAria).toBe("Repetición: Córner a favor, paso 2 de 4, Bloqueo y desmarque. Abrir la biblioteca");
    expect(h.ticks.map((t) => t.cls)).toEqual(["done", "cur", "", ""]);
    expect(h.ticks.map((t) => t.l)).toEqual(["0.0%", "33.3%", "66.7%", "100.0%"]);
    expect(h.pct).toBe("33.3%");
    // a paso without a title or a note
    const mine = { play: own(), own: true, short: "Tu jugada 1" };
    expect(replayHud(mine, 1, "", true)).toMatchObject({ bugB: "Paso 2", stepD: "Arrastra los cromos, el balón o los rivales para colocar este paso." });
    expect(replayHud(mine, 1, "", false).stepD).toBe("");
  });
});
