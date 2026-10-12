import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup, Sub } from "../formations";
import type { CalMatch } from "./boards";
import { demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";

// Siete → Cambios as a user drives it: the tab (Q / E), a cambio added and edited, «Repartir minutos»
// with its preview, the minute scrubbed onto the pitch, the keys, a read-only board; and the live match:
// the plate with the clock from the match's date (fake clock), the countdown to the next tanda, «Hacer el
// cambio» through liveEvent for a captain only, the wake lock.

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));
const api = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock("../../../lib/clubApi", async (orig) => {
  const m = await orig<typeof import("../../../lib/clubApi")>();
  return {
    ...m,
    liveEvent: vi.fn(async (d: unknown) => {
      api.calls.push(d);
      return { data: { events: 2 } };
    }),
  };
});

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (subs?: Sub[]): Lineup => ({ ...lineupOf(SEVEN, "2-3-1", sq), ...(subs ? { subs } : {}) });
const root = (c: HTMLElement) => c.querySelector(".pzv") as HTMLElement;
const sr = (c: HTMLElement) => (c.querySelector(".pzv .sr") as HTMLElement).textContent?.replace(/[​‌]/g, "") ?? "";
const key = (k: string, o: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.body, { key: k, ...o });
const openTab = () => fireEvent.click(within(screen.getByRole("group", { name: "Herramienta del siete" })).getByRole("button", { name: "Cambios" }));
const onPitch = (name: string) => screen.queryByRole("button", { name: new RegExp("^" + name + ", dorsal") });
const T0 = Date.UTC(2026, 9, 11, 10, 0);
const MIN = 60_000;
const match = (o: Partial<CalMatch> = {}): CalMatch => ({
  id: "m8",
  j: 8,
  rival: "MAD SKY",
  dateMs: T0,
  played: false,
  gf: null,
  ga: null,
  home: true,
  venue: "",
  conv: { starters: SEVEN, bench: ["kevin", "erik", "fer"] },
  duration: 50,
  events: [{ id: "e1", type: "goal", minute: 5, playerId: "adrian" }],
  ...o,
});

beforeEach(() => {
  localStorage.clear();
  api.calls = [];
  window.history.replaceState(null, "", "/pizarra");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Siete → Cambios", () => {
  it("is the fourth tab: Q / E reach it, and it opens empty with what to do", () => {
    render(<Harness initial={L7()} />);
    key("q");
    expect(screen.getByRole("button", { name: "Cambios" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Añade un cambio o reparte los minutos/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Los cambios/ })).toHaveTextContent("Sin cambios planeados");
  });

  it("«Añadir cambio»: the most-played off for the least-played, at half time; then edited with the selects", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} props={{ conv: { match: match(), loading: false, error: false } }} />);
    openTab();
    fireEvent.click(screen.getByRole("button", { name: "Añadir cambio" }));
    const s = commits.at(-1)?.subs ?? [];
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ min: 25, out: "illescas" });
    expect(["kevin", "erik", "fer"]).toContain(s[0].in);
    expect(sr(container)).toMatch(/^Cambio en el 25′: entra .+ por ILLESCAS$/);
    const outSel = screen.getByRole("combobox", { name: "Sale en el 25′" });
    fireEvent.change(outSel, { target: { value: "adrian" } });
    expect(commits.at(-1)?.subs?.[0].out).toBe("adrian");
    fireEvent.change(screen.getByRole("combobox", { name: "Entra en el 25′" }), { target: { value: "kevin" } });
    expect(commits.at(-1)?.subs?.[0].in).toBe("kevin");
    // the tanda's minute: a step later, then with the marker and the arrows (⇧: 5′)
    fireEvent.click(screen.getByRole("button", { name: "Tanda del 25′: un minuto después" }));
    expect(commits.at(-1)?.subs?.[0].min).toBe(26);
    const mk = screen.getByRole("button", { name: /^Tanda del 26′: KEVIN por ADRIAN/ });
    fireEvent.keyDown(mk, { key: "ArrowRight", shiftKey: true });
    expect(commits.at(-1)?.subs?.[0].min).toBe(31);
    expect(sr(container)).toBe("Tanda al 31′");
    fireEvent.click(screen.getByRole("button", { name: "Quitar el cambio: entra KEVIN por ADRIAN en el 31′" }));
    expect(commits.at(-1)?.subs).toEqual([]);
  });

  it("dragging a marker moves its tanda to where it is let go", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7([{ id: "a", min: 20, out: "adrian", in: "kevin" }])} onCommit={(l) => commits.push(l)} />);
    openTab();
    const mk = screen.getByRole("button", { name: /^Tanda del 20′: KEVIN/ });
    const tr = mk.parentElement as HTMLElement;
    vi.spyOn(tr, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 500, height: 44, right: 500, bottom: 44, toJSON: () => ({}) } as DOMRect);
    fireEvent.pointerDown(mk, { pointerId: 1, clientX: 200 });
    fireEvent.pointerMove(mk, { pointerId: 1, clientX: 400 });
    expect(mk).toHaveTextContent("40′");
    fireEvent.pointerUp(mk, { pointerId: 1, clientX: 400 });
    expect(commits.at(-1)?.subs?.[0].min).toBe(40);
    // the click that ends the drag doesn't send the scrub back to the old minute
    fireEvent.click(screen.getByRole("button", { name: /^Tanda del 40′: KEVIN/ }));
    expect(screen.getByRole("slider", { name: "El campo en el minuto" })).toHaveValue("40");
  });

  it("«Repartir minutos» proposes the tandas first (before → after), «Aplicar» saves them; the table says who eats bench", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} props={{ conv: { match: match(), loading: false, error: false } }} />);
    openTab();
    const table = screen.getByRole("list", { name: "Minutos planeados de cada uno" });
    expect(within(table).getAllByText("Se come banquillo")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: /^Minutos/ })).toHaveTextContent("7 × 50′ = 350′ · 9 de campo a 33′ cada uno · el portero, fijo");
    fireEvent.click(screen.getByRole("button", { name: "Repartir minutos" }));
    const pv = screen.getByRole("region", { name: "Repartir minutos" });
    expect(within(pv).getAllByRole("listitem").length).toBeGreaterThan(1);
    expect(within(pv).getByRole("list", { name: "Minutos, antes y después" })).toHaveTextContent("KEVIN0′ →");
    expect(sr(container)).toMatch(/^Repartir minutos: \d tandas?, \d+ cambios?\. «Aplicar» para guardarlo$/);
    expect(commits).toHaveLength(0);
    fireEvent.click(within(pv).getByRole("button", { name: "Aplicar" }));
    const subs = commits.at(-1)?.subs ?? [];
    expect(subs.length).toBeGreaterThan(2);
    expect(subs.every((s) => s.out !== "evans")).toBe(true);
    expect(screen.queryByRole("region", { name: "Repartir minutos" })).toBeNull();
    expect(within(screen.getByRole("list", { name: "Minutos planeados de cada uno" })).queryByText("Se come banquillo")).toBeNull();
  });

  it("the scrub shows the seven at that minute on the pitch (with its galones), and the pitch can't be edited there", () => {
    const L = { ...L7([{ id: "a", min: 25, out: "adrian", in: "kevin" }]), roles: { captainId: "adrian", viceId: "tello" } };
    const { container } = render(<Harness initial={L} />);
    openTab();
    expect(onPitch("ADRIAN")).not.toBeNull();
    fireEvent.change(screen.getByRole("slider", { name: "El campo en el minuto" }), { target: { value: "30" } });
    expect(onPitch("ADRIAN")).toBeNull();
    expect(onPitch("KEVIN")).not.toBeNull();
    expect(screen.getByText("Minuto 30: tras la tanda del 25′ (KEVIN por ADRIAN)")).toBeInTheDocument();
    // the vice wears the brazalete once the captain is off
    expect(onPitch("TELLO")?.getAttribute("aria-label")).toMatch(/galones C/);
    fireEvent.click(onPitch("KEVIN") as HTMLElement);
    expect(sr(container)).toBe("El campo enseña otro minuto: vuelve al 0′ para cambiar el siete");
    // , and . walk the minute (⇧: 5′)
    key(",", { shiftKey: true });
    expect(screen.getByRole("slider", { name: "El campo en el minuto" })).toHaveValue("25");
    key(",");
    expect(onPitch("ADRIAN")).not.toBeNull();
  });

  it("the keys of the tab: N a cambio, M repartir; the prompt bar teaches them", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} props={{ conv: { match: match(), loading: false, error: false } }} />);
    openTab();
    key("n");
    expect(commits.at(-1)?.subs).toHaveLength(1);
    key("m");
    expect(screen.getByRole("region", { name: "Repartir minutos" })).toBeInTheDocument();
    const bar = screen.getByRole("toolbar", { name: "Atajos y acciones" });
    expect(within(bar).getByRole("button", { name: "Añadir cambio (N)" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Repartir minutos (M)" })).toBeInTheDocument();
    expect(root(container).querySelector(".pmb")?.textContent).toContain("Minuto en el campo");
  });

  it("a read-only board shows the plan, with nothing to edit", () => {
    render(<Harness initial={L7([{ id: "a", min: 25, out: "adrian", in: "kevin" }])} ro />);
    openTab();
    expect(screen.getByRole("region", { name: "Tanda del 25′" })).toHaveTextContent(/Sale10 · ADRIAN.*Entra11 · KEVIN/);
    expect(screen.queryByRole("combobox", { name: "Sale en el 25′" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Añadir cambio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Repartir minutos" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Penaltis: 1º lanzador" })).toBeDisabled();
  });

  it("the galones in order: 1º, 2º and 3º of each dead ball, the vice-capitán", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    openTab();
    fireEvent.change(screen.getByRole("combobox", { name: "Penaltis: 1º lanzador" }), { target: { value: "adrian" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Penaltis: 2º lanzador" }), { target: { value: "tello" } });
    expect(commits.at(-1)?.takers?.penalties).toEqual(["adrian", "tello"]);
    expect(commits.at(-1)?.roles.penaltiesId).toBe("adrian");
    fireEvent.change(screen.getByRole("combobox", { name: "Vice-capitán" }), { target: { value: "illescas" } });
    expect(commits.at(-1)?.roles.viceId).toBe("illescas");
  });
});

describe("the live match", () => {
  const live = (o: { admin?: boolean; subs?: Sub[]; m?: Partial<CalMatch> } = {}) => {
    const m = match(o.m);
    return render(
      <Harness
        initial={L7(o.subs ?? [{ id: "a", min: 25, out: "adrian", in: "kevin" }])}
        session={{ matchId: "m8" }}
        props={{ calendar: [m], conv: { match: m, loading: false, error: false }, isAdmin: !!o.admin }}
      />,
    );
  };

  it("the plate: the minute from the match's date, the score, and the countdown to the next tanda (it moves with the clock)", () => {
    vi.useFakeTimers({ now: T0 + 21.5 * MIN, toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    live();
    const plate = screen.getByRole("button", { name: /^En directo, minuto 22: Piti 1, MAD SKY 0\. Cambio 25′ · en 3′\. Abrir los cambios$/ });
    expect(plate).toHaveTextContent("22′");
    expect(plate).toHaveTextContent("1–0");
    act(() => {
      vi.advanceTimersByTime(MIN);
    });
    expect(screen.getByRole("button", { name: /^En directo, minuto 23: .*en 2′/ })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(MIN);
    });
    act(() => {
      vi.advanceTimersByTime(MIN);
    });
    expect(screen.getByRole("button", { name: /^En directo, minuto 25: .*¡Cambio ya! · 25′/ })).toBeInTheDocument();
  });

  it("the clock is the match's, not counted here: a phone that slept wakes up on the right minute", () => {
    vi.useFakeTimers({ now: T0 + 10.2 * MIN, toFake: ["setTimeout", "clearTimeout", "Date"] });
    live();
    expect(screen.getByRole("button", { name: /^En directo, minuto 11/ })).toBeInTheDocument();
    // the timers were frozen while it slept; the time moved on
    vi.setSystemTime(T0 + 30.4 * MIN);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByRole("button", { name: /^En directo, minuto 31/ })).toBeInTheDocument();
  });

  it("no plate before kick-off, after the match, or for a finished one", () => {
    vi.useFakeTimers({ now: T0 - 5 * MIN, toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { unmount } = live();
    expect(screen.queryByRole("button", { name: /^En directo/ })).toBeNull();
    // the kick-off comes: the plate appears
    act(() => {
      vi.advanceTimersByTime(5 * MIN + 100);
    });
    expect(screen.getByRole("button", { name: /^En directo, minuto 1:/ })).toBeInTheDocument();
    unmount();
    vi.setSystemTime(T0 + 20 * MIN);
    live({ m: { status: "finished" } });
    expect(screen.queryByRole("button", { name: /^En directo/ })).toBeNull();
  });

  it("a captain: the plate opens the live view, «Hacer el cambio» writes it in the acta with liveEvent", async () => {
    vi.useFakeTimers({ now: T0 + 24.5 * MIN, toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { container } = live({ admin: true });
    fireEvent.click(screen.getByRole("button", { name: /^En directo/ }));
    const card = screen.getByRole("region", { name: "Partido en directo" });
    expect(card).toHaveTextContent("En directo · 25′");
    expect(card).toHaveTextContent("Toca el cambio · 25′");
    expect(card).toHaveTextContent("Sale ADRIAN → entra KEVIN");
    expect(within(card).getByRole("link", { name: "Anotar en el acta" })).toHaveAttribute("href", "/admin/en-juego/m8");
    expect(card).toHaveTextContent("Lanzadores ahora:");
    await act(async () => {
      fireEvent.click(within(card).getByRole("button", { name: /^Hacer el cambio/ }));
    });
    expect(api.calls).toEqual([{ action: "add", matchId: "m8", event: { type: "substitution", minute: 25, playerId: "adrian", inPlayerId: "kevin" } }]);
    expect(sr(container)).toBe("En el acta, 25′: entra KEVIN por ADRIAN");
  });

  it("a member sees the plan live but can't write in the acta", () => {
    vi.useFakeTimers({ now: T0 + 12 * MIN, toFake: ["setTimeout", "clearTimeout", "Date"] });
    live();
    fireEvent.click(screen.getByRole("button", { name: /^En directo/ }));
    const card = screen.getByRole("region", { name: "Partido en directo" });
    expect(within(card).queryByRole("button", { name: /^Hacer el cambio/ })).toBeNull();
    expect(within(card).queryByRole("link", { name: "Anotar en el acta" })).toBeNull();
    expect(card).toHaveTextContent("Los capitanes apuntan los cambios en el acta.");
    key("h");
    expect(api.calls).toEqual([]);
  });

  it("a cambio already in the acta is not pending any more", () => {
    vi.useFakeTimers({ now: T0 + 30 * MIN, toFake: ["setTimeout", "clearTimeout", "Date"] });
    live({ admin: true, m: { events: [{ id: "s", type: "substitution", minute: 26, playerId: "adrian", inPlayerId: "kevin" }] } });
    fireEvent.click(screen.getByRole("button", { name: /^En directo/ }));
    const card = screen.getByRole("region", { name: "Partido en directo" });
    expect(card).toHaveTextContent("Sin más cambios en el plan");
    expect(screen.getByRole("region", { name: "Tanda del 25′" })).toHaveTextContent("En el acta");
  });

  it("«Recalcular»: who can't go on is taken off in the next minute's tanda", () => {
    vi.useFakeTimers({ now: T0 + 30 * MIN, toFake: ["setTimeout", "clearTimeout", "Date"] });
    const commits: Lineup[] = [];
    const m = match();
    render(<Harness initial={L7([])} onCommit={(l) => commits.push(l)} session={{ matchId: "m8" }} props={{ calendar: [m], conv: { match: m, loading: false, error: false }, isAdmin: true }} />);
    fireEvent.click(screen.getByRole("button", { name: /^En directo/ }));
    fireEvent.click(screen.getByRole("button", { name: "TELLO, en el campo", pressed: false }));
    fireEvent.click(screen.getByRole("button", { name: "Recalcular desde el 31′" }));
    fireEvent.click(within(screen.getByRole("region", { name: "Recalcular desde el 31′" })).getByRole("button", { name: "Aplicar" }));
    const subs = commits.at(-1)?.subs ?? [];
    expect(subs.find((s) => s.out === "tello")?.min).toBe(32);
    expect(subs.every((s) => s.min > 31)).toBe(true);
  });

  it("keeps the screen on while live (where the browser can), and lets it go after", () => {
    vi.useFakeTimers({ now: T0 + 3 * MIN, toFake: ["setTimeout", "clearTimeout", "Date"] });
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ release }));
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    const { unmount } = live();
    expect(request).toHaveBeenCalledWith("screen");
    unmount();
    Reflect.deleteProperty(navigator, "wakeLock");
  });
});
