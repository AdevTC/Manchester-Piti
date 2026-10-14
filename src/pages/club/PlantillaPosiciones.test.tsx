import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayerDoc } from "../../lib/schemas";
import { PlantillaPosiciones } from "./PlantillaPosiciones";

// /club «La plantilla por posiciones»: per exact position, how many active players of the season have it as
// their preferida and how many more list it in «también»; the ones without any position apart.

const p = (id: string, extra: Partial<PlayerDoc> = {}): PlayerDoc => ({ id, seasons: ["t1"], ...extra });
const SQUAD: PlayerDoc[] = [
  p("a", { positions: { main: "MC", also: ["MCD"] } }),
  p("b", { positions: { main: "MC", also: [] } }),
  p("c", { positions: { main: "MC", also: ["MI"] } }),
  p("d", { positions: { main: "MCD", also: ["MC"] } }),
  p("e", { positions: { main: "DFC", also: ["MC"] } }),
  p("f"),
  p("g", { naturalPosition: "" }),
  // not counted: inactive, or from another season
  p("x", { active: false, positions: { main: "MC", also: [] } }),
  p("y", { seasons: ["t0"], positions: { main: "MC", also: [] } }),
  p("z", { active: false }),
];

const view = () => render(<PlantillaPosiciones players={SQUAD} seasonId="t1" seasonName="Temporada 1" />);

describe("La plantilla por posiciones", () => {
  it("is a club section with its heading", () => {
    view();
    expect(screen.getByRole("heading", { level: 2, name: "La plantilla por posiciones" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "La plantilla por posiciones" })).toBeInTheDocument();
  });

  it("«MC 3 · +2»: preferida and también, active players of the season only", () => {
    view();
    const list = screen.getByRole("list", { name: /Temporada 1/ });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(13);
    const mc = items.find((li) => li.getAttribute("data-code") === "MC")!;
    expect(within(mc).getByText("MC 3 · +2", { selector: "[aria-hidden]" })).toBeInTheDocument();
    expect(mc).toHaveTextContent("Mediocentro (MC): 3 de preferida y 2 más en «también»");
    const mcd = items.find((li) => li.getAttribute("data-code") === "MCD")!;
    expect(mcd).toHaveTextContent("MCD 1 · +1");
    const dc = items.find((li) => li.getAttribute("data-code") === "DC")!;
    expect(dc).toHaveTextContent("DC 0");
    expect(dc).toHaveAttribute("data-empty");
  });

  it("«Sin posición: N» counts the active players without any position", () => {
    view();
    expect(screen.getByText("Sin posición: 2")).toBeInTheDocument();
  });

  it("the legend says what the numbers mean, in words", () => {
    view();
    expect(screen.getByText(/la tienen de preferida/)).toBeInTheDocument();
    expect(screen.getAllByText(/«también»/).length).toBeGreaterThan(0);
  });
});
