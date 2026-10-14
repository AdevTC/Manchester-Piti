import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapaPosiciones } from "./MapaPosiciones";
import type { PositionSet } from "../../lib/positions";

const set: PositionSet = { main: "MCD", also: ["MC", "DFC"] };

describe("MapaPosiciones · editar", () => {
  it("renders the 13 spots as buttons inside a named group, codes always visible", () => {
    render(<MapaPosiciones label="Tus posiciones" value={set} onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Tus posiciones" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(13);
    expect(within(group).getByRole("button", { name: "MCD · Pivote: preferida" })).toHaveTextContent("MCD");
    expect(within(group).getByRole("button", { name: "MCD · Pivote: preferida" })).toHaveTextContent("★");
    expect(within(group).getByRole("button", { name: "MCD · Pivote: preferida" })).toHaveTextContent("PREF");
    expect(within(group).getByRole("button", { name: "MC · Mediocentro: también" })).toHaveTextContent("✓");
    expect(within(group).getByRole("button", { name: "DC · Punta: sin marcar" })).toHaveTextContent(/^DC$/);
  });

  it("cycles nada → también → preferida → nada through onChange", () => {
    const onChange = vi.fn();
    const { rerender } = render(<MapaPosiciones label="Mapa" value={set} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^DC · / }));
    expect(onChange).toHaveBeenLastCalledWith({ main: "MCD", also: ["MC", "DFC", "DC"] });

    fireEvent.click(screen.getByRole("button", { name: /^MC · / }));
    expect(onChange).toHaveBeenLastCalledWith({ main: "MC", also: ["DFC", "MCD"] });

    fireEvent.click(screen.getByRole("button", { name: /^MCD · / }));
    expect(onChange).toHaveBeenLastCalledWith({ main: null, also: ["MC", "DFC"] });

    rerender(<MapaPosiciones label="Mapa" value={{ main: null, also: ["MC", "DFC"] }} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "MCD · Pivote: sin marcar" })).toBeInTheDocument();
  });

  it("announces the new state in the live region", () => {
    const onChange = vi.fn();
    render(<MapaPosiciones label="Mapa" value={set} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^MC · / }));
    expect(screen.getByRole("status")).toHaveTextContent("MC · mediocentro: preferida");
  });

  it("refuses a 7th «también», tells the host and announces it", () => {
    const onChange = vi.fn();
    const onRefuse = vi.fn();
    const full: PositionSet = { main: "POR", also: ["DFC", "LIB", "LI", "LD", "MCD", "MC"] };
    render(<MapaPosiciones label="Mapa" value={full} onChange={onChange} onRefuse={onRefuse} />);
    fireEvent.click(screen.getByRole("button", { name: /^DC · / }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onRefuse).toHaveBeenCalledWith("Máximo 6 posiciones de «también»");
    expect(screen.getByRole("status")).toHaveTextContent("Máximo 6 posiciones de «también»");
    const first = screen.getByRole("status").textContent;
    fireEvent.click(screen.getByRole("button", { name: /^DC · / }));
    expect(onRefuse).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).not.toBe(first); // re-announced
    // the toggle is a no-break space: a plain one would be collapsed away and not count as a change
    expect([first, screen.getByRole("status").textContent].some((t) => t?.endsWith(" "))).toBe(true);
  });

  it("uses a single tab stop and moves focus with the arrows", () => {
    render(<MapaPosiciones label="Mapa" value={set} onChange={() => {}} />);
    const tabbable = screen.getAllByRole("button").filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    const mc = screen.getByRole("button", { name: /^MC · / });
    mc.focus();
    fireEvent.keyDown(mc, { key: "ArrowUp" });
    const mco = screen.getByRole("button", { name: /^MCO · / });
    expect(mco).toHaveFocus();
    expect(mco.tabIndex).toBe(0);
    fireEvent.keyDown(mco, { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: /^MI · / })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Home" });
    expect(screen.getByRole("button", { name: /^POR · / })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" });
    expect(screen.getByRole("button", { name: /^DC · / })).toHaveFocus();
  });

  it("leaves arrows and Home/End with a modifier to the browser", () => {
    render(<MapaPosiciones label="Mapa" value={set} onChange={() => {}} />);
    const mc = screen.getByRole("button", { name: /^MC · / });
    mc.focus();
    for (const mod of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      expect(fireEvent.keyDown(mc, { key: "ArrowUp", ...mod })).toBe(true); // not prevented
      fireEvent.keyDown(mc, { key: "Home", ...mod });
      expect(mc).toHaveFocus();
    }
    expect(fireEvent.keyDown(mc, { key: "ArrowUp" })).toBe(false);
  });

  it("lifts the DFC hit area 1 % so it never overlaps LIB, keeping its dot in place", () => {
    const { container } = render(<MapaPosiciones label="Mapa" value={set} onChange={() => {}} />);
    const dfc = container.querySelector<HTMLElement>('[data-code="DFC"]');
    expect(dfc?.style.top).toBe("75%");
    expect(dfc?.style.getPropertyValue("--_pos-shift")).toBe("1.75cqw");
    const lib = container.querySelector<HTMLElement>('[data-code="LIB"]');
    expect(lib?.style.top).toBe("84%");
    expect(lib?.style.getPropertyValue("--_pos-shift")).toBe("");
  });

  it("shows the legend and the one-line summary under the pitch", () => {
    render(<MapaPosiciones label="Mapa" value={set} onChange={() => {}} />);
    expect(screen.getByText("Pivote (MCD) · también MC, DFC")).toBeInTheDocument();
    expect(screen.getByText(/Preferida/)).toBeInTheDocument();
    expect(screen.getByText(/También$/)).toBeInTheDocument();
  });
});

describe("MapaPosiciones · comparar", () => {
  it("marks codes added «+» and removed «−» against the reference, with a legend", () => {
    const current: PositionSet = { main: "MCD", also: ["LIB"] };
    render(<MapaPosiciones label="Propuesta" value={set} compare={current} />);
    const img = screen.getByRole("img", { name: /^Propuesta\./ });
    expect(img.querySelector('[data-code="MC"] .pos-diff')).toHaveTextContent("+");
    expect(img.querySelector('[data-code="DFC"] .pos-diff')).toHaveTextContent("+");
    expect(img.querySelector('[data-code="LIB"] .pos-diff')).toHaveTextContent("−");
    expect(img.querySelector('[data-code="MCD"] .pos-diff')).toBeNull();
    expect(screen.getByText(/Añadida/)).toBeInTheDocument();
    expect(screen.getByText(/Quitada/)).toBeInTheDocument();
  });

  it("adds the difference to the buttons' names when editing", () => {
    render(<MapaPosiciones label="Ajustar" value={set} compare={{ main: "MCD", also: ["LIB"] }} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "MC · Mediocentro: también, añadida" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LIB · Líbero: sin marcar, quitada" })).toBeInTheDocument();
  });
});

describe("MapaPosiciones · solo ver", () => {
  it("has no buttons and a full textual image label", () => {
    render(<MapaPosiciones label="Posiciones de Jordi" value={set} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("img", {
        name: "Posiciones de Jordi. Preferida: Pivote (MCD). También: Mediocentro (MC), Central (DFC).",
      }),
    ).toBeInTheDocument();
  });

  it("hides the legend and summary from screen readers (the image label already says it all)", () => {
    const { container } = render(<MapaPosiciones label="Mapa" value={set} />);
    expect(container.querySelector(".pos-legend")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".pos-summary")).toHaveAttribute("aria-hidden", "true");
  });

  it("still draws every state", () => {
    const { container } = render(<MapaPosiciones label="Mapa" value={set} size="s" />);
    expect(container.querySelector('[data-code="MCD"]')).toHaveAttribute("data-state", "preferida");
    expect(container.querySelector('[data-code="MC"]')).toHaveAttribute("data-state", "tambien");
    expect(container.querySelector('[data-code="DC"]')).toHaveAttribute("data-state", "nada");
    expect(container.querySelector(".pos-map")).toHaveClass("pos-map--s");
  });
});

describe("MapaPosiciones · ha jugado de", () => {
  const played = { MCD: 320, MC: 140, DFC: 20, DC: 0.3 };

  it("is read-only even with onChange: an image whose name says the minutes in words", () => {
    render(<MapaPosiciones label="Dónde ha jugado Erik" value={set} played={played} onChange={() => {}} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("img", {
        name: "Dónde ha jugado Erik. Ha jugado de Pivote (MCD), 320 minutos; Mediocentro (MC), 140 minutos; Central (DFC), 20 minutos. Preferida: Pivote (MCD). También: Mediocentro (MC), Central (DFC).",
      }),
    ).toBeInTheDocument();
  });

  it("fills a disc per position played, «320′» under it, sized by √(minutes / max) from 28 to 52 px", () => {
    const { container } = render(<MapaPosiciones label="Mapa" value={{ main: null, also: [] }} played={{ DC: 400, MCD: 100, LI: 4 }} />);
    const spot = (c: string) => container.querySelector<HTMLElement>(`[data-code="${c}"]`)!;
    expect(container.querySelector(".pos-map")).toHaveClass("pos-map--played");
    expect(spot("DC")).toHaveAttribute("data-played");
    expect(spot("DC").style.getPropertyValue("--_pos-d")).toBe("52");
    expect(spot("MCD").style.getPropertyValue("--_pos-d")).toBe("40");
    expect(spot("DC")).toHaveTextContent("DC400′");
    expect(spot("MCD")).toHaveTextContent("MCD100′");
    expect(spot("LI")).toHaveTextContent("LI4′");
    // the order they pop in: most minutes first
    expect(spot("DC").style.getPropertyValue("--_pos-i")).toBe("0");
    expect(spot("LI").style.getPropertyValue("--_pos-i")).toBe("2");
  });

  it("keeps ★ on the preferida and ✓ on the también, with the minutes; no «PREF» tag", () => {
    const { container } = render(<MapaPosiciones label="Mapa" value={set} played={played} />);
    const spot = (c: string) => container.querySelector<HTMLElement>(`[data-code="${c}"]`)!;
    expect(spot("MCD")).toHaveTextContent("MCD320′★");
    expect(spot("MCD").querySelector(".pos-mark--pref")).toHaveTextContent("★");
    expect(spot("MC").querySelector(".pos-mark")).toHaveTextContent("✓");
    expect(spot("MC").querySelector(".pos-min")).toHaveTextContent("140′");
    expect(container.querySelector(".pos-tag")).toBeNull();
  });

  it("leaves the positions he never played (or under 1′) dim: no disc, no minutes", () => {
    const { container } = render(<MapaPosiciones label="Mapa" value={set} played={played} />);
    for (const c of ["DC", "POR", "LI"]) {
      const spot = container.querySelector<HTMLElement>(`[data-code="${c}"]`)!;
      expect(spot).not.toHaveAttribute("data-played");
      expect(spot.querySelector(".pos-min")).toBeNull();
      expect(spot).toHaveTextContent(new RegExp(`^${c}$`));
    }
    expect(screen.queryByText("0′")).toBeNull();
  });

  it("leaves out the centre and penalty spots (they would peek out next to DC and POR)", () => {
    const { container, rerender } = render(<MapaPosiciones label="Mapa" value={set} />);
    expect(container.querySelector(".pos-points")).not.toBeNull();
    rerender(<MapaPosiciones label="Mapa" value={set} played={played} />);
    expect(container.querySelector(".pos-points")).toBeNull();
    expect(container.querySelector(".pos-lines rect")).not.toBeNull();
  });

  it("separates the legend items with space, never a «·» that could start a wrapped line", () => {
    const { container } = render(<MapaPosiciones label="Mapa" value={set} played={played} />);
    const legend = container.querySelector(".pos-legend")!;
    expect(legend.querySelectorAll(".pos-legend-item")).toHaveLength(3);
    expect(legend.textContent).not.toContain("·");
  });

  it("summarises with playedSummary and adds a legend line for the disc size", () => {
    render(<MapaPosiciones label="Mapa" value={set} played={played} />);
    expect(screen.getByText("Pivote (MCD) 320′ · MC 140′ · DFC 20′")).toBeInTheDocument();
    expect(screen.getByText(/Más grande, más minutos/)).toBeInTheDocument();
  });

  it("says «estimado» in words under the pitch, and in the image name", () => {
    const { rerender } = render(<MapaPosiciones label="Mapa" value={set} played={played} />);
    expect(screen.queryByText("Algunos minutos estimados por su posición preferida")).toBeNull();
    rerender(<MapaPosiciones label="Mapa" value={set} played={played} estimated />);
    expect(screen.getByText("Algunos minutos estimados por su posición preferida")).toBeInTheDocument();
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/Algunos minutos estimados por su posición preferida\.$/);
  });

  it("without minutes: every spot dim, the explicit empty copy, no «estimado»", () => {
    const { container } = render(<MapaPosiciones label="Mapa" value={set} played={{}} estimated />);
    expect(container.querySelectorAll("[data-played]")).toHaveLength(0);
    expect(screen.getByText("Aún sin minutos con posición")).toBeInTheDocument();
    expect(screen.queryByText("Algunos minutos estimados por su posición preferida")).toBeNull();
    expect(screen.getByRole("img", { name: /^Mapa\. Aún sin minutos con posición\. Preferida: Pivote \(MCD\)\./ })).toBeInTheDocument();
  });
});
