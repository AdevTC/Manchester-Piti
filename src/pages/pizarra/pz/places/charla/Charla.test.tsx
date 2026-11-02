// r14 «La pizarra» · La charla end to end in the DOM: «Así va la charla» → the question about the holes → every step
// (‹ ›, keys, taps) → «¡Vamos, Piti!» → Esc / × out; the steps' content keys; reduced motion (no clock: ▶ advances).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";

vi.mock("../../../../../components/vidrio", () => ({ VidrioSky: () => <div className="vd-sky" /> }));
vi.mock("../../../../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggle: () => undefined }) }));
vi.mock("../../campo/PiCampo", () => ({ PiCampo: ({ show }: { show?: { source?: string; step?: number; focus?: { pid?: string } | null } }) => <div data-testid="campo" data-source={show?.source} data-focus={show?.focus?.pid ?? ""} /> }));
const clips: { slot: string; key: string; mime: string; ms: number; data: string; by: string | null; at: number }[] = [];
vi.mock("../../../data/voz", async (orig) => ({ ...(await orig<typeof import("../../../data/voz")>()), useVozR14: () => ({ clips, loading: false, error: false }), saveVoz: vi.fn(async () => undefined), removeVoz: vi.fn(async () => undefined) }));
vi.mock("../../../data/quedada", () => ({ useQuedada: () => ({ quedada: null, loading: false }) }));

import { renderWithPz, fakeBoard, fakeWorld, makeTestStore, ME_PLAYER } from "../../store/testkit";
import { Charla } from "./Charla";
import { buildCharla, CHARLA0 } from "./charlaView";

const reduce = (on: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes("reduce"), media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
};
const FULL = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];

beforeEach(() => {
  clips.length = 0;
  reduce(false);
  try {
    localStorage.clear();
  } catch {
    /* none */
  }
});

describe("buildCharla", () => {
  it("ties every step to WHAT it says: the walkouts by player, the hole by its puesto", () => {
    const { P } = makeTestStore({ place: "charla" });
    const X = buildCharla(P, CHARLA0, new Map(), { muted: false, quedada: null });
    const keys = X.steps.map((s) => s.vkey);
    expect(keys[0]).toBe("sistema");
    expect(keys).toContain("siete:adrian");
    expect(keys).toContain("siete:hueco-DC");
    expect(keys[keys.length - 1]).toBe("vamos");
    // the 6/7 board: the question is asked before starting
    expect(X.st?.full).toBe(false);
  });
  it("a step lasts as long as its voice (unless the voices are muted)", () => {
    const { P } = makeTestStore({ place: "charla" });
    const voz = new Map([["siete:adrian", 12]]);
    const on = buildCharla(P, CHARLA0, voz, { muted: false, quedada: null }).steps.find((s) => s.vkey === "siete:adrian");
    const off = buildCharla(P, CHARLA0, voz, { muted: true, quedada: null }).steps.find((s) => s.vkey === "siete:adrian");
    expect(on?.dur).toBe(12);
    expect(off?.dur).toBeLessThan(5);
  });
  it("switching a block off and reordering are honoured; a block with nothing to say is skipped with its reason", () => {
    const { P } = makeTestStore({ place: "charla" });
    const X = buildCharla(P, { ...CHARLA0, order: ["vamos", ...CHARLA0.order.filter((b) => b !== "vamos")], off: { siete: true } }, new Map(), { muted: false, quedada: null });
    expect(X.steps[0].block).toBe("vamos");
    expect(X.steps.some((s) => s.block === "siete")).toBe(false);
    const rival = X.blocks.find((b) => b.id === "rival");
    expect(rival?.na).toBe(true);
    expect(rival?.why).toMatch(/Plan/);
  });
});

describe("La charla", () => {
  it("asks about the hole, then plays every step to «¡Vamos, Piti!» with the keys, and Esc leaves to the Siete", async () => {
    vi.useFakeTimers();
    const { host } = renderWithPz(<Charla region="full" layout="desktop" />, { place: "charla" });
    expect(screen.getByRole("heading", { level: 1, name: "Así va la charla" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Los pasos" })).getAllByRole("listitem").length).toBe(9);
    fireEvent.click(screen.getAllByRole("button", { name: /Empezar la charla/ })[0]);
    const ask = screen.getByRole("alertdialog");
    expect(ask.textContent).toMatch(/Falta un DC/);
    fireEvent.click(within(ask).getByRole("button", { name: "Presentar igualmente" }));
    void act(() => vi.advanceTimersByTime(100));
    const prog = () => screen.getByRole("progressbar", { name: "Momento de la charla" });
    expect(prog().getAttribute("aria-valuenow")).toBe("1");
    const root = screen.getByRole("region", { name: /La charla · paso 1/ });
    fireEvent.keyDown(root, { key: "ArrowRight" });
    expect(prog().getAttribute("aria-valuenow")).toBe("2");
    expect(screen.getByTestId("campo").getAttribute("data-focus")).toBe("evans");
    fireEvent.keyDown(root, { key: "ArrowLeft" });
    expect(prog().getAttribute("aria-valuenow")).toBe("1");
    // the clock moves it on by itself
    void act(() => vi.advanceTimersByTime(5000));
    expect(Number(prog().getAttribute("aria-valuenow"))).toBeGreaterThan(1);
    fireEvent.keyDown(root, { key: "End" });
    expect(screen.getByRole("heading", { level: 1, name: "¡Vamos, Piti!" })).toBeTruthy();
    void act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByRole("button", { name: /Otra vez desde el principio/ })).toBeTruthy();
    fireEvent.keyDown(root, { key: "Escape" });
    expect(host.navigate).toHaveBeenCalled();
    expect(String(host.navigate.mock.calls.at(-1)?.[0])).toMatch(/^\/pizarra\/siete/);
    vi.useRealTimers();
  });

  it("taps on the sides of the pitch pass the steps; × leaves", () => {
    vi.useFakeTimers();
    const { host } = renderWithPz(<Charla region="full" layout="phone" />, { place: "charla", world: fakeWorld({ boards: [fakeBoard({ ids: FULL })] }) });
    fireEvent.click(screen.getAllByRole("button", { name: /Empezar la charla/ })[0]);
    void act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole("button", { name: "Pausar la charla" }));
    const prog = () => screen.getByRole("progressbar", { name: "Momento de la charla" });
    const taps = document.querySelectorAll<HTMLButtonElement>(".pc-tap--next");
    fireEvent.click(taps[0]);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pc-tap--next")!);
    expect(prog().getAttribute("aria-valuenow")).toBe("3");
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pc-tap--prev")!);
    expect(prog().getAttribute("aria-valuenow")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(String(host.navigate.mock.calls.at(-1)?.[0])).toMatch(/^\/pizarra\/siete/);
    vi.useRealTimers();
  });

  it("with reduced motion there is no clock: ▶ advances one step", () => {
    reduce(true);
    vi.useFakeTimers();
    renderWithPz(<Charla region="full" layout="desktop" />, { place: "charla", world: fakeWorld({ boards: [fakeBoard({ ids: FULL })] }) });
    fireEvent.click(screen.getAllByRole("button", { name: /Empezar la charla/ })[0]);
    void act(() => vi.advanceTimersByTime(20000));
    const prog = () => screen.getByRole("progressbar", { name: "Momento de la charla" });
    expect(prog().getAttribute("aria-valuenow")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Avanzar la charla un paso" }));
    expect(prog().getAttribute("aria-valuenow")).toBe("2");
    vi.useRealTimers();
  });

  it("a player reads the voice and cannot record it", () => {
    vi.useFakeTimers();
    clips.push({ slot: "v0", key: "sistema", mime: "audio/webm", ms: 6000, data: "AAAA", by: "u-jordi", at: 1 });
    renderWithPz(<Charla region="full" layout="desktop" />, { place: "charla", me: ME_PLAYER, world: fakeWorld({ boards: [fakeBoard({ ids: FULL, isOfficial: true, ownerUid: "u-jordi" })] }) });
    fireEvent.click(screen.getAllByRole("button", { name: /Empezar la charla/ })[0]);
    void act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole("button", { name: /La voz de este paso: 0:06/ }));
    const pop = screen.getByRole("dialog");
    expect(within(pop).queryByRole("button", { name: /Grabar/ })).toBeNull();
    expect(pop.textContent).toMatch(/La voz la graba el capitán/);
    vi.useRealTimers();
  });
});
