// PiCampo (r14): the pitch draws the view the store resolves and sends every gesture to the store. A light fake store
// (no Firestore, no stills): the slots, the taps, the drag start, the keyboard, the chrome, the minis, the rival.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PzApi, ShirtStill } from "../store/api";
import type { PzPlayer, PzView, StageSpec, Token, ViewSlot } from "../store/types";

const fake = vi.hoisted(() => ({ P: null as PzApi | null }));
vi.mock("../store/context", () => ({ usePz: () => fake.P }));

import { PiCampo } from "./PiCampo";
import { fitGeometry, shapeLines, slotAhead } from "./geometry";
import { overlayPaths } from "./overlayPaths";

const player = (id: string, shirt: string, num: number): PzPlayer => ({
  id,
  shirt,
  num,
  first: shirt,
  last: "",
  line: "MED",
  main: "MC",
  also: [],
  global: 64,
  forma: 60,
  provisional: false,
  type: "Plata",
  pj: 2,
  starts: 2,
  min: 90,
  goals: 0,
  assists: 0,
  mvp: 0,
  notas: [],
  playedAt: {},
});

const SPOTS: [ViewSlot["code"], number, number][] = [
  ["POR", 50, 95],
  ["LI", 25, 72],
  ["LD", 75, 72],
  ["MI", 20, 46],
  ["MC", 50, 46],
  ["MD", 80, 46],
  ["DC", 50, 16],
];
const NAMES = ["JORDI", "ERIK", "ADRIAN", "KEVIN", "", "EGUZQUIZA", "JOSITO"];

function slots(): ViewSlot[] {
  return SPOTS.map(([code, x, y], i) => {
    const p = NAMES[i] ? player(`p${i}`, NAMES[i], i + 1) : null;
    return { i, code, x, y, pid: p ? p.id : null, empty: !p, p, galones: i === 0 ? [{ k: "C", t: "Capitán", aria: "Capitán: JORDI" }] : [], fit: p ? 3 : null, fitT: "en su sitio", r: null, me: i === 0, sel: false, picked: false, over: false, drop: false, out: false };
  });
}

function makeView(over: Partial<PzView> = {}): PzView {
  return {
    source: "siete",
    boardId: "b1",
    formation: "2-3-1",
    free: false,
    slots: slots(),
    tokens: [],
    links: [],
    overlay: null,
    ghost: [],
    ball: null,
    labels: [],
    caption: "",
    rivalName: "",
    camera: "pizarra",
    focus: null,
    zoom: null,
    plates: "",
    layer: "nada",
    editable: true,
    glideMs: 420,
    marksExtra: null,
    chrome: true,
    tappable: false,
    gradaPad: 0,
    flash: 0,
    ...over,
  };
}

function makeStore(view: PzView) {
  const act = {
    tapSlot: vi.fn(),
    openFicha: vi.fn(),
    release: vi.fn(),
    remove: vi.fn(),
    openSheet: vi.fn(),
    setLayer: vi.fn(),
    setCamera: vi.fn(),
    toggleCamera: vi.fn(),
    setDrawing: vi.fn(),
  };
  const still: ShirtStill = { src: undefined, printed: false, num: "7", name: "X", kit: "home" };
  const P = {
    v: 1,
    state: { layout: "desktop", drag: null, over: null, sel: null, slotPick: null, drawing: false, flash: 0, layer: view.layer },
    sel: {
      view: vi.fn((spec?: StageSpec) => (spec ? { ...view, ...spec, slots: view.slots } : view)),
      shirt: vi.fn(() => still),
      band: () => ({ t: "normal", tone: "ok" as const }),
      lastNota: () => null,
      notaWord: () => "Buena",
      posName: (c: string) => ({ POR: "Portero", MC: "Mediocentro" })[c as "POR"] ?? c,
      name: (id: string) => id,
      player: (id: string) => view.slots.find((s) => s.pid === id)?.p ?? null,
    },
    act,
    drag: { begin: vi.fn(), cancel: vi.fn(), onGhost: vi.fn(), active: () => false, state: () => null },
    emit: vi.fn(),
    say: vi.fn(),
  };
  fake.P = P as unknown as PzApi;
  return P;
}

describe("PiCampo", () => {
  beforeEach(() => {
    fake.P = null;
  });

  it("draws the seven: a named button per shirt, the empty slot with its code, the sistema on the grass", () => {
    makeStore(makeView());
    render(<PiCampo layout="desktop" />);
    expect(screen.getByRole("group", { name: /El campo · 2-3-1 · 6 de 7/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^JORDI, 1\. POR · portero.*Capitán: JORDI.*eres tú/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hueco MC vacío, mediocentro: toca para ver quién encaja/ })).toBeInTheDocument();
    expect(document.querySelector(".pz-c__sys")?.textContent).toBe("2-3-1");
    // every drop target declares itself to the store
    expect(document.querySelectorAll('[data-pz-drop^="slot:"]')).toHaveLength(7);
  });

  it("sends taps to the store and starts a drag on pointerdown of an editable shirt", () => {
    const P = makeStore(makeView());
    render(<PiCampo layout="desktop" />);
    const erik = screen.getByRole("button", { name: /^ERIK/ });
    fireEvent.click(erik);
    expect(P.act.tapSlot).toHaveBeenCalledWith(1);
    fireEvent.pointerDown(erik, { clientX: 10, clientY: 20, button: 0, pointerType: "mouse" });
    expect(P.drag.begin).toHaveBeenCalledWith(expect.anything(), { pid: "p1", from: "campo", slot: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Hueco MC/ }));
    expect(P.act.tapSlot).toHaveBeenCalledWith(4);
  });

  it("a read-only pitch never starts a drag; an inert one opens the ficha instead of the board's tapSlot", () => {
    const P = makeStore(makeView({ editable: false }));
    const { unmount } = render(<PiCampo layout="desktop" />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /^ERIK/ }), { button: 0, pointerType: "mouse" });
    expect(P.drag.begin).not.toHaveBeenCalled();
    unmount();
    const Q = makeStore(makeView());
    render(<PiCampo layout="desktop" inert show={{ source: "siete", boardId: "b2" }} />);
    fireEvent.click(screen.getByRole("button", { name: /^ERIK/ }));
    expect(Q.act.openFicha).toHaveBeenCalledWith("p1");
    expect(Q.act.tapSlot).not.toHaveBeenCalled();
    // (no chrome on an inert pitch: its camera or layer would change the board's)
    expect(screen.queryByRole("group", { name: "Cámara" })).toBeNull();
  });

  it("keyboard inside the pitch: arrows by geometry, V camera, 0–5 layers, M «Mover a…», Delete quitar", () => {
    const P = makeStore(makeView());
    render(<PiCampo layout="desktop" />);
    const kevin = screen.getByRole("button", { name: /^KEVIN/ });
    kevin.focus();
    fireEvent.keyDown(kevin, { key: "ArrowRight" });
    // MI → the empty MC (the nearest ahead on the right)
    expect(document.activeElement?.getAttribute("data-pz-slot")).toBe("4");
    fireEvent.keyDown(kevin, { key: "v" });
    expect(P.act.toggleCamera).toHaveBeenCalled();
    fireEvent.keyDown(kevin, { key: "3" });
    expect(P.act.setLayer).toHaveBeenCalledWith("quimica");
    fireEvent.keyDown(kevin, { key: "m" });
    expect(P.act.openSheet).toHaveBeenCalledWith("mover", { pid: "p3", slot: 3 });
    fireEvent.keyDown(kevin, { key: "Delete" });
    expect(P.act.remove).toHaveBeenCalledWith(3);
  });

  it("the chrome: layers (not on the phone), Dibujar on an editable siete, the camera switch", () => {
    const P = makeStore(makeView());
    const { unmount } = render(<PiCampo layout="desktop" />);
    fireEvent.click(screen.getByRole("button", { name: "Química" }));
    expect(P.act.setLayer).toHaveBeenCalledWith("quimica");
    fireEvent.click(screen.getByRole("button", { name: "Dibujar sobre el campo" }));
    expect(P.act.setDrawing).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: /Grada/ }));
    expect(P.act.setCamera).toHaveBeenCalledWith("grada");
    unmount();
    makeStore(makeView());
    render(<PiCampo layout="phone" />);
    expect(screen.queryByRole("group", { name: "Capa del campo" })).toBeNull();
  });

  it("a mini is one image: no buttons to reach, no chrome", () => {
    makeStore(makeView());
    render(<PiCampo layout="desktop" mini show={{ source: "siete", boardId: "b1" }} />);
    expect(screen.getByRole("img", { name: /Miniatura del campo · 2-3-1/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Cámara" })).toBeNull();
    expect(document.querySelector(".pz-c__stage")?.hasAttribute("inert")).toBe(true);
  });

  it("the rival: coral discs with dorsal and code, named in the legend (never colour alone)", () => {
    const rival: Token[] = [{ id: "r0", kind: "rival", x: 50, y: 30, num: 9, code: "RED", label: "DC", note: "Rápido" }];
    makeStore(makeView({ tokens: rival, rivalName: "Red Demons" }));
    render(<PiCampo layout="desktop" />);
    expect(screen.getByRole("button", { name: "Rival (Red Demons), dorsal 9, DC. Rápido" })).toHaveTextContent("9RED");
    expect(screen.getByText("Red Demons · rival")).toBeInTheDocument();
  });

  it("tappable tokens emit token:tap", () => {
    const P = makeStore(makeView({ source: "tokens", slots: [], tappable: true, tokens: [{ id: "t1", kind: "us", x: 40, y: 40, label: "RAFA" }] }));
    render(<PiCampo layout="desktop" />);
    fireEvent.click(screen.getByRole("button", { name: /RAFA\. Toca para elegirlo/ }));
    expect(P.emit).toHaveBeenCalledWith("token:tap", { id: "t1", pid: null, kind: "us" });
  });
});

describe("campo geometry and overlay (pure)", () => {
  it("fits the flat pitch 2:3 inside the box, and Grada's tilted plane inside the width", () => {
    const flat = fitGeometry("pizarra", "desktop", false, 600, 800);
    expect(flat.ph / flat.pw).toBeCloseTo(1.5);
    expect(flat.ph).toBeLessThanOrEqual(800);
    const grada = fitGeometry("grada", "desktop", false, 600, 800);
    expect(grada.pw).toBeLessThanOrEqual(600);
    expect(grada.rx).toBe(50);
    expect(fitGeometry("grada", "desktop", true, 180, 240).s).toBeGreaterThan(8);
  });

  it("moves the focus to the nearest slot ahead and joins each line of the sistema", () => {
    const s = slots();
    expect(slotAhead(s, 3, "ArrowRight")).toBe(4);
    expect(slotAhead(s, 0, "ArrowDown")).toBeNull();
    // LI–LD, MI–MC–MD and the lone DC to the three midfielders
    expect(shapeLines(s)).toHaveLength(1 + 2 + 3);
  });

  it("draws paths: a closed zona, a curved 2-point carrera, arrowheads coloured like the stroke", () => {
    const out = overlayPaths({
      paths: [
        { kind: "zona", pts: [[10, 10], [30, 10], [30, 30]], label: "Aquí" },
        { kind: "carrera", pts: [[10, 50], [40, 20]] },
        { kind: "flecha", pts: [[60, 60], [70, 40]], color: "celeste" },
      ],
    });
    expect(out.paths[0].d.endsWith("Z")).toBe(true);
    expect(out.paths[1].d).toContain("Q");
    expect(out.heads).toHaveLength(2);
    expect(out.heads[1].cls).toBe("c-celeste");
    expect(out.labels[0]).toMatchObject({ t: "Aquí", cls: "is-end" });
  });
});
