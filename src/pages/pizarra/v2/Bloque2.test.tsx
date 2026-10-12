import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import { libraryPlays } from "../playLibrary";
import type { Play } from "../plays";
import type { CalMatch } from "./boards";
import { CAMS, proj } from "./geometry";
import { NUEVO_DESDE } from "./rail";
import { demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";

// Bloque 2 as a user drives it: one announcer, the focus that follows the panels and the fan, the
// selected player's bar as one toolbar, the jugada's pieces and Dibujar's strokes on the keyboard, and
// the work the board no longer does while a panel is closed.

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));
const spy = vi.hoisted(() => ({ cartel: 0, validate: 0 }));
vi.mock("./cartel", async (orig) => {
  const m = await orig<typeof import("./cartel")>();
  return {
    ...m,
    cartelLayout: (...a: Parameters<typeof m.cartelLayout>) => {
      spy.cartel++;
      return m.cartelLayout(...a);
    },
  };
});
vi.mock("../plays", async (orig) => {
  const m = await orig<typeof import("../plays")>();
  return {
    ...m,
    validatePlay: (...a: Parameters<typeof m.validatePlay>) => {
      spy.validate++;
      return m.validatePlay(...a);
    },
  };
});

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);
const W = 400;
const nav = () => screen.getByRole("navigation", { name: "Herramientas de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const root = (c: HTMLElement) => c.querySelector(".pzv") as HTMLElement;
const sr = (c: HTMLElement) => (c.querySelector(".pzv .sr") as HTMLElement).textContent?.replace(/[\u200b\u200c]/g, "") ?? "";
const cromoButton = (name: string) => screen.getByRole("button", { name: new RegExp("^" + name + ", dorsal") });
const at = (u: number, v: number) => {
  const q = proj(CAMS.tv, u, v);
  return { clientX: (q.x / 100) * W, clientY: (q.y / 100) * W * CAMS.tv.Fh };
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/pizarra");
  spy.cartel = 0;
  spy.validate = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const fr = this.matches("[data-frame]");
    const h = fr ? W * CAMS.tv.Fh : 0;
    const w = fr ? W : 0;
    return { x: 0, y: 0, left: 0, top: 0, width: w, height: h, right: w, bottom: h, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("one announcer", () => {
  it("the board has one live region: the plates, the toast, the hint and the read-only strip are not live", () => {
    const { container } = render(<Harness initial={L7()} ro />);
    const live = Array.from(root(container).querySelectorAll("[aria-live], [role=status], [role=alert]"));
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveClass("sr");
    expect(container.querySelector(".hint")).not.toHaveAttribute("aria-live");
    expect(container.querySelector(".robar")).not.toHaveAttribute("role", "status");
    expect(screen.getByRole("img", { name: "Media del siete: 85" })).toBeInTheDocument();
  });

  it("the Plan tab's steppers and la charla's step counter are not live regions either", () => {
    const { container } = render(<Harness initial={L7()} />);
    const live = () => Array.from(root(container).querySelectorAll("[aria-live], [role=status], [role=alert], output:not([role])"));
    fireEvent.click(screen.getByRole("button", { name: /^Plan/ }));
    expect(screen.getByRole("group", { name: "Presión" })).toBeInTheDocument();
    expect(live()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Presión: opción siguiente" }));
    expect(sr(container)).toBe("Presión: Alta");
    fireEvent.click(screen.getByRole("button", { name: "La charla: presentar el siete" }));
    expect(screen.getByRole("img", { name: /^Paso 1\/\d+: sistema/ })).toBeInTheDocument();
    expect(live()).toHaveLength(1);
    expect(live()[0]).toHaveClass("sr");
  });

  it("«Capitán: X» is said once, and the toast's words go through the announcer", () => {
    const { container } = render(<Harness initial={L7()} />);
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(screen.getByRole("button", { name: "Hacer capitán a TELLO" }));
    expect(screen.getByText("Capitán: TELLO", { selector: ".tst span" })).toBeInTheDocument();
    expect(sr(container).split("Capitán: TELLO")).toHaveLength(2);
  });

  it("a paso is announced when the user steps, the hint never reads it out", () => {
    const { container } = render(<Harness initial={L7()} />);
    go("Jugadas");
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    expect(sr(container)).toMatch(/^Paso 2 de 4/);
    expect(container.querySelector(".hint")).not.toHaveAttribute("aria-live");
  });
});

describe("focus", () => {
  it("into the new panel's heading, and back to what opened it when it closes", () => {
    render(<Harness initial={L7()} />);
    // (a click focuses the button in a browser; jsdom needs telling)
    const q = within(nav()).getByRole("button", { name: /Química$/ });
    q.focus();
    fireEvent.click(q);
    expect(document.activeElement?.tagName).toMatch(/^H[23]$/);
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
    // Esc closes the tool: the focus goes back to the rail's «Química»
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(document.activeElement).toBe(within(nav()).getByRole("button", { name: /Química$/ }));
  });

  it("«Más» → Tableros → «Más»: the heading, then the tile that opened it", () => {
    const { container } = render(<Harness initial={L7()} />);
    fireEvent.click(within(nav()).getByRole("button", { name: "Más" }));
    const tile = container.querySelector('.tiles [data-go="tableros"]') as HTMLElement;
    tile.focus();
    fireEvent.click(tile);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Tableros" }));
    const sheet = screen.getByRole("region", { name: "Herramientas: Tableros" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Más" }));
    expect(document.activeElement).toHaveAttribute("data-go", "tableros");
  });

  it("«Jugar de» opens a fresh set of items with the focus on the first one", () => {
    render(<Harness initial={L7()} />);
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(screen.getByRole("button", { name: "Galones y posición de TELLO" }));
    const fan = () => screen.getByRole("dialog", { name: /Menú rápido de TELLO/ });
    expect(document.activeElement).toBe(fan().querySelector(".fi"));
    fireEvent.click(within(fan()).getByRole("button", { name: "Jugar como: elegir posición" }));
    expect(fan().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(fan().querySelector(".fi"));
  });

  it("aria-busy is on the board, not on the page around it", () => {
    const { container } = render(<Harness initial={L7()} session={{ ready: false }} />);
    expect(root(container)).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("region", { name: "La pizarra" })).toHaveAttribute("aria-busy", "true");
  });
});

describe("the selected player's bar", () => {
  it("rendered once, one Tab stop, the arrows (Home / End) between its buttons", () => {
    const { container } = render(<Harness initial={L7()} />);
    fireEvent.click(cromoButton("TELLO"));
    const bar = screen.getByRole("toolbar", { name: "En la mano: TELLO" });
    const bs = within(bar).getAllByRole("button");
    expect(bs.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
    bs[0].focus();
    fireEvent.keyDown(bs[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(bs[1]);
    expect(bs.map((b) => b.tabIndex)).toEqual([-1, 0, -1, -1]);
    fireEvent.keyDown(bs[1], { key: "End" });
    expect(document.activeElement).toBe(bs[3]);
    fireEvent.keyDown(bs[3], { key: "ArrowRight" });
    expect(document.activeElement).toBe(bs[0]);
    // (the arrows stay in the toolbar: the hand doesn't travel between slots)
    expect(container.querySelector(".cd.hov, .slot.hov")).toBeNull();
  });

  it("on a phone it sits at the top of the sheet instead of the apron", () => {
    window.matchMedia = vi.fn((q: string) => ({ matches: q.includes("max-width: 699px"), media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }));
    const { container } = render(<Harness initial={L7()} />);
    fireEvent.click(cromoButton("TELLO"));
    const bars = screen.getAllByRole("toolbar", { name: "En la mano: TELLO" });
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveClass("sb-s");
    expect(container.querySelector(".sheet")?.contains(bars[0])).toBe(true);
  });
});

describe("the keyboard on a jugada's pieces", () => {
  it("the ball is a button: the arrows move it (Shift further), said in words; the replay's ← stays put", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Jugadas");
    const ball = screen.getByRole("button", { name: /^Balón, en / });
    const x0 = libraryPlays(L7())[0].frames[0].ball.x;
    ball.focus();
    fireEvent.keyDown(ball, { key: "ArrowLeft" });
    const p = commits.at(-1)?.plays[0] as Play;
    expect(p.frames[0].ball.x).toBeCloseTo(x0 - 2, 5);
    expect(sr(container)).toMatch(/Balón movido a/);
    expect(screen.getByRole("button", { name: /^Repetición:/ })).toHaveAccessibleName(/paso 1 de 4/);
    fireEvent.keyDown(screen.getByRole("button", { name: /^Balón, en / }), { key: "ArrowLeft", shiftKey: true });
    const p2 = commits[commits.length - 1].plays[0] as Play;
    expect(p2.frames[0].ball.x).toBeCloseTo(x0 - 12, 5);
  });

  it("a rival is a button too: Enter marks it", () => {
    render(<Harness initial={L7()} />);
    go("Jugadas");
    const rivals = screen.getAllByRole("button", { name: /^Rival \d+, en / });
    expect(rivals.length).toBeGreaterThan(0);
    fireEvent.keyDown(rivals[0], { key: "Enter" });
    expect(screen.getAllByRole("button", { name: /^Rival \d+, en / })[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("read-only: the pieces are only drawn (not buttons)", () => {
    const { container } = render(<Harness initial={L7()} ro />);
    go("Jugadas");
    expect(screen.queryByRole("button", { name: /^Balón, en / })).toBeNull();
    expect(container.querySelector(".ball")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Dibujar on the keyboard", () => {
  it("the marked stroke moves with the arrows and stays marked", () => {
    const commits: Lineup[] = [];
    const L = { ...L7(), drawings: [{ id: "k1", kind: "pase" as const, color: "gold" as const, points: [{ x: 20, y: 80 }, { x: 20, y: 20 }] }] };
    const { container } = render(<Harness initial={L} onCommit={(l) => commits.push(l)} />);
    go("Dibujar");
    const fr = container.querySelector("[data-frame]") as HTMLElement;
    fireEvent.pointerDown(fr, { button: 0, ...at(20.5, 50) });
    fireEvent.pointerUp(window, at(20.5, 50));
    expect(sr(container)).toMatch(/^Marcado: .*Flechas para moverlo/);
    fireEvent.keyDown(root(container), { key: "ArrowRight" });
    expect(commits.at(-1)?.drawings[0].points).toEqual([{ x: 22, y: 80 }, { x: 22, y: 20 }]);
    // (as far as it can: never off the pitch)
    fireEvent.keyDown(root(container), { key: "ArrowDown", shiftKey: true });
    expect(commits.at(-1)?.drawings[0].points).toEqual([{ x: 22, y: 90 }, { x: 22, y: 30 }]);
    fireEvent.keyDown(root(container), { key: "ArrowDown", shiftKey: true });
    expect(commits.at(-1)?.drawings[0].points).toEqual([{ x: 22, y: 100 }, { x: 22, y: 40 }]);
    expect(sr(container)).toMatch(/Trazo movido a/);
    expect(container.querySelector(".ink g.sel")).not.toBeNull();
  });
});

describe("work only while it is on screen", () => {
  it("the cartel is laid out only while Compartir is open", () => {
    const { container } = render(<Harness initial={L7()} />);
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(screen.getByRole("button", { name: "Hacer capitán a TELLO" }));
    go("Química");
    expect(spy.cartel).toBe(0);
    fireEvent.click(within(container.querySelector(".cmd") as HTMLElement).getByRole("button", { name: "Compartir" }));
    expect(spy.cartel).toBeGreaterThan(0);
  });

  it("your jugada is checked once, not on every render", () => {
    const own: Play = { ...libraryPlays(L7())[1], id: "j1", kind: "propia", name: "Mía" };
    render(<Harness initial={{ ...L7(), plays: [own] }} />);
    go("Jugadas");
    fireEvent.click(within(screen.getByRole("group", { name: "Biblioteca de jugadas" })).getByRole("button", { name: /Mía/ }));
    const n = spy.validate;
    expect(n).toBeGreaterThan(0);
    const pills = screen.getAllByRole("button", { pressed: false }).filter((b) => b.classList.contains("pill"));
    fireEvent.click(pills[0]);
    fireEvent.click(pills[0]);
    expect(spy.validate).toBe(n);
  });
});

describe("the two halves of Bloque 2 together", () => {
  it("Comparar faces «El siete que jugó» of the linked match: the acta's starters on this board's system", () => {
    const m: CalMatch = { id: "m7", j: 7, rival: "MAD SKY", dateMs: 0, played: true, gf: 2, ga: 1, home: true, venue: "", conv: { starters: ["evans", "illescas", "tello", "huberoski", "eguzquiza", "kevin", "erik"], bench: [] } };
    const { container } = render(<Harness initial={L7()} session={{ matchId: "m7" }} props={{ calendar: [m] }} />);
    go("Comparar");
    const pick = screen.getByRole("combobox", { name: "Tablero con el que comparar" });
    expect(pick).toHaveValue("partido");
    expect(within(pick).getByRole("option")).toHaveTextContent(/^El siete que jugó · /);
    expect(within(container.querySelector(".chg .in") as HTMLElement).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["ERIK", "KEVIN"]);
    expect(within(container.querySelector(".chg .out") as HTMLElement).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["ALMACHI", "ADRIAN"]);
  });

  it("the Plan tab says what the plan does in free mode (and nothing with a system)", () => {
    const { unmount } = render(<Harness initial={{ ...L7(), freeMode: true }} />);
    fireEvent.click(screen.getByRole("button", { name: /^Plan/ }));
    expect(screen.getByText(/En modo libre el plan no mueve a nadie/)).toBeInTheDocument();
    unmount();
    render(<Harness initial={L7()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Plan/ }));
    expect(screen.queryByText(/En modo libre el plan no mueve a nadie/)).toBeNull();
  });

  it("a tool's «nuevo» badge goes once it has been opened twice on this device", () => {
    // (a day into the badges' 30)
    vi.spyOn(Date, "now").mockReturnValue(NUEVO_DESDE + 86_400_000);
    render(<Harness initial={L7()} />);
    const badge = () => within(nav()).getByRole("button", { name: "Jugadas" }).querySelector(".nv");
    expect(badge()).not.toBeNull();
    go("Jugadas");
    go("Siete");
    expect(badge()).not.toBeNull();
    go("Jugadas");
    go("Siete");
    expect(badge()).toBeNull();
    // (Dibujar, never opened, keeps its own)
    expect(within(nav()).getByRole("button", { name: "Dibujar" }).querySelector(".nv")).not.toBeNull();
  });

  it("the ficha the board opens is the full one (ficha.ts): his galones and the board's match", () => {
    const fresh = { ...L7(), roles: { captainId: "tello" } };
    render(<Harness initial={fresh} />);
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(cromoButton("TELLO"));
    const dlg = screen.getByRole("dialog", { name: "Ficha de TELLO" });
    expect(within(dlg).getByText("Capitán")).toBeInTheDocument();
    expect(within(dlg).getByText("Galones")).toBeInTheDocument();
    expect(within(dlg).getByText("Partido")).toBeInTheDocument();
  });
});
