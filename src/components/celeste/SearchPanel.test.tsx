import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RECENT_KEY } from "../../lib/recentSearches";
import { SearchPanel } from "./SearchPanel";
import { actionEntries, groupResults, teamEntries, type PanelEntry } from "./searchModel";

const NOW: PanelEntry[] = [
  { id: "now:j1", kind: "ahora", title: "Piti 2–1 Orduña fc", detail: "En directo. Abrir el partido", live: true, icon: "ball", target: { to: "partido", matchId: "j1" } },
  { id: "now:pip", kind: "ahora", title: "Sacar el marcador", detail: "A una ventana que flota encima de todo", icon: "pip", target: { to: "pip" } },
];
const PLAYERS: PanelEntry[] = ["Alcides", "Almachi", "Alberto", "Alfonso", "Alonso"].map((t, i) => ({ id: `p:${i}`, kind: "jugador", title: t, detail: `Dorsal ${i + 7}`, shirt: String(i + 7), exact: [String(i + 7)], target: { to: "jugador", playerId: `p${i}` } }));
const ENTRIES: PanelEntry[] = [
  ...NOW,
  ...PLAYERS,
  { id: "m:m3", kind: "partido", title: "J3 · Rayo Vallecano", detail: "12 oct · 4-0", exact: ["J3"], icon: "fixtures", target: { to: "partido", matchId: "m3" } },
  { id: "r:rayo", kind: "rival", title: "Rayo Vallecano", detail: "2 partidos", icon: "chart", target: { to: "partido", matchId: "m4" } },
  { id: "s:plantilla", kind: "seccion", title: "Plantilla", icon: "arrow", target: { to: "plantilla" } },
  ...actionEntries({ jugador: true, member: true, rsvp: null, vote: null, feed: "webcal://x/calendario.ics" }),
];

const setup = () => {
  const onGo = vi.fn();
  const onClose = vi.fn();
  render(<SearchPanel entries={ENTRIES} onGo={onGo} onClose={onClose} />);
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

  it("empty: «Ahora» first (the match of the moment and «Sacar el marcador»), then «Acciones»", () => {
    setup();
    const groups = screen.getAllByRole("group").map((g) => g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby") ?? "")?.textContent);
    expect(groups).toEqual(["Ahora", "Acciones"]);
    const now = within(screen.getByRole("group", { name: "Ahora" })).getAllByRole("option");
    expect(now[0]).toHaveTextContent("Piti 2–1 Orduña fc");
    expect(now[1]).toHaveTextContent("Sacar el marcador");
  });

  it("«Ahora» stays first whatever is typed; three per group with «N más»; the footer counts them all and grows", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "al" } });
    expect(screen.getByRole("group", { name: "Ahora" })).toBeInTheDocument();
    const players = screen.getByRole("group", { name: "Jugadores" });
    expect(within(players).getAllByRole("option")).toHaveLength(3);
    expect(within(players).getAllByRole("option")[0]).toHaveTextContent("Alcides");
    const total = screen.getByRole("status").textContent ?? "";
    expect(total).toMatch(/^\d+ resultados$/);
    fireEvent.click(screen.getByRole("button", { name: `Ver los ${total.split(" ")[0]} resultados` }));
    expect(screen.getByRole("dialog")).toHaveClass("is-all");
    expect(within(screen.getByRole("group", { name: "Jugadores" })).getAllByRole("option")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Ver menos" }));
    expect(screen.getByRole("dialog")).not.toHaveClass("is-all");
    fireEvent.click(screen.getByRole("button", { name: "Ver 2 más en Jugadores" }));
    expect(within(screen.getByRole("group", { name: "Jugadores" })).getAllByRole("option")).toHaveLength(5);
  });

  it("↑ ↓ move the active option (aria-activedescendant, aria-selected), wrapping; Intro opens it", () => {
    const { box, onGo } = setup();
    fireEvent.change(box, { target: { value: "rayo" } });
    const opts = screen.getAllByRole("option");
    // Ahora (2), Jornadas, Equipos
    expect(opts).toHaveLength(4);
    expect(box).toHaveAttribute("aria-activedescendant", opts[0].id);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(opts[2]).toHaveAttribute("aria-selected", "true");
    expect(opts[0]).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(box, { key: "ArrowUp" });
    fireEvent.keyDown(box, { key: "ArrowUp" });
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box).toHaveAttribute("aria-activedescendant", opts[3].id);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onGo).toHaveBeenCalledWith(expect.objectContaining({ id: "r:rayo" }));
  });

  it("the boards' groups: «Jornadas», «Equipos»; the players with their shirt", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "rayo" } });
    expect(screen.getByRole("group", { name: "Jornadas" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Equipos" })).toBeInTheDocument();
    fireEvent.change(box, { target: { value: "7" } });
    expect(document.querySelector(".vd-sr__shirt")).toHaveTextContent("7");
  });

  it("with nothing found but «Ahora»: a line in words", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "zzzz" } });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText(/Nada con «zzzz»/)).toBeInTheDocument();
  });

  it("Esc empties the field first, then closes (asking for the focus back); so does the Esc button", () => {
    const { box, onClose } = setup();
    fireEvent.change(box, { target: { value: "al" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box).toHaveValue("");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose.mock.calls[0]).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la búsqueda" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Tab stays inside the dialog", () => {
    const { box } = setup();
    const close = screen.getByRole("button", { name: "Cerrar la búsqueda" });
    const items = [...screen.getByRole("dialog").querySelectorAll<HTMLElement>("input,button:not([disabled])")];
    const last = items[items.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(box).toHaveFocus();
    fireEvent.keyDown(box, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    expect(close).toBeInTheDocument();
  });

  it("a chosen result remembers the search; a recent search refills the field", () => {
    const { box, onGo } = setup();
    fireEvent.change(box, { target: { value: "alc" } });
    fireEvent.click(screen.getByRole("option", { name: /Alcides/ }));
    expect(onGo).toHaveBeenCalledWith(PLAYERS[0]);
    expect(JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]")).toEqual(["alc"]);
  });

  it("lists the recent searches when empty and works when storage throws", () => {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(["rayo"]));
    const { box } = setup();
    const recent = within(screen.getByRole("group", { name: "Búsquedas recientes" })).getByRole("option");
    expect(recent).toHaveTextContent("rayo");
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
    fireEvent.change(box, { target: { value: "7" } });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onGo).toHaveBeenCalledWith(PLAYERS[0]);
    get.mockRestore();
    set.mockRestore();
  });
});

describe("searchModel", () => {
  it("every league team is findable once (our rivals already are)", () => {
    const rows = [{ team: "Manchester Piti", isUs: true }, { team: "Rayo Vallecano" }, { team: "Pitutis" }];
    expect(teamEntries(rows, ENTRIES).map((e) => e.title)).toEqual(["Pitutis"]);
  });
  it("actions by who is looking: a fan only the calendar and the shirt", () => {
    expect(actionEntries({ jugador: false, member: false, rsvp: null, vote: null, feed: "webcal://x" }).map((e) => e.title)).toEqual(["Al calendario", "Ponte la del Piti"]);
    expect(actionEntries({ jugador: false, member: true, rsvp: null, vote: null, feed: null }).map((e) => e.title)).toEqual(["Votar al MVP", "Hacer la porra", "Ponte la del Piti"]);
  });
  it("groups in the boards' order, «Ahora» always", () => {
    expect(groupResults(ENTRIES, "plantilla").map((g) => g.title)).toEqual(["Ahora", "Páginas"]);
  });
});
