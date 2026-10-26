import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RECENT_KEY } from "../../lib/recentSearches";
import { SearchPanel } from "./SearchPanel";
import { buildEntries, type SrGame, type SrPlayer } from "./searchModel";

const PLAYERS: SrPlayer[] = [
  { id: "alcides", name: "Alcides", num: "9", pos: "Punta", full: "Alcides Ramos", shirt: "ALCIDES", line: "48′ en la J1." },
  { id: "kevin", name: "Kevin", num: "11", pos: "Extremo derecho", full: "Kevin Pérez", shirt: "KEVIN", line: "30′ en la J1." },
];
const GAMES: SrGame[] = [
  { id: "m1", j: 1, rival: "Orduña fc", res: "P", score: "1–8", live: false, home: true, when: "domingo 18 oct, 19:00", scorers: "Alcides (43′)", goals: 1, changes: 23, marks: [{ m: 43, k: "us", left: 86 }, { m: 10, k: "them", left: 20 }] },
  { id: "m2", j: 2, rival: "Pitutis", res: null, score: "0–0", live: false, home: false, when: "domingo 25 oct, 14:00", scorers: "", goals: 0, changes: 0, marks: [] },
];
const ENTRIES = buildEntries({ viewer: { kind: "jugador", captain: false }, dia: false, players: PLAYERS, games: GAMES, next: { j: 2 }, vote: null });

const setup = (initial?: { q: string; scope: "todo" }) => {
  const onChoose = vi.fn();
  const onClose = vi.fn();
  const onState = vi.fn();
  render(<SearchPanel entries={ENTRIES} viewer="jugador" onChoose={onChoose} onClose={onClose} onState={onState} initial={initial} />);
  const box = screen.getByRole("combobox", { name: /busca jugadores/i });
  return { onChoose, onClose, onState, box };
};
const pressed = () => screen.getAllByRole("button", { pressed: true }).map((b) => b.firstChild?.textContent);

afterEach(() => window.localStorage.clear());

describe("SearchPanel (TU boards, tu-sr)", () => {
  it("is a modal dialog in the boards' layer, its field a combobox with the focus", () => {
    const { box } = setup();
    const dialog = screen.getByRole("dialog", { name: "Buscar en la web" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveClass("tu-sr");
    expect(dialog.closest(".tu.tu-ovl")).toHaveClass("o-buscar");
    expect(box).toHaveFocus();
    expect(box).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  });

  it("empty: «Lo próximo», four «Acciones» with «N más», the recents and the prefixes' tip", () => {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(["orduña", "11"]));
    setup();
    expect(within(screen.getByRole("group", { name: "Lo próximo" })).getByRole("option")).toHaveTextContent("J2 · Pitutis");
    const acts = screen.getByRole("group", { name: "Acciones" });
    expect(within(acts).getAllByRole("option")).toHaveLength(4);
    fireEvent.click(within(acts).getByRole("button", { name: /^Ver \d+ más en Acciones$/ }));
    expect(within(screen.getByRole("group", { name: "Acciones" })).getAllByRole("option").length).toBeGreaterThan(4);
    expect(screen.getByRole("button", { name: "orduña" })).toBeInTheDocument();
    expect(screen.getByText(/jugadores · /)).toBeInTheDocument();
  });

  it("«or»: «Mejor resultado» the rival (initials in coral), its match with its letter; counts on the scopes", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "or" } });
    const best = within(screen.getByRole("group", { name: "Mejor resultado" })).getByRole("option");
    expect(best).toHaveTextContent("Orduña fc");
    expect(best.querySelector(".tu-sr__rv")).toHaveTextContent("O");
    const match = within(screen.getByRole("group", { name: "Partidos" })).getByRole("option");
    expect(match.querySelector(".tu-res.is-P")).toHaveTextContent("P");
    expect(screen.getByRole("button", { name: /^Partidos/ })).toHaveTextContent("Partidos2");
    expect(screen.getByRole("status")).toHaveTextContent("2 resultados");
    // the preview: the rival's initials, its record and its meetings, its address and «Ver los partidos»
    const pv = screen.getByRole("complementary", { name: "Vista previa" });
    expect(pv).toHaveTextContent("1 derrota.");
    expect(pv).toHaveTextContent("/estadisticas/rivales?rival=orduna-fc");
    expect(within(pv).getByRole("button", { name: "Ver los partidos" })).toBeInTheDocument();
  });

  it("↑ ↓ move the active result (aria-activedescendant), the preview follows; Intro chooses and remembers", () => {
    const { box, onChoose } = setup();
    fireEvent.change(box, { target: { value: "or" } });
    const opts = screen.getAllByRole("option");
    expect(box).toHaveAttribute("aria-activedescendant", opts[0].id);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(opts[1]).toHaveAttribute("aria-selected", "true");
    const pv = screen.getByRole("complementary", { name: "Vista previa" });
    expect(pv.querySelector(".tu-sr__score")).toHaveTextContent("1–8Perdimos");
    expect(pv.querySelectorAll(".tu-tl i")).toHaveLength(2);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(opts[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: "r:Orduña fc" }));
    expect(JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]")).toEqual(["or"]);
  });

  it("Tab cycles where to search; the chip in the field drops it; Backspace on an empty field too", () => {
    const { box } = setup();
    expect(pressed()).toEqual(["Todo"]);
    fireEvent.keyDown(box, { key: "Tab" });
    expect(pressed()).toEqual(["Jugadores"]);
    expect(box).toHaveAttribute("placeholder", "Busca en jugadores");
    expect(screen.getAllByRole("option").map((o) => o.querySelector("b")?.textContent)).toEqual(["Alcides", "Kevin"]);
    fireEvent.keyDown(box, { key: "Tab", shiftKey: true });
    fireEvent.keyDown(box, { key: "Tab", shiftKey: true });
    expect(pressed()).toEqual(["Acciones"]);
    fireEvent.click(screen.getByRole("button", { name: "Quitar el filtro Acciones" }));
    expect(pressed()).toEqual(["Todo"]);
    fireEvent.keyDown(box, { key: "Tab" });
    fireEvent.keyDown(box, { key: "Backspace" });
    expect(pressed()).toEqual(["Todo"]);
  });

  it("a prefix sets the scope: @ players", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "@ke" } });
    expect(pressed()).toEqual(["Jugadores"]);
    expect(screen.getAllByRole("option").map((o) => o.querySelector("b")?.textContent)).toEqual(["Kevin"]);
  });

  it("Esc empties the field, then drops the scope, then closes", () => {
    const { box, onClose } = setup();
    fireEvent.keyDown(box, { key: "Tab" });
    fireEvent.change(box, { target: { value: "ke" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box).toHaveValue("");
    expect(pressed()).toEqual(["Jugadores"]);
    fireEvent.keyDown(box, { key: "Escape" });
    expect(pressed()).toEqual(["Todo"]);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la búsqueda" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("nothing found: the words and «¿Querías decir…?», which fills the field", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "kez" } });
    expect(screen.getByText("Nada con «kez».")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kevin" }));
    expect(box).toHaveValue("Kevin");
  });

  it("the recents: one refills the field, each one goes with its ×, «Borrar» clears them", () => {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(["orduña", "calendario", "11"]));
    const { box } = setup();
    fireEvent.click(screen.getByRole("button", { name: "11" }));
    expect(box).toHaveValue("11");
    fireEvent.change(box, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Quitar «calendario» de las recientes" }));
    expect(screen.queryByRole("button", { name: "calendario" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]")).toEqual(["orduña", "11"]);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(screen.queryByText("Búsquedas recientes")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "null")).toEqual([]);
  });

  it("starts where it is told and reports every change (the address keeps ?q=)", () => {
    const { box, onState } = setup({ q: "kevin", scope: "todo" });
    expect(box).toHaveValue("kevin");
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Kevin");
    fireEvent.change(box, { target: { value: "kev" } });
    expect(onState).toHaveBeenLastCalledWith({ q: "kev", scope: "todo" });
  });

  it("works when storage is blocked", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { box, onChoose } = setup();
    fireEvent.change(box, { target: { value: "11" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: "j:kevin" }));
    get.mockRestore();
    set.mockRestore();
  });
});
