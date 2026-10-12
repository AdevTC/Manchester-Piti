import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import type { CalMatch } from "./boards";
import { CAMS } from "./geometry";
import { libraryPlays } from "../playLibrary";
import { charlaView, STEP_PLAN } from "./charla";
import { tacSummary } from "./view";
import { charlaShape, defaultShapeOff, setOffFormation } from "./phases";
import { demoSquad, lineupOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";
import { DropBadge } from "./TacticaPanel";
import type { NewBoardSeed } from "./useBoardSession";

// Bloque 4 · A «táctica» as a user drives it: con / sin balón and the fases on the pitch (Siete → Plan), the
// predefined styles with their preview, the conditional plan (and its suggestion on the live card), the
// química por jugador (the diamonds, «de 21», what a drop would do), what this seven has done and
// «Copiar el siete del último partido».

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (o: Partial<Lineup> = {}): Lineup => ({ ...lineupOf(SEVEN, "2-3-1", sq), ...o });
const W = 400;
const sr = (c: HTMLElement) => (c.querySelector(".pzv .sr") as HTMLElement).textContent?.replace(/[​‌]/g, "") ?? "";
const cardY = (c: HTMLElement, id: string) => Number((c.querySelector(`.cd[data-tok="${id}"]`) as HTMLElement).style.getPropertyValue("--y"));
const cromoButton = (name: string) => screen.getByRole("button", { name: new RegExp("^" + name + ", dorsal") });
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
  ...o,
});

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/pizarra#plan");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const fr = this.matches("[data-frame]");
    const h = fr ? W * CAMS.tv.Fh : 0;
    const w = fr ? W : 0;
    return { x: 0, y: 0, left: 0, top: 0, width: w, height: h, right: w, bottom: h, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("A1 · con balón · sin balón · transición", () => {
  it("«Sin balón» takes the cromos to the shape without the ball and back; its block is edited and saved", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    const seg = screen.getByRole("group", { name: "Con balón, sin balón o transición" });
    const y0 = cardY(container, "illescas");
    fireEvent.click(within(seg).getByRole("button", { name: "Sin balón" }));
    expect(within(seg).getByRole("button", { name: "Sin balón" })).toHaveAttribute("aria-pressed", "true");
    // a step back: the defender is drawn lower on the pitch
    expect(cardY(container, "illescas")).toBeGreaterThan(y0);
    expect(screen.getByText(/2-3-1 · el bloque baja 4 m/, { selector: "p.t4-d" })).toHaveTextContent("(propuesta: tócala para guardarla)");
    expect(sr(container)).toBe("Sin balón: 2-3-1 · el bloque baja 4 m");
    // nothing stored until it is touched
    expect(commits).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Bloque atrás" }));
    expect(commits.at(-1)?.shapeOff?.offs[1].dv).toBe(10);
    fireEvent.change(screen.getByLabelText("Sistema sin balón"), { target: { value: "3-2-1" } });
    expect(commits.at(-1)?.shapeOff?.formation).toBe("3-2-1");
    // the plan's own line can't be dragged over a phase
    expect(container.querySelector(".dline")).toBeNull();
    fireEvent.click(within(seg).getByRole("button", { name: "Con balón" }));
    expect(cardY(container, "illescas")).toBeCloseTo(y0, 1);
    expect(sr(container)).toBe("Con balón: el plan");
  });

  it("warns who runs too much between the two shapes, and the charla presents the shape without the ball", () => {
    const L = L7();
    const offs = defaultShapeOff(L).offs.map((o, i) => (i === 6 ? { du: 0, dv: 40 } : o));
    render(<Harness initial={{ ...L, shapeOff: { formation: "2-3-1", offs } }} />);
    expect(screen.getByText(/^ADRIAN corre demasiado entre fases \(\d+ m\)$/)).toBeInTheDocument();
    const shaped = setOffFormation(L7(), "3-2-1");
    const v = charlaView({
      L: shaped,
      sq,
      step: STEP_PLAN,
      play: libraryPlays(shaped)[0],
      playShort: "Córner",
      match: null,
      boardName: "Mi tablero",
      sysName: "2-3-1",
      tacSum: tacSummary(shaped),
      qv: 70,
      in3d: false,
      playing: false,
      sinBalon: charlaShape(shaped, (x) => x.toUpperCase()),
    });
    expect(v.plan?.at(-1)?.t).toBe("Sin balón · 3-2-1");
  });

  it("a read-only board shows both shapes but can't edit them", () => {
    render(<Harness initial={L7()} ro />);
    fireEvent.click(screen.getByRole("button", { name: "Transición" }));
    expect(screen.queryByRole("button", { name: "Bloque atrás" })).toBeNull();
  });
});

describe("A4 · las fases en el campo", () => {
  it("the scrubber moves the cromos as the consignas say, with arrows, and says the phase", () => {
    const { container } = render(<Harness initial={L7({ tactics: { ...L7().tactics, press: "Alta" } })} />);
    const slider = screen.getByRole("slider");
    const y0 = cardY(container, "adrian");
    const arrowsD = () => Array.from(container.querySelectorAll(".tarr")).map((a) => a.getAttribute("d")).join("|");
    const arrows0 = arrowsD();
    fireEvent.change(slider, { target: { value: "4" } });
    expect(slider).toHaveAttribute("aria-valuetext", "Presión");
    expect(sr(container)).toBe("Fase: Presión. Saltamos a por el balón.");
    expect(cardY(container, "adrian")).toBeLessThan(y0);
    // the salida and the foco give way to where each one runs in the phase
    expect(arrowsD()).not.toBe(arrows0);
    expect(container.querySelectorAll(".tarr").length).toBeGreaterThan(3);
    fireEvent.change(slider, { target: { value: "0" } });
    expect(cardY(container, "adrian")).toBeCloseTo(y0, 1);
  });
});

describe("A3 · estilos predefinidos", () => {
  it("a style is previewed (what changes, pros and cons) before it is applied", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    const styles = screen.getByRole("group", { name: /^Estilos predefinidos/ });
    fireEvent.click(within(styles).getByRole("button", { name: /^Presión alta/ }));
    const pv = screen.getByRole("group", { name: "Vista previa: Presión alta" });
    expect(pv).toHaveTextContent("Presión: media → alta");
    expect(pv).toHaveTextContent("A favor");
    expect(pv).toHaveTextContent(/El equipo se adelanta \d+ m/);
    expect(commits).toHaveLength(0);
    fireEvent.click(within(pv).getByRole("button", { name: "Aplicar «Presión alta»" }));
    expect(commits.at(-1)?.tactics.press).toBe("Alta");
    expect(commits.at(-1)?.style).toBe("presion");
    expect(screen.queryByRole("group", { name: "Vista previa: Presión alta" })).toBeNull();
    expect(screen.getByText(/ahora: Presión alta/)).toBeInTheDocument();
  });
});

describe("A2 · el plan condicional", () => {
  it("rules are added, edited and removed (each one a change of the board)", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: "Añadir regla" }));
    expect(commits.at(-1)?.condPlan).toHaveLength(1);
    expect(screen.getByText("Si vamos ganando por 1 desde el 30′ → mentalidad defensiva")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Consigna"), { target: { value: "press" } });
    expect(commits.at(-1)?.condPlan?.[0]).toMatchObject({ key: "press", value: "Repliegue" });
    fireEvent.change(screen.getByLabelText("Cambio: sale"), { target: { value: "adrian" } });
    // (who comes in is proposed from the bench at once)
    expect(commits.at(-1)?.condPlan?.[0].sub?.out).toBe("adrian");
    fireEvent.change(screen.getByLabelText("Cambio: entra"), { target: { value: "kevin" } });
    expect(commits.at(-1)?.condPlan?.[0].sub).toEqual({ out: "adrian", in: "kevin" });
    fireEvent.click(screen.getByRole("button", { name: /^Quitar la regla: / }));
    expect(commits.at(-1)?.condPlan).toEqual([]);
  });

  it("live: when a rule holds, the live card suggests it and «Aplicar el plan» changes the consigna and plans the cambio", () => {
    vi.useFakeTimers({ now: T0 + 24.5 * MIN, toFake: ["setTimeout", "clearTimeout", "Date"] });
    window.history.replaceState(null, "", "/pizarra");
    const m = match({ events: [{ id: "e1", type: "goal", minute: 5, playerId: "adrian" }] });
    const commits: Lineup[] = [];
    render(
      <Harness
        initial={L7({ condPlan: [{ id: "r1", when: "ganando", by: 1, from: 20, key: "mentality", value: "Defensiva", sub: { out: "adrian", in: "kevin" } }] })}
        onCommit={(l) => commits.push(l)}
        session={{ matchId: "m8" }}
        props={{ calendar: [m], conv: { match: m, loading: false, error: false } }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^En directo/ }));
    const card = screen.getByRole("region", { name: "Partido en directo" });
    const sug = within(card).getByRole("group", { name: "El plan condicional, ahora" });
    expect(sug).toHaveTextContent("Toca el plan: vamos ganando por 1 desde el 20′ → mentalidad defensiva + entra KEVIN por ADRIAN");
    act(() => {
      fireEvent.click(within(sug).getByRole("button", { name: "Aplicar el plan" }));
    });
    expect(commits.at(-1)?.tactics.mentality).toBe("Defensiva");
    expect(commits.at(-1)?.subs?.map((s) => [s.min, s.out, s.in])).toEqual([[25, "adrian", "kevin"]]);
    expect(within(card).queryByRole("group", { name: "El plan condicional, ahora" })).toBeNull();
  });
});

describe("A5 · la química por jugador", () => {
  it("each cromo says its diamonds; the química panel adds them up over 21", () => {
    window.history.replaceState(null, "", "/pizarra#quimica");
    render(<Harness initial={L7()} />);
    expect(cromoButton("ADRIAN")).toHaveAccessibleName(/química [0-3] de 3/);
    expect(screen.getAllByText(/^Química por jugador:/)[0]).toHaveTextContent(/Química por jugador: \d+ de 21/);
  });

  it("the keyboard's hand hears what a drop would do to it", () => {
    window.history.replaceState(null, "", "/pizarra");
    render(<Harness initial={L7()} />);
    const adrian = cromoButton("ADRIAN");
    fireEvent.click(adrian);
    fireEvent.keyDown(adrian, { key: "ArrowDown" });
    // the striker to the centre midfielder's spot: both out of position, the sum goes down
    expect(screen.getByText(/^Sobre EGUZQUIZA, MC: Intro para cambiarlos · −\d+ química aquí/, { selector: ".sr" })).toBeInTheDocument();
  });

  it("the badge over the landing spot (in the pitch frame)", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const { unmount } = render(<DropBadge host={host} at={{ x: 40, y: 60 }} txt="+2 química aquí" down={false} />);
    const b = host.querySelector(".t4-drop") as HTMLElement;
    expect(b).toHaveTextContent("+2 química aquí");
    expect(b.style.getPropertyValue("--x")).toBe("40.00");
    unmount();
    host.remove();
  });
});

describe("A6 · lo planeado frente a lo jugado", () => {
  const played = (id: string, j: number, gf: number, ga: number, starters = SEVEN): CalMatch => match({ id, j, rival: "R" + j, dateMs: T0 + j * 1000, played: true, gf, ga, conv: { starters, bench: [] } });

  it("the Plan tab says what this seven has done and how the linked match went against the plan", () => {
    const cal = [played("m1", 1, 3, 1), played("m2", 2, 0, 0, SEVEN.slice(0, 5).concat(["kevin", "erik"]))];
    render(<Harness initial={L7()} session={{ matchId: "m2" }} props={{ calendar: cal }} />);
    const rec = screen.getByRole("group", { name: "Lo planeado frente a lo jugado" });
    expect(rec).toHaveTextContent("Con este siete: 1V 1E 0D · 3 GF 1 GC");
    expect(rec).toHaveTextContent("Jugaron 5 de los 7 planeados · no salieron ALMACHI, ADRIAN · salieron KEVIN, ERIK");
  });

  it("Tableros → «Copiar el siete del último partido» makes a new board with its seven, by position", async () => {
    window.history.replaceState(null, "", "/pizarra#tableros");
    const seeds: (NewBoardSeed | undefined)[] = [];
    const cal = [played("m1", 1, 3, 1, ["adrian", "evans", "huberoski", "illescas", "almachi", "tello", "kevin"]), played("m0", 0, 0, 1)];
    render(
      <Harness
        initial={L7()}
        props={{ calendar: cal }}
        session={{
          newBoard: (s?: NewBoardSeed) => {
            seeds.push(s);
            return Promise.resolve("Como en J1 · R1");
          },
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar el siete del último partido (J1 · R1) en un tablero nuevo" }));
    });
    expect(seeds[0]?.name).toBe("Como en J1 · R1");
    expect(seeds[0]?.formation).toBe("2-3-1");
    expect(seeds[0]?.slots[0]).toBe("evans");
    expect(seeds[0]?.slots[6]).toBe("adrian");
    expect(new Set(seeds[0]?.slots).size).toBe(7);
  });
});
