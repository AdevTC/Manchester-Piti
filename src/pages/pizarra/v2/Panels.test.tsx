import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { systemDef } from "../../../lib/formations";
import { lineOf, type PosCode, type ResolvedPositions } from "../../../lib/positions";
import type { FormationName } from "../formations";
import { BenchTab, OnceTabs, SquadBars, SystemTab, type BenchTabProps } from "./Panels";
import { PanelHead } from "./SheetPanels";
import { benchGroups, convHead, squadInfo } from "./bench";
import { encajeBySystem } from "./encaje";
import { SYSTEMS } from "./geometry";
import type { Squad } from "./model";
import { chem } from "./quimica";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";

// The «Siete» tool's pieces on their own: the squad bars, the tabs with their keys, the Convocatoria page
// (rows or cromos), the Sistema tiles, and the panels' heading.

const sq = demoSquad();
const L = lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);
const ch = chem(L, sq);
const bench = sq.list.filter((c) => !L.slots.some((s) => s.playerId === c.id));

function benchProps(over: Partial<BenchTabProps> = {}): BenchTabProps {
  return {
    ro: false,
    hot: false,
    recentLabel: "J5–J7",
    conv: convHead({ sq, match: null, loading: false, error: false }),
    groups: benchGroups({ bench, called: null, filter: { on: false, q: "", zf: "Todos", oc: false }, hand: null, selId: null, meId: null }),
    srx: false,
    q: "",
    zf: "Todos",
    oc: false,
    ocOff: true,
    seasons: [{ id: "t1", name: "Temporada 1" }],
    seasonId: "t1",
    onSuggest: vi.fn(),
    onAuto: vi.fn(),
    onAvisar: vi.fn(),
    onSrx: vi.fn(),
    onTapBench: vi.fn(),
    onQ: vi.fn(),
    onZf: vi.fn(),
    onOc: vi.fn(),
    onSeason: vi.fn(),
    ...over,
  };
}

describe("«Siete»", () => {
  it("the squad bars: media, química with its diamonds, the seven on the pitch and the four axes", () => {
    const { container } = render(<SquadBars info={squadInfo(L, sq, ch)} sysName="2-3-1" matchShort="J8 · MAD SKY" qv={ch.v} qTier="Muy alta" />);
    expect(screen.getByRole("heading", { name: /^Tu siete/ })).toHaveTextContent("Tu siete2-3-1 · J8 · MAD SKY");
    expect(screen.getByText("EN EL CAMPO").nextSibling).toHaveTextContent("7/7");
    expect(screen.getByRole("img", { name: "Muy alta" })).toBeInTheDocument();
    const bars = container.querySelectorAll(".fsq-b .fb");
    expect(Array.from(bars).map((b) => b.querySelector("span")?.textContent)).toEqual(["ATA", "DEF", "FOR", "EXP"]);
    expect((bars[2].querySelector("i") as HTMLElement).style.getPropertyValue("--v")).toBe(String(ch.fo));
  });

  it("the tabs: Convocatoria · Sistema · Plan · Cambios between the Q and E keys", () => {
    const onTab = vi.fn();
    const { container } = render(<OnceTabs tab="s" onTab={onTab} />);
    const tabs = within(screen.getByRole("group", { name: "Herramienta del siete" })).getAllByRole("button");
    expect(tabs.map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual(["Convocatoria", "Sistema", "Plan", "Cambios"]);
    expect(tabs[1]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(tabs[2]);
    expect(onTab).toHaveBeenCalledWith("p");
    fireEvent.click(tabs[3]);
    expect(onTab).toHaveBeenCalledWith("c");
    const keys = container.querySelectorAll(".tabrow > kbd.bk");
    expect(Array.from(keys).map((k) => k.textContent)).toEqual(["Q", "E"]);
    keys.forEach((k) => expect(k).toHaveAttribute("aria-hidden", "true"));
  });

  it("Convocatoria: the two actions, the search that opens, and the bench as rows and cromos", () => {
    const p = benchProps();
    const { container, rerender } = render(<BenchTab {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Sugerir siete por forma reciente: abre un sobre" }));
    expect(p.onSuggest).toHaveBeenCalled();
    expect(screen.getByText("Por forma · J5–J7")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Auto-colocar: cada uno a su posición natural" }));
    expect(p.onAuto).toHaveBeenCalled();
    // the search is folded until asked for
    expect(screen.queryByRole("searchbox", { name: "Buscar jugador" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buscar en la plantilla" }));
    expect(p.onSrx).toHaveBeenCalled();
    rerender(<BenchTab {...p} srx />);
    expect(screen.getByRole("button", { name: "Buscar en la plantilla" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar jugador" }), { target: { value: "ker" } });
    expect(p.onQ).toHaveBeenCalledWith("ker");
    fireEvent.click(within(screen.getByRole("group", { name: "Filtrar por posición" })).getByRole("button", { name: "DEF" }));
    expect(p.onZf).toHaveBeenCalledWith("DEF");
    // only the view on screen is rendered: the FUT rows (Lista, the default on a desktop)…
    const list = screen.getByRole("group", { name: /^Banquillo en lista/ });
    expect(screen.queryByRole("group", { name: /^Banquillo:/ })).not.toBeInTheDocument();
    expect(list).toHaveAttribute("data-bench", "1");
    const erikRow = within(list).getByRole("button", { name: /^ERIK, dorsal 9/ });
    expect(erikRow).toHaveClass("ar");
    expect(erikRow).toHaveAttribute("data-tok", "erik");
    expect(erikRow).toHaveAttribute("data-zone", "b");
    expect(erikRow.querySelector(".ar-r b")).toHaveTextContent("96");
    expect(erikRow.querySelector(".ar-s b")).toHaveTextContent("9");
    expect(erikRow.querySelector(".ar-n small")).toHaveTextContent("0 PJ · 0 G · 0 A · 0'");
    fireEvent.click(erikRow);
    expect(p.onTapBench).toHaveBeenCalledWith("erik", erikRow);
    // the groups with their counts and empty texts
    expect(Array.from(container.querySelectorAll(".cvl .lg-h")).map((h) => h.textContent)).toEqual(["Banquillo3", "Sin convocar0", "Bajas2"]);
    expect(container.querySelector(".cvl .lg.g-s .grp-e")).toHaveTextContent("Nadie fuera de la convocatoria.");
    expect(within(list).getByRole("button", { name: /^BRAWAN/ })).toHaveAttribute("data-zone", "x");
    // …or the album cromos, the same players
    rerender(<BenchTab {...p} srx benchView="cromos" />);
    expect(screen.queryByRole("group", { name: /^Banquillo en lista/ })).not.toBeInTheDocument();
    const grid = screen.getByRole("group", { name: /^Banquillo:/ });
    expect(grid).toHaveAttribute("data-bench", "1");
    const erikCard = within(grid).getByRole("button", { name: /^ERIK, dorsal 9/ });
    expect(erikCard).toHaveClass("ac");
    expect(erikCard.querySelector(".ac-c .cc-f .cc-nm")).toHaveTextContent("ERIK");
  });

  it("under 1100 px the list is never rendered: the cromos, whatever the view says", () => {
    window.matchMedia = vi.fn((q: string) => ({ matches: !q.includes("min-width: 1100px"), media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }));
    try {
      render(<BenchTab {...benchProps({ benchView: "lista" })} />);
      expect(screen.queryByRole("group", { name: /^Banquillo en lista/ })).not.toBeInTheDocument();
      expect(screen.getByRole("group", { name: /^Banquillo:/ })).toBeInTheDocument();
      // (the toggle still says what is chosen for the desktop)
      expect(within(screen.getByRole("group", { name: "Vista del banquillo" })).getByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");
    } finally {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });

  it("the bench view: Lista by default, Cromos on request (R)", () => {
    const onBenchView = vi.fn();
    const { container, rerender } = render(<BenchTab {...benchProps({ onBenchView })} />);
    const view = within(screen.getByRole("group", { name: "Vista del banquillo" }));
    expect(view.getByRole("button", { name: "Lista" })).toHaveAttribute("aria-pressed", "true");
    expect(view.getByRole("button", { name: "Cromos" })).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector(".bvt kbd")).toHaveTextContent("R");
    fireEvent.click(view.getByRole("button", { name: "Cromos" }));
    expect(onBenchView).toHaveBeenCalledWith("cromos");
    rerender(<BenchTab {...benchProps({ onBenchView, benchView: "cromos" })} />);
    expect(view.getByRole("button", { name: "Cromos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("read-only: the actions can't be used", () => {
    render(<BenchTab {...benchProps({ ro: true })} />);
    expect(screen.getByRole("button", { name: /^Sugerir siete/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Auto-colocar/ })).toBeDisabled();
  });

  it("Sistema: the systems and Libre as tiles with their names, then the química in short", () => {
    const onSystem = vi.fn();
    const { container } = render(<SystemTab formation="2-3-1" free={false} grid={false} ro={false} ch={ch} sq={sq} cands={sq.list.map((c) => c.id)} onSystem={onSystem} onLibre={vi.fn()} onGrid={vi.fn()} onReset={vi.fn()} />);
    const tiles = within(screen.getByRole("group", { name: "Sistema de juego" })).getAllByRole("button");
    expect(tiles.map((t) => t.querySelector("b")?.textContent)).toEqual(["2-3-1", "2-1-2-1", "2-2-2", "2-2-1-1", "3-2-1", "3-1-2", "3-1-1-1", "4-1-1", "3-3", "2-1-3", "1-3-2", "1-2-3", "1-2-2-1", "1-1-2-1-1", "2-1-2-1", "Libre"]);
    expect(tiles[0]).toHaveAttribute("aria-pressed", "true");
    expect(tiles[1].querySelector("small")).toHaveTextContent("Rombo");
    expect(tiles[15].querySelector("small")).toHaveTextContent("a mano");
    expect(tiles[1].querySelectorAll("circle")).toHaveLength(7);
    fireEvent.click(tiles[1]);
    expect(onSystem).toHaveBeenCalledWith("2-1-2-1");
    expect(screen.getByRole("heading", { name: /^Química del siete · \d+ luc(es|z)$/ })).toBeInTheDocument();
    expect(container.querySelector(".qsum .sr")).toHaveTextContent(ch.v + " de 100");
    expect(container.querySelectorAll(".lines > div")).toHaveLength(3);
    expect(container.querySelectorAll(".lk-list li").length).toBeLessThanOrEqual(3);
    // the free-mode row only in Libre
    expect(screen.queryByRole("button", { name: "Ajustar a la rejilla" })).not.toBeInTheDocument();
  });

  describe("Sistema: ¿nos encaja?", () => {
    const ps = (main: PosCode | null, ...also: PosCode[]): ResolvedPositions => ({ main, also, line: main ? lineOf(main) : null });
    const withPs = (id: string, num: number, main: PosCode | null, ...also: PosCode[]) => cromo(id, num, main ? lineOf(main) : undefined, { ps: ps(main, ...also) });
    // two keepers, a LD, a DFC, two MCs (one also pivote), a punta and an extremo derecho
    const fq = squadOf([
      withPs("k1", 1, "POR"),
      withPs("k2", 13, "POR"),
      withPs("ld", 2, "LD"),
      withPs("dfc", 4, "DFC"),
      withPs("mc1", 8, "MC"),
      withPs("mc2", 6, "MC", "MCD"),
      withPs("dc", 9, "DC"),
      withPs("ed", 7, "ED"),
    ]);
    const FL = lineupOf(["k1", "dfc", "ld", "mc1", "mc2", "ed", "dc"], "2-3-1", fq);
    const fch = chem(FL, fq);
    const ids = fq.list.map((c) => c.id);
    const tab = (over: { formation?: FormationName; free?: boolean; sq?: Squad; cands?: string[] } = {}) => (
      <SystemTab formation={over.formation ?? "2-3-1"} free={over.free ?? false} grid={false} ro={false} ch={fch} sq={over.sq ?? fq} cands={over.cands ?? ids} onSystem={vi.fn()} onLibre={vi.fn()} onGrid={vi.fn()} onReset={vi.fn()} />
    );
    const tilesOf = () => within(screen.getByRole("group", { name: "Sistema de juego" })).getAllByRole("button");
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it("each tile counts who is in his place, says it in words, and tints its dots by the best seven", () => {
      render(tab());
      const tiles = tilesOf();
      expect(tiles[0]).toHaveAttribute("aria-label", "Sistema 2-3-1 Clásico, 4 de 7 en su sitio");
      expect(tiles[0].querySelector(".pzp-syf")).toHaveTextContent("4/7 en su sitio");
      expect(tiles[9].querySelector("b")).toHaveTextContent("2-1-3");
      expect(tiles[9]).toHaveAttribute("aria-label", "Sistema 2-1-3 Tridente, 5 de 7 en su sitio");
      // 2-3-1 grades [3,3,1,1,3,1,3]: the keeper stays gold, the rest by grade
      const dots = Array.from(tiles[0].querySelectorAll("circle")).map((c) => c.getAttribute("class"));
      expect(dots).toEqual(["g", "pzp-dot-g3", "pzp-dot-g1", "pzp-dot-g1", "pzp-dot-g3", "pzp-dot-g1", "pzp-dot-g3"]);
      // Libre has no count
      expect(tiles[15].querySelector(".pzp-syf")).toBeNull();
    });

    it("the strip: the current system's ficha and who is missing", () => {
      render(tab());
      const strip = screen.getByRole("region", { name: "Ficha del sistema 2-3-1" });
      const def = systemDef("2-3-1");
      expect(strip.querySelector(".pzp-sysf-h")).toHaveTextContent("2-3-1 · Clásico");
      expect(strip).toHaveTextContent(def.about);
      expect(strip).toHaveTextContent("Fuertes: " + def.strengths);
      expect(strip).toHaveTextContent("Débiles: " + def.weaknesses);
      expect(strip.querySelector(".pzp-sysf-f")).toHaveTextContent("Faltan: un central, un interior izquierdo y un interior derecho");
    });

    it("«Ordenar por encaje»: off by default (catalogue order); on, most in place first (stable), remembered", () => {
      const { unmount } = render(tab());
      const order = () => tilesOf().map((t) => t.querySelector("b")?.textContent);
      const catalogue = order();
      const sort = screen.getByRole("button", { name: "Ordenar por encaje" });
      expect(sort).toHaveAttribute("aria-pressed", "false");
      fireEvent.click(sort);
      expect(sort).toHaveAttribute("aria-pressed", "true");
      expect(localStorage.getItem("mp_pizarra_v2_sysorder")).toBe("1");
      const enc = encajeBySystem(ids, fq);
      const sorted = [...SYSTEMS].sort((a, b) => enc[b].inPlace - enc[a].inPlace).map((k) => systemDef(k).label);
      expect(order()).toEqual([...sorted, "Libre"]);
      expect(order()).not.toEqual(catalogue);
      const counts = tilesOf().slice(0, -1).map((t) => Number(t.querySelector(".pzp-syf")?.textContent?.split("/")[0]));
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      // a new visit keeps the order
      unmount();
      render(tab());
      expect(screen.getByRole("button", { name: "Ordenar por encaje" })).toHaveAttribute("aria-pressed", "true");
      expect(order()).toEqual([...sorted, "Libre"]);
    });

    it("a single missing position: «Falta» in the singular", () => {
      render(tab({ formation: "2-1-3" }));
      expect(screen.getByRole("region", { name: "Ficha del sistema 2-1-3" }).querySelector(".pzp-sysf-f")).toHaveTextContent("Faltan: un central y un extremo izquierdo");
      cleanup();
      const full = squadOf([...fq.list, withPs("dfc2", 5, "DFC"), withPs("mi", 3, "MI"), withPs("md", 11, "MD", "ED")]);
      render(tab({ sq: full, cands: full.list.map((c) => c.id).filter((id) => id !== "md") }));
      expect(screen.getByRole("region", { name: "Ficha del sistema 2-3-1" }).querySelector(".pzp-sysf-f")).toHaveTextContent(/^Falta: un interior derecho$/);
    });

    it("no positions data (a line at most): no counts, no tints, no «Falta», no sort — the ficha stays", () => {
      const { container } = render(tab({ sq, cands: sq.list.map((c) => c.id) }));
      const tiles = tilesOf();
      expect(tiles[0]).toHaveAttribute("aria-label", "Sistema 2-3-1 Clásico");
      expect(container.querySelector(".pzp-syf")).toBeNull();
      expect(container.querySelector("[class*='pzp-dot-g']")).toBeNull();
      expect(container.querySelector(".pzp-sysf-f")).toBeNull();
      expect(screen.queryByRole("button", { name: "Ordenar por encaje" })).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Ficha del sistema 2-3-1" })).toHaveTextContent(systemDef("2-3-1").about);
    });

    it("Libre has no ficha of its own", () => {
      render(tab({ free: true }));
      expect(screen.queryByRole("region", { name: /^Ficha del sistema/ })).not.toBeInTheDocument();
    });

    it("a blocked storage never breaks the panel", () => {
      const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      try {
        render(tab());
        const sort = screen.getByRole("button", { name: "Ordenar por encaje" });
        expect(sort).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(sort);
        expect(sort).toHaveAttribute("aria-pressed", "true");
      } finally {
        get.mockRestore();
        set.mockRestore();
      }
    });
  });

  it("the panels' heading speaks first; the kicker is the line under it", () => {
    const { container } = render(<PanelHead kick="Al grupo del equipo" title="Compartir" onBack={vi.fn()} />);
    const box = container.querySelector(".sh-h > div") as HTMLElement;
    expect(Array.from(box.children).map((e) => e.tagName + "." + e.className)).toEqual(["H2.", "SPAN.k2"]);
    expect(container.querySelector(".sh-h > .back")).toHaveTextContent("Más");
  });
});
