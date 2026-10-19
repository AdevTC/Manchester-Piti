import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Shelf, type ShelfPlace } from "./Shelf";
import { nextIndex, shelfPanelId, shelfTabId, travel } from "./shelfIds";

const PLACES: ShelfPlace[] = [
  { id: "hoy", label: "Hoy", hint: "2–1, minuto 23" },
  { id: "temporada", label: "Temporada", hint: "4º si acaba así" },
  { id: "club", label: "Club" },
  { id: "tu", label: "Tú", badge: 2 },
];

function Harness() {
  const [v, setV] = useState("hoy");
  return (
    <>
      <Shelf places={PLACES} value={v} onChange={setV} label="Lugares de Inicio" idBase="inicio" />
      <div role="tabpanel" id={shelfPanelId("inicio", v)} aria-labelledby={shelfTabId("inicio", v)}>
        {v}
      </div>
    </>
  );
}

describe("shelf keys", () => {
  it("arrows wrap, Home and End jump, other keys are ignored", () => {
    expect(nextIndex("ArrowRight", 3, 4)).toBe(0);
    expect(nextIndex("ArrowLeft", 0, 4)).toBe(3);
    expect(nextIndex("End", 0, 4)).toBe(3);
    expect(nextIndex("Home", 2, 4)).toBe(0);
    expect(nextIndex("a", 2, 4)).toBeNull();
    expect(travel(0, 2)).toBe("right");
    expect(travel(2, 1)).toBe("left");
  });
});

describe("Shelf", () => {
  it("a tablist whose tabs point at the page's panels, one tab stop", () => {
    render(<Harness />);
    const tabs = screen.getAllByRole("tab");
    expect(screen.getByRole("tablist", { name: "Lugares de Inicio" })).toBeInTheDocument();
    expect(tabs.map((t) => t.getAttribute("aria-controls"))).toEqual(["inicio-panel-hoy", "inicio-panel-temporada", "inicio-panel-club", "inicio-panel-tu"]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(screen.getByRole("tabpanel", { name: /Hoy/ })).toHaveTextContent("hoy");
    expect(screen.getByRole("tab", { name: /Tú, 2/ })).toBeInTheDocument();
  });

  it("a short hint for the phone rides next to the long one (CSS shows one)", () => {
    render(<Shelf places={[{ id: "hoy", label: "Hoy", hint: "2–1, minuto 23", short: "2–1, 23′" }, { id: "club", label: "Club", hint: "Club", short: "Club" }]} value="hoy" onChange={() => undefined} label="Lugares" idBase="x" />);
    const hoy = screen.getByRole("tab", { name: /Hoy/ });
    expect(hoy.querySelector(".vd-hint-l")).toHaveTextContent("2–1, minuto 23");
    expect(hoy.querySelector(".vd-hint-s")).toHaveTextContent("2–1, 23′");
    expect(screen.getByRole("tab", { name: /Club/ }).querySelector(".vd-hint-s")).toBeNull();
  });

  it("arrow keys choose and move the focus; a click chooses", () => {
    render(<Harness />);
    const hoy = screen.getByRole("tab", { name: /Hoy/ });
    hoy.focus();
    fireEvent.keyDown(hoy, { key: "ArrowRight" });
    const temporada = screen.getByRole("tab", { name: /Temporada/ });
    expect(temporada).toHaveAttribute("aria-selected", "true");
    expect(temporada).toHaveFocus();
    fireEvent.keyDown(temporada, { key: "End" });
    expect(screen.getByRole("tab", { name: /Tú/ })).toHaveFocus();
    fireEvent.click(screen.getByRole("tab", { name: "Club" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("club");
  });
});
