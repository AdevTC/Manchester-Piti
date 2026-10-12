import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import { boardDoc, demoSquad, lineupOf, squadOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";
import type { CalMatch } from "./boards";
import { noteOpened } from "./boardList";
import { OFFLINE_TXT } from "./online";

// Bloque 5 · equipo y organización, as a user drives it: las etiquetas, el buscador y «Recientes» de
// Tableros, el capitán rotativo, la pachanga (tecla 9), el plan para imprimir y el aviso sin conexión.

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));
vi.mock("./cartel", async (orig) => {
  const real = await orig<typeof import("./cartel")>();
  return { ...real, crestImage: async () => null, cartelBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })), shareCartel: vi.fn(async () => "downloaded" as const) };
});
vi.mock("./pachangaCard", () => ({ pachangaBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })) }));

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = () => lineupOf(SEVEN, "2-3-1", sq);
const m = (o: Partial<CalMatch>): CalMatch => ({ id: "m8", j: 8, rival: "MAD SKY", dateMs: Date.UTC(2026, 10, 8, 10), played: false, gf: null, ga: null, home: true, venue: "", ...o });
const M7 = m({ id: "m7", j: 7, rival: "RAYO", dateMs: Date.UTC(2026, 10, 1, 10), played: true, gf: 3, ga: 1 });
const M8 = m({});

const nav = () => screen.getByRole("navigation", { name: "Herramientas de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const key = (k: string) => fireEvent.keyDown(document.body, { key: k });
const live = (c: HTMLElement) => c.querySelector(".sr")?.textContent ?? "";

beforeEach(() => {
  window.history.replaceState(null, "", "/pizarra");
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Tableros · etiquetas", () => {
  it("a suggestion or a typed tag goes on the board; three at most; a chip takes one off", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    go("Tableros");
    const tags = () => screen.getByRole("group", { name: "Etiquetas del tablero" });
    fireEvent.click(within(tags()).getByRole("button", { name: "Añadir la etiqueta «Liga»" }));
    expect(commits.at(-1)?.tags).toEqual(["Liga"]);
    const input = within(tags()).getByRole("textbox", { name: "Nueva etiqueta" });
    fireEvent.change(input, { target: { value: "liga" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(within(tags()).getByRole("alert")).toHaveTextContent("Ya lleva «liga».");
    expect(commits).toHaveLength(1);
    fireEvent.change(input, { target: { value: "  Copa   del Rey " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(commits.at(-1)?.tags).toEqual(["Liga", "Copa del Rey"]);
    fireEvent.click(within(tags()).getByRole("button", { name: "Añadir la etiqueta «Entreno»" }));
    expect(commits.at(-1)?.tags).toEqual(["Liga", "Copa del Rey", "Entreno"]);
    // full: no field, a note
    expect(within(tags()).queryByRole("textbox")).toBeNull();
    expect(tags()).toHaveTextContent("3 de 3 etiquetas: quita una para poner otra.");
    fireEvent.click(within(tags()).getByRole("button", { name: "Quitar la etiqueta «Copa del Rey»" }));
    expect(commits.at(-1)?.tags).toEqual(["Liga", "Entreno"]);
    // (the seven is untouched)
    expect(commits.at(-1)?.slots.map((s) => s.playerId)).toEqual(SEVEN);
  });

  it("read-only: the tags are shown, never edited", () => {
    render(<Harness initial={{ ...L7(), tags: ["Copa"] }} ro />);
    go("Tableros");
    const tags = screen.getByRole("group", { name: "Etiquetas del tablero" });
    expect(tags).toHaveTextContent("Copa");
    expect(within(tags).queryAllByRole("button")).toHaveLength(0);
    expect(within(tags).queryByRole("textbox")).toBeNull();
  });
});

describe("Tableros · buscar, ordenar, filtrar y «Recientes»", () => {
  const mine = () => [
    boardDoc("b1", { ...L7(), tags: ["Liga"] }, { name: "J8 · MAD SKY", updatedAt: 9, matchId: "m8" }),
    boardDoc("b2", { ...L7(), tags: ["Entreno"] }, { name: "Martes", updatedAt: 5 }),
    boardDoc("b3", { ...L7(), tags: ["Liga", "Copa"] }, { name: "Atlético B", updatedAt: 7, matchId: "m7" }),
  ];
  const rows = () =>
    within(document.querySelector("ul.bl") as HTMLElement)
      .getAllByRole("listitem")
      .map((li) => li.querySelector(".op b")?.textContent);

  it("search by name, rival or tag; a tag filter; three sorts (remembered)", () => {
    // (the board on screen is b1: its tags are the ones on screen)
    render(<Harness initial={{ ...L7(), tags: ["Liga"] }} session={{ mine: mine() }} props={{ calendar: [M7, M8] }} />);
    go("Tableros");
    expect(rows()).toEqual(["J8 · MAD SKY", "Atlético B", "Martes"]);
    // each row wears its tags
    expect(document.querySelectorAll("ul.bl .b5e-rt i")).toHaveLength(4);
    const q = screen.getByRole("searchbox", { name: "Buscar tableros" });
    fireEvent.change(q, { target: { value: "rayo" } });
    expect(rows()).toEqual(["Atlético B"]);
    expect(screen.getByText("1 de 3 tableros")).toBeInTheDocument();
    fireEvent.change(q, { target: { value: "atletico" } });
    expect(rows()).toEqual(["Atlético B"]);
    fireEvent.change(q, { target: { value: "nada de nada" } });
    expect(screen.getByText("Ningún tablero coincide")).toBeInTheDocument();
    fireEvent.change(q, { target: { value: "" } });
    const filter = screen.getByRole("group", { name: "Filtrar por etiqueta" });
    fireEvent.click(within(filter).getByRole("button", { name: "Liga" }));
    expect(rows()).toEqual(["J8 · MAD SKY", "Atlético B"]);
    fireEvent.click(within(filter).getByRole("button", { name: "Todas" }));
    const sort = screen.getByRole("group", { name: "Ordenar los tableros" });
    fireEvent.click(within(sort).getByRole("button", { name: "Nombre" }));
    expect(rows()).toEqual(["Atlético B", "J8 · MAD SKY", "Martes"]);
    expect(localStorage.getItem("mp_pizarra_orden")).toBe("nombre");
    fireEvent.click(within(sort).getByRole("button", { name: "Partido" }));
    expect(rows()).toEqual(["J8 · MAD SKY", "Atlético B", "Martes"]);
  });

  it("«Recientes»: the boards opened here last, a tap away (never the one on screen)", () => {
    noteOpened("t1", "b2");
    noteOpened("t1", "b1");
    const open = vi.fn();
    render(<Harness initial={L7()} session={{ mine: mine(), open }} />);
    go("Tableros");
    const strip = screen.getByRole("navigation", { name: "Tableros recientes" });
    expect(within(strip).getAllByRole("button").map((b) => b.textContent)).toEqual(["Martes", "Atlético B"]);
    fireEvent.click(within(strip).getByRole("button", { name: "Abrir Martes" }));
    expect(open).toHaveBeenCalledWith("b2");
  });

  it("the board on screen is remembered as opened on this device", () => {
    render(<Harness initial={L7()} />);
    expect(JSON.parse(localStorage.getItem("mp_pizarra_recientes") ?? "{}")).toEqual({ t1: ["b1"] });
  });
});

describe("Tableros → Partido · capitán rotativo", () => {
  it("suggests who has worn the brazalete least among the seven; one tap gives it to him", () => {
    const commits: Lineup[] = [];
    const officials = [boardDoc("o7", { ...L7(), roles: { captainId: "adrian" } }, { isOfficial: true, matchId: "m7" })];
    render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} session={{ officials }} props={{ calendar: [M7, M8] }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Partido" }));
    const card = screen.getByRole("region", { name: "Capitán rotativo" });
    // adrian wore it in J7; of the others, the best form (huberoski, 95)
    expect(card).toHaveTextContent("Le toca el brazalete a HUBEROSKI");
    expect(card).toHaveTextContent("Del siete, nunca ha llevado el brazalete.");
    expect(within(card).getByText("1 brazalete (J7)")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Darle el brazalete" }));
    expect(commits.at(-1)?.roles.captainId).toBe("huberoski");
    expect(within(screen.getByRole("region", { name: "Capitán rotativo" })).getByRole("button", { name: "Ya lleva el brazalete" })).toBeDisabled();
  });

  it("read-only: the suggestion, but no tap", () => {
    render(<Harness initial={L7()} ro props={{ calendar: [M7, M8] }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Partido" }));
    expect(within(screen.getByRole("region", { name: "Capitán rotativo" })).getByRole("button", { name: "Darle el brazalete" })).toBeDisabled();
  });
});

describe("Pachanga", () => {
  const withVoy = () => squadOf(sq.list.map((c, i) => (i < 8 ? { ...c, cv: "voy" as const } : c)));

  it("key 9 opens it with the ones who said «voy»; two even teams with a keeper each", () => {
    const { container } = render(<Harness initial={L7()} props={{ squad: withVoy() }} />);
    key("9");
    expect(screen.getByRole("region", { name: "Herramientas: Pachanga" })).toBeInTheDocument();
    const ppl = screen.getByRole("list", { name: "Jugadores" });
    // 8 voy, minus brawan (lesionado): 7 picked; andia (sancionado) is not even listed
    expect(within(ppl).getAllByRole("button", { pressed: true })).toHaveLength(7);
    expect(within(ppl).queryByRole("button", { name: /ANDIA/ })).toBeNull();
    const teams = () => container.querySelectorAll(".b5e-team");
    expect(teams()).toHaveLength(2);
    expect(screen.getByRole("region", { name: /^Con peto, media \d+$/ })).toBeInTheDocument();
    expect(screen.getAllByText("· portero")).toHaveLength(2);
    const sizes = Array.from(teams()).map((t) => t.querySelectorAll("li").length);
    expect(sizes.sort()).toEqual([3, 4]);
    // «Otro reparto»: the board's one announcer says it
    fireEvent.click(screen.getByRole("button", { name: "Otro reparto" }));
    expect(live(container)).toMatch(/^Equipos hechos: (3 contra 4|4 contra 3)/);
    // the text for WhatsApp
    const wa = screen.getByRole("link", { name: "Mandar por WhatsApp" });
    expect(wa).toHaveAttribute("target", "_blank");
    expect(decodeURIComponent(wa.getAttribute("href") ?? "")).toContain("CON PETO (media ");
  });

  it("tap who came; too few says how many; three teams; a «separados» pair is honoured", () => {
    render(<Harness initial={L7()} />);
    go("Pachanga");
    fireEvent.click(screen.getByRole("button", { name: "Nadie" }));
    expect(screen.getByText(/hacen falta al menos 4 para 2 equipos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Número de equipos" })).getByRole("button", { name: "3 equipos" }));
    expect(screen.getAllByRole("region", { name: /^(Peto naranja|Peto amarillo|Sin peto), media/ })).toHaveLength(3);
    fireEvent.change(screen.getByRole("combobox", { name: "Primer jugador" }), { target: { value: "adrian" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Juntos o separados" }), { target: { value: "separados" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Segundo jugador" }), { target: { value: "erik" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(screen.getByRole("button", { name: "Quitar: ADRIAN y ERIK separados" })).toBeInTheDocument();
    screen.getAllByRole("region", { name: /media/ }).forEach((t) => expect(!!within(t).queryByText("ADRIAN") && !!within(t).queryByText("ERIK")).toBe(false));
    // remembered on this device
    expect(JSON.parse(localStorage.getItem("mp_pizarra_pachanga") ?? "{}")).toMatchObject({ teams: 3, pairs: [{ a: "adrian", b: "erik", kind: "separados" }] });
  });

  it("«Copiar texto» copies the teams; the image goes to the share sheet", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { container } = render(<Harness initial={L7()} props={{ squad: withVoy() }} />);
    go("Pachanga");
    fireEvent.click(screen.getByRole("button", { name: "Copiar texto" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("SIN PETO (media "));
    await act(async () => {});
    expect(live(container)).toContain("Equipos copiados");
    const img = await screen.findByRole("button", { name: "Imagen" });
    fireEvent.click(img);
    const { shareCartel } = await import("./cartel");
    expect(shareCartel).toHaveBeenCalledWith(expect.any(Blob), "pachanga.png", "Pachanga", expect.stringContaining("Pachanga"));
  });
});

describe("Compartir · imprimir el plan", () => {
  it("puts the A4 sheet on the page, opens the print dialog and takes it away after", () => {
    vi.useFakeTimers();
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<Harness initial={{ ...L7(), roles: { captainId: "adrian" } }} />);
    go("Compartir");
    fireEvent.click(screen.getByRole("button", { name: "Imprimir el plan" }));
    const sheet = screen.getByRole("article", { name: "Plan para imprimir" });
    expect(sheet.parentElement).toBe(document.body);
    expect(within(sheet).getByRole("heading", { level: 1 })).toHaveTextContent("J8 · MAD SKY");
    expect(within(sheet).getByRole("img", { name: /^El siete: EVANS \(POR\)/ })).toBeInTheDocument();
    expect(sheet).toHaveTextContent("ADRIAN (C)");
    expect(sheet).toHaveTextContent("Sin cambios planeados.");
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(print).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(screen.queryByRole("article", { name: "Plan para imprimir" })).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("sin conexión", () => {
  it("the save line says the changes will be saved on the way back, also with nothing pending", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { unmount } = render(<Harness initial={L7()} />);
    expect(screen.getAllByText(OFFLINE_TXT).length).toBeGreaterThan(0);
    unmount();
    onLine.mockReturnValue(true);
    render(<Harness initial={L7()} />);
    expect(screen.queryByText(OFFLINE_TXT)).toBeNull();
    // the connection drops with the page open
    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getAllByText(OFFLINE_TXT).length).toBeGreaterThan(0);
  });
});
