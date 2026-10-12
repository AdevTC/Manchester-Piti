import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { Lineup } from "../formations";
import type { CalMatch } from "./boards";
import { BENCH_VIEW_KEY } from "./benchView";
import { NUEVO_DESDE } from "./rail";
import { demoSquad, lineupOf, squadOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";

// The «FUT» chrome around the pitch: the command bar's plates, the «Acciones» rail with its shortcuts
// and the next match, the prompt bar, the keyboard, the bench view and the selected player's bar.

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const key = (k: string, o: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.body, { key: k, ...o });
const cromoButton = (name: string) => screen.getByRole("button", { name: new RegExp("^" + name + ", dorsal") });
const rail = () => screen.getByRole("navigation", { name: "Herramientas de la pizarra" });
const panel = (title: string) => screen.getByRole("region", { name: "Herramientas: " + title });
const onceTabs = () => within(screen.getByRole("group", { name: "Herramienta del siete" })).getAllByRole("button");
const pmb = () => screen.getByRole("toolbar", { name: "Atajos y acciones" });
const cmd = (c: HTMLElement) => c.querySelector(".cmd") as HTMLElement;

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("the command bar", () => {
  it("MEDIA (the seven's form), 7/7, QUÍMICA and SISTEMA; Compartir and La charla", () => {
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    const bar = cmd(container);
    // 87 + 83 + 79 + 95 + 81 + 74 + 96 = 595 → 85
    expect(within(bar).getByRole("img", { name: "Media del siete: 85" })).toHaveTextContent("MEDIA85");
    expect(within(bar).getByText("7/7", { selector: ".val b" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: /^Química \d+ de 100/ })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Sistema 2-3-1: elegir sistema" })).toBeInTheDocument();
    // the board's name with its match and the autosave line
    expect(within(bar).getByRole("button", { name: "Tablero J8 · MAD SKY, J8 · MAD SKY: cambiar de tablero" })).toHaveTextContent(/Guardado · ahora/);
    const share = within(bar).getByRole("button", { name: "Compartir" });
    fireEvent.click(share);
    expect(panel("Compartir")).toBeInTheDocument();
    expect(share).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(bar).getByRole("button", { name: "La charla: presentar el siete" }));
    expect(screen.getByRole("heading", { name: "El guion" })).toBeInTheDocument();
  });

  it("MEDIA counts only who is on the pitch; an empty board is 0", () => {
    const { container, unmount } = render(<Harness initial={lineupOf(["evans", "illescas", null, null, null, null, null], "2-3-1", sq)} />);
    expect(within(cmd(container)).getByRole("img", { name: "Media del siete: 85" })).toBeInTheDocument();
    unmount();
    const r2 = render(<Harness initial={lineupOf([], "2-3-1", sq)} />);
    expect(within(cmd(r2.container)).getByRole("img", { name: "Media del siete: 0" })).toBeInTheDocument();
  });

  it("in Jugadas the repetición bug takes the plates' slot", () => {
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    fireEvent.click(within(rail()).getByRole("button", { name: "Jugadas" }));
    const bar = cmd(container);
    expect(within(bar).getByRole("button", { name: /^Repetición: .*paso 1 de 4/ })).toBeInTheDocument();
    expect(bar.querySelector(".mdp")).toBeNull();
    expect(bar.querySelector(".sysp")).toBeNull();
    // (and no bug on the pitch any more)
    expect(container.querySelector(".rowb")).toBeNull();
  });
});

describe("the «Acciones» rail", () => {
  it("En el campo / Gestión, a line each, the shortcut 1–8 and «nuevo» on Jugadas and Dibujar", () => {
    // (the badges expire 30 days after NUEVO_DESDE: a day into them)
    const now = vi.spyOn(Date, "now").mockReturnValue(NUEVO_DESDE + 86_400_000);
    onTestFinished(() => now.mockRestore());
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    const nav = rail();
    expect(Array.from(nav.querySelectorAll(".mg-h")).map((h) => h.textContent)).toEqual(["En el campo", "Gestión"]);
    const tools = Array.from(nav.querySelectorAll<HTMLButtonElement>(".mbt:not(.mob)"));
    expect(tools.map((b) => b.getAttribute("aria-label"))).toEqual(["Siete", "Química", "Jugadas", "Dibujar", "Tableros", "Comparar", "Compartir", "Ajustes"]);
    expect(tools.map((b) => b.querySelector(".mk")?.textContent)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(tools.map((b) => b.querySelector("small")?.textContent)[0]).toBe("Alineación y banquillo");
    expect(tools.filter((b) => b.querySelector(".nv")).map((b) => b.getAttribute("aria-label"))).toEqual(["Jugadas", "Dibujar"]);
    // the four of Gestión are the desktop's (the phone has «Más»)
    expect(tools.slice(4).every((b) => b.classList.contains("dsk"))).toBe(true);
    expect(within(nav).getByRole("button", { name: "Más" }).classList.contains("mob")).toBe(true);
    expect(within(nav).getByRole("button", { name: "Siete" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".mbar .mft")).not.toBeNull();
  });

  it("the next match's card counts the real convocatoria", () => {
    const m: CalMatch = { id: "m8", j: 8, rival: "MAD SKY", dateMs: Date.UTC(2026, 10, 8, 11), played: false, gf: null, ga: null, home: true, venue: "" };
    const withCv = squadOf(sq.list.map((c, i) => ({ ...c, cv: i < 5 ? ("voy" as const) : i < 7 ? ("duda" as const) : i < 8 ? ("no" as const) : undefined })));
    const { container } = render(
      <Harness
        initial={lineupOf(SEVEN, "2-3-1", sq)}
        props={{ squad: withCv, nextMatch: m, conv: { match: m, loading: false, error: false }, match: { short: "J8 · MAD SKY", date: "dom 8 nov", time: "12:00" } }}
      />,
    );
    const card = container.querySelector(".mft") as HTMLElement;
    expect(card.querySelector("small")?.textContent).toBe("Próximo partido");
    expect(card.querySelector("b")?.textContent).toBe("J8 · MAD SKY");
    expect(card).toHaveTextContent("dom 8 nov · 12:00");
    expect(card.querySelector(".mft-c")).toHaveTextContent("5 voy2 duda1 no va");
  });

  it("without answers yet the card says so; without a match there is none", () => {
    const m: CalMatch = { id: "m8", j: 8, rival: "MAD SKY", dateMs: 0, played: false, gf: null, ga: null, home: true, venue: "" };
    const { container, unmount } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} props={{ nextMatch: m, conv: { match: m, loading: false, error: false } }} />);
    expect(container.querySelector(".mft .mft-c")?.textContent).toBe("Nadie ha respondido aún");
    unmount();
    const r2 = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} props={{ match: null }} />);
    expect(r2.container.querySelector(".mft")).toBeNull();
  });
});

describe("the keyboard", () => {
  it("1–8 open the tools; Esc goes back to the siete", () => {
    render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    key("2");
    expect(panel("Química")).toBeInTheDocument();
    key("5");
    expect(panel("Tableros")).toBeInTheDocument();
    key("8");
    expect(panel("Ajustes")).toBeInTheDocument();
    key("Escape");
    expect(within(rail()).getByRole("button", { name: "Siete" })).toHaveAttribute("aria-pressed", "true");
    key("3");
    expect(panel("Jugadas")).toBeInTheDocument();
  });

  it("Q / E walk the siete's tabs; R switches the bench between list and cromos (remembered)", () => {
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    const pressed = () => onceTabs().map((b) => b.getAttribute("aria-pressed"));
    expect(pressed()).toEqual(["true", "false", "false"]);
    key("e");
    expect(pressed()).toEqual(["false", "true", "false"]);
    key("E");
    expect(pressed()).toEqual(["false", "false", "true"]);
    key("e");
    expect(pressed()).toEqual(["true", "false", "false"]);
    key("q");
    expect(pressed()).toEqual(["false", "false", "true"]);
    const root = container.querySelector(".pzv") as HTMLElement;
    expect(root.classList.contains("b-lista")).toBe(true);
    key("r");
    expect(root.classList.contains("b-lista")).toBe(false);
    expect(localStorage.getItem(BENCH_VIEW_KEY)).toBe("cromos");
    key("r");
    expect(root.classList.contains("b-lista")).toBe(true);
    expect(localStorage.getItem(BENCH_VIEW_KEY)).toBe("lista");
  });

  it("with a player in the hand: C capitán, G galones, F ficha, Esc soltar", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} onCommit={(l) => commits.push(l)} />);
    const root = container.querySelector(".pzv") as HTMLElement;
    fireEvent.click(cromoButton("TELLO"));
    expect(root.classList.contains("has-sel")).toBe(true);
    key("c");
    expect(commits.at(-1)?.roles.captainId).toBe("tello");
    // still in the hand
    expect(root.classList.contains("has-sel")).toBe(true);
    key("f");
    expect(screen.getByRole("dialog", { name: "Ficha de TELLO" })).toBeInTheDocument();
    // the ficha keeps its keys: 1–8 and Esc do nothing to the board under it
    key("2");
    expect(within(rail()).getByRole("button", { name: "Siete" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(screen.getByRole("dialog", { name: "Ficha de TELLO" })).getByRole("button", { name: "Cerrar" }));
    key("Escape");
    expect(root.classList.contains("has-sel")).toBe(false);
    fireEvent.click(cromoButton("TELLO"));
    key("g");
    expect(screen.getByRole("dialog", { name: /Menú rápido de TELLO/ })).toBeInTheDocument();
  });

  it("Ctrl Z deshace (in Dibujar, the last stroke is its own undo); typing keeps its keys", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq)} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: "Hueco DFC vacío: toca para elegir jugador" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^ILLESCAS, dorsal 4/ })[0]);
    expect(screen.getByText("7/7", { selector: ".val b" })).toBeInTheDocument();
    key("z", { ctrlKey: true });
    expect(screen.getByText("6/7", { selector: ".val b" })).toBeInTheDocument();
    key("z", { ctrlKey: true, shiftKey: true });
    expect(screen.getByText("7/7", { selector: ".val b" })).toBeInTheDocument();
    // a key typed into a field is the field's
    fireEvent.click(screen.getByRole("button", { name: "Buscar en la plantilla" }));
    const search = screen.getByRole("searchbox", { name: "Buscar jugador" });
    fireEvent.keyDown(search, { key: "2" });
    expect(within(rail()).getByRole("button", { name: "Siete" })).toHaveAttribute("aria-pressed", "true");
  });

  it("read-only: no captain from the keyboard (nothing is in the hand)", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} ro onCommit={(l) => commits.push(l)} />);
    fireEvent.click(cromoButton("TELLO"));
    key("c");
    key("z", { ctrlKey: true });
    expect(commits).toHaveLength(0);
    expect(container.querySelector(".pzv")?.classList.contains("has-sel")).toBe(false);
    expect(container.querySelector(".selbar")).toBeNull();
  });

  it("Jugadas: Space plays, ← → step; the prompt bar's buttons do the same", () => {
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    key("3");
    const bug = () => within(cmd(container)).getByRole("button", { name: /^Repetición:/ });
    expect(bug()).toHaveAccessibleName(/paso 1 de 4/);
    key("ArrowRight");
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
    key("ArrowLeft");
    expect(bug()).toHaveAccessibleName(/paso 1 de 4/);
    fireEvent.click(within(pmb()).getByRole("button", { name: "Paso siguiente (→)" }));
    expect(bug()).toHaveAccessibleName(/paso 2 de 4/);
    expect(within(pmb()).getByRole("button", { name: "Reproducir (Espacio)" })).toBeInTheDocument();
    key(" ");
    expect(within(pmb()).getByRole("button", { name: "Pausa (Espacio)" })).toBeInTheDocument();
    fireEvent.click(within(pmb()).getByRole("button", { name: "Volver al siete (Esc)" }));
    expect(within(rail()).getByRole("button", { name: "Siete" })).toHaveAttribute("aria-pressed", "true");
  });

  it("la charla: → a step on, Esc leaves it", () => {
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    fireEvent.click(within(cmd(container)).getByRole("button", { name: "La charla: presentar el siete" }));
    const counter = () => screen.getByRole("img", { name: /^Paso \d+\/\d+/ });
    expect(counter()).toHaveAccessibleName(/^Paso 1\//);
    key("ArrowRight");
    expect(counter()).toHaveAccessibleName(/^Paso 2\//);
    expect(within(pmb()).getByRole("button", { name: "Salir de la charla (Esc)" })).toBeInTheDocument();
    key("Escape");
    expect(screen.queryByRole("img", { name: /^Paso \d+\/\d+/ })).not.toBeInTheDocument();
  });
});

describe("the prompt bar", () => {
  it("teaches the siete's keys; with a player in the hand, his actions", () => {
    render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} />);
    const items = () => Array.from(pmb().querySelectorAll(".pm")).map((x) => x.textContent);
    expect(items()).toEqual(["ClicElegir jugador", "ArrastraMover al campo", "Q EPestañas", "RVer en cromos", "1–8Herramientas", "Ctrl ZDeshacer"]);
    expect(pmb().querySelector(".pm-sv")?.textContent).toBe("Guardado · ahora");
    fireEvent.click(cromoButton("TELLO"));
    expect(items()).toEqual(["79TELLO en la mano", "ClicCambiar con otro o con un hueco", "CCapitán", "GGalones", "FFicha", "EscSoltar"]);
    fireEvent.click(within(pmb()).getByRole("button", { name: "Ficha (F)" }));
    expect(screen.getByRole("dialog", { name: "Ficha de TELLO" })).toBeInTheDocument();
  });
});

describe("the selected player's bar", () => {
  it("a pitch player: kicker, what a tap does, Capitán / Galones / Ficha / ✕; the targets glow", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={lineupOf(SEVEN, "2-3-1", sq)} onCommit={(l) => commits.push(l)} />);
    expect(container.querySelector(".selbar")).toBeNull();
    fireEvent.click(cromoButton("TELLO"));
    // rendered once: on the apron (tablet / desktop; a phone has it at the top of the sheet instead)
    const bars = screen.getAllByRole("toolbar", { name: "En la mano: TELLO" });
    expect(bars.map((b) => (b.classList.contains("sb-p") ? "p" : "s"))).toEqual(["p"]);
    const bar = bars[0];
    expect(bar.querySelector(".sb-t small")?.textContent).toBe("TELLO · DFC · en la mano");
    expect(bar.querySelector(".sb-t b")?.textContent).toBe("Toca con quién se cambia: otro del campo o uno del banquillo");
    // the cromos he can swap with glow; his own line (a defender) the most
    const cls = (id: string) => (container.querySelector(`.cd[data-tok="${id}"]`) as HTMLElement).classList;
    expect(cls("illescas").contains("tgt") && cls("illescas").contains("best")).toBe(true);
    expect(cls("huberoski").contains("tgt") && !cls("huberoski").contains("best")).toBe(true);
    expect(cls("tello").contains("tgt")).toBe(false);
    expect(cromoButton("ILLESCAS")).toHaveAccessibleName(/Toca para intercambiarlo con TELLO$/);
    const cap = within(bar).getByRole("button", { name: "Hacer capitán a TELLO" });
    fireEvent.click(cap);
    expect(commits.at(-1)?.roles.captainId).toBe("tello");
    expect(within(screen.getAllByRole("toolbar", { name: "En la mano: TELLO" })[0]).getByRole("button", { name: "Quitar el brazalete a TELLO" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(screen.getAllByRole("toolbar", { name: "En la mano: TELLO" })[0]).getByRole("button", { name: "Galones y posición de TELLO" }));
    expect(screen.getByRole("dialog", { name: /Menú rápido de TELLO/ })).toBeInTheDocument();
  });

  it("Ficha and ✕; a bench player has no Capitán / Galones and says where he goes", () => {
    const { container } = render(<Harness initial={lineupOf(["evans", null, "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq)} />);
    fireEvent.click(cromoButton("TELLO"));
    fireEvent.click(within(screen.getAllByRole("toolbar", { name: "En la mano: TELLO" })[0]).getByRole("button", { name: "Ficha de TELLO" }));
    expect(screen.getByRole("dialog", { name: "Ficha de TELLO" })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Ficha de TELLO" })).getByRole("button", { name: "Cerrar" }));
    fireEvent.click(within(screen.getAllByRole("toolbar", { name: "En la mano: TELLO" })[0]).getByRole("button", { name: "Soltar a TELLO" }));
    expect(container.querySelector(".selbar")).toBeNull();
    // from the bench
    fireEvent.click(screen.getAllByRole("button", { name: /^ILLESCAS, dorsal 4/ })[0]);
    const bar = screen.getAllByRole("toolbar", { name: "En la mano: ILLESCAS" })[0];
    expect(bar.querySelector(".sb-t small")?.textContent).toBe("ILLESCAS · del banquillo · en la mano");
    expect(bar.querySelector(".sb-t b")?.textContent).toBe("Toca a quién sustituye o un hueco libre");
    expect(within(bar).queryByRole("button", { name: /capitán/i })).toBeNull();
    expect(within(bar).queryByRole("button", { name: /Galones/ })).toBeNull();
    // every pitch cromo is a target: «Entra por él»; his line (DEF) the most
    const tello = container.querySelector('.cd[data-tok="tello"]') as HTMLElement;
    expect(tello.classList.contains("tgt") && tello.classList.contains("best")).toBe(true);
    expect(tello.querySelector(".cc-tg")?.textContent).toBe("Entra por él");
    expect(cromoButton("TELLO")).toHaveAccessibleName(/Toca: entra ILLESCAS por él$/);
  });
});
