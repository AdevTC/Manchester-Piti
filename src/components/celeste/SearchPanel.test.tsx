import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchEntry } from "../../lib/derived/search";
import { RECENT_KEY } from "../../lib/recentSearches";
import { SearchPanel } from "./SearchPanel";

const ENTRIES: SearchEntry[] = [
  { id: "p:hugo", kind: "jugador", title: "HUGO", detail: "Dorsal 9", exact: ["9"], target: { to: "jugador", playerId: "hugo" } },
  { id: "m:m3", kind: "partido", title: "J3 · Rayo Vallecano", detail: "12 oct · 4-0", exact: ["J3"], target: { to: "partido", matchId: "m3" } },
  { id: "r:rayo", kind: "rival", title: "Rayo Vallecano", detail: "2 partidos", target: { to: "partido", matchId: "m4" } },
  { id: "s:plantilla", kind: "seccion", title: "Plantilla", target: { to: "plantilla" } },
];
const SUGGESTIONS = [ENTRIES[1], { ...ENTRIES[0], detail: "Pichichi · 7 goles" }];

const setup = () => {
  const onGo = vi.fn();
  const onClose = vi.fn();
  render(<SearchPanel entries={ENTRIES} suggestions={SUGGESTIONS} onGo={onGo} onClose={onClose} />);
  const box = screen.getByRole("combobox", { name: /busca jugadores/i });
  return { onGo, onClose, box };
};

afterEach(() => window.localStorage.clear());

describe("SearchPanel", () => {
  it("is a modal dialog whose field (a combobox) has the focus and controls the listbox", () => {
    const { box } = setup();
    expect(screen.getByRole("dialog", { name: "Buscar en la web" })).toHaveAttribute("aria-modal", "true");
    expect(box).toHaveFocus();
    const list = screen.getByRole("listbox");
    expect(box).toHaveAttribute("aria-controls", list.id);
    expect(box).toHaveAttribute("aria-autocomplete", "list");
  });

  it("empty: suggests the next match and the pichichi, each with its kind as a word", () => {
    setup();
    const group = screen.getByRole("group", { name: "Sugerencias" });
    const opts = within(group).getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["PartidoJ3 · Rayo Vallecano12 oct · 4-0", "JugadorHUGOPichichi · 7 goles"]);
  });

  it("↑ ↓ move the active option (aria-activedescendant, aria-selected), wrapping; Enter opens it", () => {
    const { box, onGo } = setup();
    fireEvent.change(box, { target: { value: "rayo" } });
    const opts = screen.getAllByRole("option");
    expect(opts).toHaveLength(2);
    expect(box).toHaveAttribute("aria-activedescendant", opts[0].id);
    expect(opts[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant", opts[1].id);
    expect(opts[1]).toHaveAttribute("aria-selected", "true");
    expect(opts[0]).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant", opts[0].id);
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box).toHaveAttribute("aria-activedescendant", opts[1].id);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onGo).toHaveBeenCalledWith(ENTRIES[1]);
  });

  it("groups results under their kind and says how many there are", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "rayo" } });
    expect(screen.getByRole("group", { name: "Rivales" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Partidos" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 resultados");
  });

  it("with nothing found: no options, a line in words, «Sin resultados»", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "zzzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(box).not.toHaveAttribute("aria-activedescendant");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Ni rastro de «zzzz»/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultados");
  });

  it("Esc closes (asking for the focus back); so does the close button", () => {
    const { box, onClose } = setup();
    fireEvent.keyDown(box, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose.mock.calls[0]).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la búsqueda" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Tab stays inside the dialog", () => {
    const { box } = setup();
    const close = screen.getByRole("button", { name: "Cerrar la búsqueda" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab" });
    expect(box).toHaveFocus();
    fireEvent.keyDown(box, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
  });

  it("a chosen result remembers the search; a recent search refills the field", () => {
    const { box, onGo } = setup();
    fireEvent.change(box, { target: { value: "hug" } });
    fireEvent.click(screen.getByRole("option", { name: /HUGO/ }));
    expect(onGo).toHaveBeenCalledWith(ENTRIES[0]);
    expect(JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]")).toEqual(["hug"]);
  });

  it("lists the recent searches when empty and works when storage throws", () => {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(["rayo"]));
    const { box } = setup();
    const recent = within(screen.getByRole("group", { name: "Búsquedas recientes" })).getByRole("option");
    expect(recent).toHaveTextContent("Recienterayo");
    fireEvent.click(recent);
    expect(box).toHaveValue("rayo");
  });

  it("renders and finds even when localStorage is blocked", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { box, onGo } = setup();
    fireEvent.change(box, { target: { value: "9" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onGo).toHaveBeenCalledWith(ENTRIES[0]);
    get.mockRestore();
    set.mockRestore();
  });
});
