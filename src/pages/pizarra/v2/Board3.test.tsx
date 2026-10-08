import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import { boardDoc, demoSquad, lineupOf, squadOf } from "./testkit";
import { BoardHarness as Harness } from "./testkitBoard";
import { withConvocatoria, type CalMatch } from "./boards";
import { PREFS0, SHOW0 } from "./prefs";
import { chem } from "./quimica";

// Phase 3 as a user drives it: the plan on the pitch, the química panel, Tableros (mine, official,
// partido), Comparar, Compartir, Ajustes and the convocatoria on the cromos — with a fake session.

// No WebGL in tests: the device «is» under automation, so the 3D stadium never starts.
vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));

vi.mock("./cartel", async (orig) => {
  const real = await orig<typeof import("./cartel")>();
  return { ...real, crestImage: async () => null, cartelBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })) };
});

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const OTHER = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "kevin", "erik"];
const L7 = () => lineupOf(SEVEN, "2-3-1", sq);
const m = (o: Partial<CalMatch>): CalMatch => ({ id: "m8", j: 8, rival: "MAD SKY", dateMs: Date.UTC(2026, 10, 8, 10), played: false, gf: null, ga: null, home: true, venue: "", ...o });
const M7 = m({ id: "m7", j: 7, rival: "RAYO", played: true, gf: 3, ga: 1 });
const M8 = m({});

const nav = () => screen.getByRole("navigation", { name: "Modos de la pizarra" });
const go = (name: string) => fireEvent.click(within(nav()).getByRole("button", { name: new RegExp("^(nuevo)?" + name + "$") }));
const root = (c: HTMLElement) => c.querySelector(".pzv") as HTMLElement;
/** The panel's «‹ Más» (the mode bar has its own «Más»). */
const back = () => within(screen.getByRole("region", { name: /^Herramientas/ })).getByRole("button", { name: "Más" });

beforeEach(() => {
  window.history.replaceState(null, "", "/pizarra");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Siete → Plan", () => {
  it("the consignas change the board; the plan is painted and the cromos turn into discs", () => {
    const commits: Lineup[] = [];
    const { container } = render(<Harness initial={L7()} onCommit={(l) => commits.push(l)} />);
    fireEvent.click(screen.getByRole("button", { name: /^Plan/ }));
    expect(root(container)).toHaveClass("t-plan");
    expect(container.querySelectorAll(".cd.mini")).toHaveLength(7);
    expect(container.querySelectorAll(".tarr").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("slider", { name: "Presión" }), { target: { value: "2" } });
    expect(commits.at(-1)?.tactics.press).toBe("Alta");
    fireEvent.change(screen.getByRole("slider", { name: "Línea defensiva" }), { target: { value: "2" } });
    expect(commits.at(-1)?.tactics.defLine).toBe("Alta");
    expect(screen.getByText("Línea alta: la defensa se mueve")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Salida de balón" })).getByRole("button", { name: "En largo" }));
    expect(commits.at(-1)?.tactics.buildup).toBe("En largo");
    expect(within(screen.getByRole("group", { name: "Salida de balón" })).getByRole("button", { name: "En largo" })).toHaveAttribute("aria-pressed", "true");
    // the ritmo is the pulse of the química lights
    fireEvent.change(screen.getByRole("slider", { name: "Ritmo" }), { target: { value: "2" } });
    expect(commits.at(-1)?.tactics.tempo).toBe("Rápido");
    expect((container.querySelector(".lk") as HTMLElement).style.getPropertyValue("--rit")).toBe("1.3s");
    // back to the bench: no plan on the pitch
    fireEvent.click(screen.getByRole("button", { name: "Banquillo" }));
    expect(root(container)).not.toHaveClass("t-plan");
    expect(container.querySelector(".tarr")).toBeNull();
  });

  it("read-only: the plan can be read, not changed", () => {
    render(<Harness initial={L7()} ro />);
    fireEvent.click(screen.getByRole("button", { name: /^Plan/ }));
    expect(screen.getByRole("slider", { name: "Presión" })).toBeDisabled();
    expect(within(screen.getByRole("group", { name: "Foco de ataque" })).getByRole("button", { name: "Centro" })).toBeDisabled();
  });
});

describe("Química", () => {
  it("the number, the tier, the radar, the lines, the lights and the caveats", () => {
    const L = lineupOf(["evans", "adrian", "tello", "huberoski", "eguzquiza", "almachi", "illescas"], "2-3-1", sq);
    const { container } = render(<Harness initial={L} />);
    go("Química");
    expect(screen.getByRole("heading", { name: "Química" })).toBeInTheDocument();
    const v = chem(L, sq).v;
    expect(screen.getByText(v + " de 100")).toBeInTheDocument();
    expect(container.querySelector(".qn")).toHaveStyle({ "--q": String(v) });
    expect(screen.getByRole("img", { name: /^Radar del siete: ataque \d+, defensa \d+, forma \d+, experiencia \d+$/ })).toBeInTheDocument();
    expect(container.querySelectorAll(".lines > div")).toHaveLength(3);
    expect(container.querySelectorAll(".lk-list li").length).toBeGreaterThan(0);
    // nobody has played yet in the demo squad: every one is «sin historial»
    expect(screen.getByText(/Sin historial:/).parentElement).toHaveTextContent("EVANS");
    expect(screen.getByText(/Fuera de posición:/).parentElement).toHaveTextContent("ADRIAN (DEL›DEF)");
    expect(screen.queryByText(/Pocos partidos/)).toBeNull();
    // discs and ++/+/– badges on the pitch
    expect(container.querySelectorAll(".cd.mini")).toHaveLength(7);
    expect(container.querySelectorAll(".lkb").length).toBeGreaterThan(0);
  });

  it("with very few matches the química is only a hint; empty, it says how to light it", () => {
    const few = squadOf(demoSquad().list, [], "J1", 1);
    render(<Harness initial={L7()} props={{ squad: few }} />);
    go("Química");
    expect(screen.getByText(/Pocos partidos:/).parentElement).toHaveTextContent("con 1 jugado");
  });

  it("an empty board: nothing lit yet", () => {
    render(<Harness initial={lineupOf([], "2-3-1", sq)} />);
    go("Química");
    expect(screen.getByText("0 de 100")).toBeInTheDocument();
    expect(screen.getByText("Faltan cromos: la química sube al completar el siete.")).toBeInTheDocument();
    expect(screen.getByText("Sin luces todavía: coloca cromos vecinos y se encienden.")).toBeInTheDocument();
  });
});

describe("Tableros · mis tableros", () => {
  const mine = () => [boardDoc("b1", L7(), { name: "J8 · MAD SKY", updatedAt: 9 }), boardDoc("b2", lineupOf(OTHER, "3-2-1", sq), { name: "Plan B", updatedAt: 5 })];

  it("lists your boards; open, rename (validated), duplicate, new", async () => {
    const open = vi.fn();
    const rename = vi.fn(async () => {});
    const copyBoard = vi.fn(async () => "Plan B (copia)");
    const newBoard = vi.fn(async () => "Tablero nuevo");
    render(<Harness initial={L7()} session={{ mine: mine(), open, rename, copyBoard, newBoard }} />);
    go("Tableros");
    expect(screen.getByRole("heading", { name: "Tableros" })).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByRole("button", { name: /^J8 · MAD SKY/ })).toHaveAttribute("aria-current", "true");
    expect(within(list).getByRole("button", { name: /^Plan B3-2-1 · \d+ de química/ })).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: /^Plan B3-2-1/ }));
    expect(open).toHaveBeenCalledWith("b2");

    const input = screen.getByRole("textbox", { name: "Nombre del tablero" });
    fireEvent.change(input, { target: { value: "plan b" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Ya tienes un tablero con ese nombre");
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(rename).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Mi siete" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(rename).toHaveBeenCalledWith("Mi siete");
    // Escape gives the name back
    fireEvent.change(input, { target: { value: "Otro" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("J8 · MAD SKY");

    fireEvent.click(screen.getByRole("button", { name: "Duplicar Plan B" }));
    expect(copyBoard).toHaveBeenCalledWith("b2", false);
    expect(await screen.findByText("Duplicado: Plan B (copia)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Nuevo$/ }));
    expect(newBoard).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Tablero nuevo: toca un hueco para empezar")).toBeInTheDocument();
  });

  it("a pause while typing saves the name", () => {
    vi.useFakeTimers();
    const rename = vi.fn(async () => {});
    render(<Harness initial={L7()} session={{ mine: mine(), rename }} />);
    go("Tableros");
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre del tablero" }), { target: { value: "Domingo" } });
    expect(rename).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(rename).toHaveBeenCalledWith("Domingo");
  });

  it("delete asks once more, then can be undone from the toast", () => {
    const undo = vi.fn();
    const remove = vi.fn(() => undo);
    render(<Harness initial={L7()} session={{ mine: mine(), remove }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Borrar Plan B" }));
    const ask = screen.getByRole("group", { name: "¿Borrar Plan B?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Cancelar" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Borrar Plan B" }));
    fireEvent.click(within(screen.getByRole("group", { name: "¿Borrar Plan B?" })).getByRole("button", { name: "Borrar" }));
    expect(remove).toHaveBeenCalledWith("b2");
    expect(screen.getByText("«Plan B» borrado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer el borrado de «Plan B»" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.getByText("«Plan B» recuperado")).toBeInTheDocument();
  });

  it("with a single board, nothing to delete; without boards, how the first one is born", () => {
    const { unmount } = render(<Harness initial={L7()} session={{ mine: [boardDoc("b1", L7(), { name: "J8 · MAD SKY" })] }} />);
    go("Tableros");
    expect(screen.getByRole("button", { name: "Borrar J8 · MAD SKY" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /^Borrar$/ })[0]).toBeDisabled();
    unmount();
    render(<Harness initial={lineupOf([], "2-3-1", sq)} session={{ id: null, mine: [], status: "draft" }} />);
    go("Tableros");
    expect(screen.getByText("Aún no tienes tableros esta temporada: el primero se guarda solo con tu primer cambio.")).toBeInTheDocument();
  });
});

describe("Tableros · oficial y partido", () => {
  const off = () => boardDoc("off", lineupOf(OTHER, "3-2-1", sq), { isOfficial: true, ownerUid: "cap", ownerNickname: "capi", name: "Oficial · J8", matchId: "m8" });

  it("a member sees the official: view it, copy it to edit, agree or doubt — but not publish", async () => {
    const open = vi.fn();
    const copyBoard = vi.fn(async () => "Copia del oficial");
    const react = vi.fn(async () => {});
    render(
      <Harness
        initial={L7()}
        session={{ open, copyBoard, officials: [off()] }}
        props={{ official: off(), calendar: [M7, M8], nextMatch: M8, reactions: { enabled: true, ok: 9, dudas: 2, mine: "ok", react } }}
      />,
    );
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    expect(screen.getByText("Oficial · J8")).toBeInTheDocument();
    expect(screen.getByText("Por @capi · este partido (J8 · MAD SKY)")).toBeInTheDocument();
    expect(screen.getByText("Solo los capitanes y los admins publican el oficial.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publicar/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver el oficial" }));
    expect(open).toHaveBeenCalledWith("off");
    fireEvent.click(screen.getByRole("button", { name: "Duplicar para editar" }));
    expect(copyBoard).toHaveBeenCalledWith("off", true);
    expect(await screen.findByText("Copia creada: ya puedes editar")).toBeInTheDocument();
    const reac = screen.getByRole("group", { name: "¿De acuerdo con el siete oficial?" });
    // tapping the reaction you gave takes it back
    fireEvent.click(within(reac).getByRole("button", { name: "De acuerdo 9" }));
    expect(react).toHaveBeenLastCalledWith(null);
    fireEvent.click(within(reac).getByRole("button", { name: "Con dudas 2" }));
    expect(react).toHaveBeenLastCalledWith("dudas");
  });

  it("looking at the official (read-only): back to your board", () => {
    const openMine = vi.fn();
    render(<Harness initial={lineupOf(OTHER, "3-2-1", sq)} ro session={{ id: "off", openMine, officials: [off()] }} props={{ official: off(), calendar: [M8] }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    const back = screen.getByRole("button", { name: "Volver a mi tablero" });
    expect(back).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(back);
    expect(openMine).toHaveBeenCalledTimes(1);
  });

  it("a captain publishes the board for this match or the season, and takes the official down", async () => {
    const publish = vi.fn(async () => {});
    const unpublish = vi.fn(async () => {});
    const { unmount } = render(<Harness initial={L7()} session={{ publish, unpublish }} props={{ isAdmin: true, calendar: [M8], nextMatch: M8 }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    expect(screen.getByText("Aún no hay siete oficial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Este partido" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Publicar mi tablero como oficial" }));
    expect(publish).toHaveBeenLastCalledWith("m8");
    expect(await screen.findByText("Publicado como oficial · este partido")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "La temporada" }));
    fireEvent.click(screen.getByRole("button", { name: "Publicar mi tablero como oficial" }));
    expect(publish).toHaveBeenLastCalledWith(null);
    unmount();
    // the board on screen is the official already
    render(<Harness initial={L7()} session={{ official: true, matchId: "m8", publish, unpublish }} props={{ isAdmin: true, calendar: [M8], nextMatch: M8, official: boardDoc("b1", L7(), { isOfficial: true, matchId: "m8" }) }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    expect(screen.getByRole("button", { name: "Ya es el oficial" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Quitar el oficial" }));
    expect(unpublish).toHaveBeenCalledWith("b1");
  });

  it("only a whole seven with a goalkeeper can be the official; warnings are asked first", () => {
    const publish = vi.fn(async () => {});
    const caps = { isAdmin: true, calendar: [M8], nextMatch: M8 };
    const { unmount } = render(<Harness initial={lineupOf([], "2-3-1", sq)} session={{ publish }} props={caps} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    expect(screen.getByRole("button", { name: "Publicar mi tablero como oficial" })).toBeDisabled();
    expect(screen.getByText("Completa el siete para publicarlo (0/7).")).toBeInTheDocument();
    unmount();
    // seven, but a forward in goal
    const noGk = render(<Harness initial={lineupOf(["adrian", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "erik"], "2-3-1", sq)} session={{ publish }} props={caps} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    expect(screen.getByRole("button", { name: "Publicar mi tablero como oficial" })).toBeDisabled();
    expect(screen.getByText("Pon un portero en la portería para publicarlo.")).toBeInTheDocument();
    noGk.unmount();
    // a whole seven, but one said no and one plays out of position
    const conv = withConvocatoria(sq, new Map([["tello", "no"]]));
    const L = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "kevin"], "2-3-1", sq);
    const warned = render(<Harness initial={{ ...L, slots: L.slots.map((x, i) => (i === 5 ? { ...x, playerId: "erik" } : x)) }} session={{ publish }} props={{ ...caps, squad: conv }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    fireEvent.click(screen.getByRole("button", { name: "Publicar mi tablero como oficial" }));
    const ask = screen.getByRole("group", { name: "¿Publicar con avisos?" });
    expect(ask).toHaveTextContent("TELLO no va");
    expect(ask).toHaveTextContent("ERIK (DEL›MED) fuera de posición");
    fireEvent.click(within(ask).getByRole("button", { name: "Cancelar" }));
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Publicar mi tablero como oficial" }));
    fireEvent.click(within(screen.getByRole("group", { name: "¿Publicar con avisos?" })).getByRole("button", { name: "Publicar igualmente" }));
    expect(publish).toHaveBeenCalledWith("m8");
    warned.unmount();
    // switching the alcance of the official on screen asks the same
    render(<Harness initial={{ ...L, slots: L.slots.map((x, i) => (i === 5 ? { ...x, playerId: "erik" } : x)) }} session={{ official: true, matchId: "m8", publish }} props={{ ...caps, squad: conv }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    fireEvent.click(screen.getByRole("button", { name: "La temporada" }));
    fireEvent.click(screen.getByRole("button", { name: "Cambiar el alcance" }));
    expect(screen.getByRole("group", { name: "¿Publicar con avisos?" })).toBeInTheDocument();
  });

  it("without a match to play, the official can only be for the season", () => {
    render(<Harness initial={L7()} props={{ isAdmin: true }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Oficial" }));
    expect(screen.getByRole("button", { name: "Este partido" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "La temporada" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Partido: link a match (with its result band) or unlink it", async () => {
    const linkMatch = vi.fn(async () => {});
    render(<Harness initial={L7()} session={{ matchId: "m7", linkMatch }} props={{ calendar: [M7, M8], nextMatch: M8 }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Partido" }));
    const sel = screen.getByRole("combobox", { name: "Vincular a un partido" });
    expect(sel).toHaveValue("m7");
    expect(within(sel).getAllByRole("option").map((o) => o.textContent)).toEqual(["Sin partido", "J7 · RAYO · 3–1", "J8 · MAD SKY"]);
    expect(screen.getByText("V")).toHaveClass("res", "g");
    expect(screen.getByText("Victoria · 3–1 · RAYO")).toBeInTheDocument();
    fireEvent.change(sel, { target: { value: "m8" } });
    expect(linkMatch).toHaveBeenLastCalledWith("m8");
    expect(await screen.findByText("Vinculado a J8 · MAD SKY")).toBeInTheDocument();
    fireEvent.change(sel, { target: { value: "" } });
    expect(linkMatch).toHaveBeenLastCalledWith(null);
  });

  it("a failed action says why (apiError)", async () => {
    const linkMatch = vi.fn(async () => {
      throw Object.assign(new Error("x"), { code: "permission-denied" });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness initial={L7()} session={{ linkMatch }} props={{ calendar: [M8] }} />);
    go("Tableros");
    fireEvent.click(screen.getByRole("button", { name: "Partido" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Vincular a un partido" }), { target: { value: "m8" } });
    expect(await screen.findByText(/No se ha podido guardar: puede que/)).toBeInTheDocument();
  });
});

describe("Comparar", () => {
  it("another board face to face: the tape, who changes, and the differences on the pitch", () => {
    const b2 = boardDoc("b2", lineupOf(OTHER, "3-2-1", sq), { name: "Plan B" });
    const { container } = render(<Harness initial={L7()} session={{ mine: [boardDoc("b1", L7()), b2] }} />);
    go("Comparar");
    expect(screen.getByRole("combobox", { name: "Tablero con el que comparar" })).toHaveValue("b2");
    expect(container.querySelector(".tape .hd")).toHaveTextContent("J8 · MAD SKYvsPlan B");
    const tapeEl = container.querySelector(".tape") as HTMLElement;
    expect(within(tapeEl).getByText("Química")).toBeInTheDocument();
    expect(within(tapeEl).getByText("3-2-1")).toBeInTheDocument();
    expect(within(container.querySelector(".chg .in") as HTMLElement).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["KEVIN", "ERIK"]);
    expect(within(container.querySelector(".chg .out") as HTMLElement).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["ALMACHI", "ADRIAN"]);
    expect(container.querySelectorAll(".cmpg")).toHaveLength(4);
    expect(container.querySelectorAll(".cmpg.out")).toHaveLength(2);
    expect(container.querySelectorAll(".cd.mini")).toHaveLength(7);
    expect(screen.getByText("En el campo: oro discontinuo = entra, rojo = sale.")).toBeInTheDocument();
    // leaving Comparar clears the marks
    fireEvent.click(back());
    expect(container.querySelector(".cmpg")).toBeNull();
  });

  it("the official is there too; the same seven only move; nothing to compare with", () => {
    const off = boardDoc("off", lineupOf(SEVEN, "3-2-1", sq), { isOfficial: true, name: "J8 del capi" });
    const { unmount } = render(<Harness initial={L7()} session={{ officials: [off] }} />);
    go("Comparar");
    expect(within(screen.getByRole("combobox", { name: "Tablero con el que comparar" })).getByRole("option")).toHaveTextContent("Oficial · J8 del capi");
    expect(screen.getByText("Los mismos siete: solo cambia la colocación.")).toBeInTheDocument();
    unmount();
    render(<Harness initial={L7()} />);
    go("Comparar");
    expect(screen.getByText(/No hay otro tablero con el que comparar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir a Tableros" }));
    expect(screen.getByRole("heading", { name: "Tableros" })).toBeInTheDocument();
  });
});

describe("Compartir", () => {
  it("the cartel's preview, the share sheet with the PNG, and the link to the board", async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share, canShare: () => true, clipboard: { writeText: vi.fn(async () => {}) } });
    render(<Harness initial={L7()} />);
    go("Compartir");
    const poster = screen.getByRole("img", { name: /^Cartel: los siete de J8 · MAD SKY, 2-3-1, química \d+/ });
    expect(poster.querySelectorAll(".po-d")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Mandar al grupo" }));
    expect(await screen.findByText("Cartel listo para el grupo")).toBeInTheDocument();
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "Los siete · J8 · MAD SKY", files: [expect.any(File)] }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace al tablero" }));
    expect(await screen.findByText("Enlace copiado: pégalo en el grupo")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.origin + "/pizarra?tablero=b1");
    // and the one the captain sends before the match: straight to the charla
    fireEvent.click(screen.getByRole("button", { name: "Copiar el enlace que abre la charla de este tablero" }));
    expect(await screen.findByText("Enlace a la charla copiado: pégalo en el grupo")).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(window.location.origin + "/pizarra?tablero=b1#charla");
    Object.assign(navigator, { share: undefined, canShare: undefined });
  });

  it("with fewer than seven the cartel waits and says why; the link is still there", () => {
    render(<Harness initial={lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza"], "2-3-1", sq)} />);
    go("Compartir");
    expect(screen.getByRole("button", { name: "Mandar al grupo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descargar el cartel en PNG" })).toBeDisabled();
    expect(screen.getByText("Completa el siete para compartir (5/7).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mandar al grupo" })).toHaveAccessibleDescription("Completa el siete para compartir (5/7).");
    expect(screen.getByRole("button", { name: "Copiar enlace al tablero" })).toBeEnabled();
  });

  it("without the share sheet the PNG is downloaded; a draft has no link yet", async () => {
    Object.assign(navigator, { share: undefined, canShare: undefined });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    render(<Harness initial={L7()} session={{ id: null, status: "draft" }} />);
    go("Compartir");
    fireEvent.click(screen.getByRole("button", { name: "Mandar al grupo" }));
    expect(await screen.findByText("Cartel descargado: mándalo al grupo")).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Descargar el cartel en PNG" }));
    expect(await screen.findByText("Cartel guardado como PNG")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar enlace al tablero" })).toBeDisabled();
  });
});

describe("Ajustes", () => {
  it("what the cromos show, the camera, sound, day, grid and the season", () => {
    const onPrefs = vi.fn();
    const toggle = vi.fn();
    const onSeason = vi.fn();
    const { container, unmount } = render(<Harness initial={L7()} props={{ onPrefs, theme: { day: false, toggle }, onSeason, seasons: [{ id: "t1", name: "Temporada 1" }, { id: "t0", name: "Temporada 0" }] }} />);
    go("Ajustes");
    fireEvent.click(screen.getByRole("button", { name: "Dorsal" }));
    expect(onPrefs).toHaveBeenLastCalledWith({ show: { ...SHOW0, num: false } });
    fireEvent.click(screen.getByRole("button", { name: "Nota" }));
    expect(onPrefs).toHaveBeenLastCalledWith({ show: { ...SHOW0, rt: false } });
    fireEvent.click(screen.getByRole("button", { name: "Cenital" }));
    expect(onPrefs).toHaveBeenLastCalledWith({ cam: "top" });
    fireEvent.click(screen.getByRole("button", { name: "Sonido" }));
    expect(onPrefs).toHaveBeenLastCalledWith({ snd: true });
    fireEvent.click(screen.getByRole("button", { name: "Rejilla en libre" }));
    expect(onPrefs).toHaveBeenLastCalledWith({ grid: false });
    fireEvent.click(screen.getByRole("button", { name: "Partido de día" }));
    expect(toggle).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Temporada de los datos" }), { target: { value: "t0" } });
    expect(onSeason).toHaveBeenCalledWith("t0");
    expect(root(container).className).not.toMatch(/h-num/);
    unmount();
    const prefs = { ...PREFS0, cam: "top" as const, show: { ...SHOW0, num: false, rt: false, chem: true } };
    const r = render(<Harness initial={L7()} props={{ prefs }} />);
    expect(root(r.container)).toHaveClass("h-num", "h-rt", "s-chem");
    expect(r.container.querySelector(".pfr.top")).not.toBeNull();
  });
});

describe("La convocatoria en el tablero", () => {
  const conv = withConvocatoria(sq, new Map([["tello", "no"], ["kevin", "duda"], ["erik", "voy"]]));

  it("NO VA on the pitch, the 7/7 warning, the chips on the bench and «Solo convocados»", () => {
    const { container } = render(<Harness initial={L7()} props={{ squad: conv, conv: { match: M8, loading: false, error: false } }} />);
    expect(container.querySelector('.cd[data-tok="tello"] .cc-no')).toHaveTextContent("NO VA");
    expect(screen.getByText("1 aviso")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /TELLO dijo que no va/ })).toBeInTheDocument();
    expect(screen.getByText("Convocatoria J8 · MAD SKY: 1 voy · 1 duda · 1 no va · 9 sin responder")).toBeInTheDocument();
    const rail = screen.getByRole("group", { name: /^Banquillo/ });
    expect(within(rail).getByRole("button", { name: /^KEVIN.*convocatoria: duda/ })).toBeInTheDocument();
    const oc = screen.getByRole("button", { name: /Solo convocados/ });
    expect(oc).toBeEnabled();
    fireEvent.click(oc);
    const names = within(rail)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((l) => /, dorsal /.test(l));
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^ERIK/);
  });

  it("«Sugerir siete» leaves out who said no", () => {
    const commits: Lineup[] = [];
    render(<Harness initial={lineupOf([], "2-3-1", sq)} onCommit={(l) => commits.push(l)} props={{ squad: conv, conv: { match: M8, loading: false, error: false } }} />);
    fireEvent.click(screen.getByRole("button", { name: /Sugerir siete/ }));
    expect(commits.at(-1)?.slots.map((s) => s.playerId)).not.toContain("tello");
  });

  it("no answers yet, no match, or answers that can't be read", () => {
    const { unmount } = render(<Harness initial={L7()} props={{ conv: { match: M8, loading: false, error: false } }} />);
    expect(screen.getByRole("button", { name: /Solo convocados/ })).toBeDisabled();
    expect(screen.getByText("Nadie ha respondido aún a la convocatoria de J8 · MAD SKY.")).toBeInTheDocument();
    unmount();
    const r2 = render(<Harness initial={L7()} />);
    expect(screen.getByText("Sin partido a la vista: sin convocatoria.")).toBeInTheDocument();
    r2.unmount();
    render(<Harness initial={L7()} props={{ conv: { match: M8, loading: false, error: true } }} />);
    expect(screen.getByText("No se ha podido leer la convocatoria de J8 · MAD SKY.")).toBeInTheDocument();
  });
});

describe("enlaces y avisos", () => {
  it("#comparar opens Comparar; a notice from the session is said", async () => {
    window.history.replaceState(null, "", "/pizarra#comparar");
    const { rerender } = render(<Harness initial={L7()} />);
    expect(screen.getByRole("heading", { name: "Comparar" })).toBeInTheDocument();
    rerender(<Harness initial={L7()} session={{ notice: { n: 1, msg: "Hay un oficial nuevo: «X»" } }} />);
    expect(await screen.findByText("Hay un oficial nuevo: «X»")).toBeInTheDocument();
  });

  it("the URL hash wins on load and a new hash switches the panel", () => {
    window.history.replaceState(null, "", "/pizarra#plan");
    render(<Harness initial={L7()} />);
    expect(screen.getByRole("slider", { name: "Presión" })).toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, "", "/pizarra#tableros");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("heading", { name: "Tableros" })).toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, "", "/pizarra#plan");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("slider", { name: "Presión" })).toBeInTheDocument();
    // a hash that names no panel leaves the board as it is
    act(() => {
      window.history.replaceState(null, "", "/pizarra#nada");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("slider", { name: "Presión" })).toBeInTheDocument();
    // fútbol 7: the mode is «Siete»
    expect(within(nav()).getByRole("button", { name: "Siete" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Más leads to every panel", () => {
    render(<Harness initial={L7()} />);
    go("Más");
    for (const [tile, heading] of [
      ["Tableros", "Tableros"],
      ["Comparar", "Comparar"],
      ["Compartir", "Compartir"],
      ["Ajustes", "Ajustes"],
    ]) {
      fireEvent.click(within(screen.getByRole("region", { name: "Herramientas: Más" })).getByRole("button", { name: new RegExp("^" + tile) }));
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      fireEvent.click(back());
    }
    fireEvent.click(screen.getByRole("button", { name: /^El plan/ }));
    expect(screen.getByRole("slider", { name: "Presión" })).toBeInTheDocument();
  });
});
