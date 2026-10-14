import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayerDoc } from "../../lib/schemas";
import { PlantillaPosiciones } from "./PlantillaPosiciones";

// /club «La plantilla por posiciones»: per exact position, how many players of the season (the same squad as
// «La plantilla en números») have it as their preferida and how many more list it in «también»; the ones
// without an exact position apart (legacy fichas with only a line said as such).

const p = (id: string, extra: Partial<PlayerDoc> = {}): PlayerDoc => ({ id, seasons: ["t1"], ...extra });
const SQUAD: PlayerDoc[] = [
  p("a", { positions: { main: "MC", also: ["MCD"] } }),
  p("b", { positions: { main: "MC", also: [] } }),
  p("c", { positions: { main: "MC", also: ["MI"] } }),
  p("d", { positions: { main: "MCD", also: ["MC"] } }),
  p("e", { positions: { main: "DFC", also: ["MC"] } }),
  p("f"),
  p("g", { naturalPosition: "" }),
];

const view = (squad: PlayerDoc[] = SQUAD) => render(<PlantillaPosiciones squad={squad} seasonName="Temporada 1" />);

describe("La plantilla por posiciones", () => {
  it("is a club section with its heading", () => {
    view();
    expect(screen.getByRole("heading", { level: 2, name: "La plantilla por posiciones" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "La plantilla por posiciones" })).toBeInTheDocument();
  });

  it("«MC 3 · +2»: preferida and también, over the squad it is given", () => {
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

  it("«Sin posición exacta: N» counts the players without an exact position", () => {
    view();
    expect(screen.getByText("Sin posición exacta: 2")).toBeInTheDocument();
    expect(screen.getByText("Sus fichas aún no dicen dónde juegan.")).toBeInTheDocument();
  });

  it("a legacy ficha with only its line: counted apart, never «no dice dónde juega»", () => {
    view([...SQUAD, p("old", { naturalPosition: "Defensa" })]);
    expect(screen.getByText("Sin posición exacta: 3")).toBeInTheDocument();
    expect(screen.getByText("(1 con solo su línea: defensa) · 2 aún sin posición en su ficha.")).toBeInTheDocument();
    expect(screen.queryByText(/no dicen? dónde juega/)).not.toBeInTheDocument();
  });

  it("the footer counts the squad of the season", () => {
    view();
    expect(screen.getByText(/^7 jugadores de la temporada/)).toBeInTheDocument();
  });

  it("the legend says what the numbers mean, in words", () => {
    view();
    // MC is the busiest position (3 + 2): the key reads its real numbers
    expect(screen.getByText("MC 3 · +2", { selector: ".cl-pp-key" })).toBeInTheDocument();
    expect(screen.getByText("3 la tienen de preferida y 2 más la marcan en «también».")).toBeInTheDocument();
    expect(screen.getAllByText(/«también»/).length).toBeGreaterThan(0);
  });

  it("the key follows the data (singular), never the example", () => {
    view([p("a", { positions: { main: "MC", also: [] } }), p("b", { positions: { main: "MCD", also: ["MC"] } })]);
    expect(screen.getByText("MC 1 · +1", { selector: ".cl-pp-key" })).toBeInTheDocument();
    expect(screen.getByText("1 la tiene de preferida y 1 más la marca en «también».")).toBeInTheDocument();
    expect(screen.queryByText("MC 3 · +2", { selector: ".cl-pp-key" })).not.toBeInTheDocument();
  });

  it("nobody without a position: the positive line, no big «0»", () => {
    view([p("a", { positions: { main: "MC", also: [] } })]);
    expect(screen.queryByText("Sin posición: 0")).not.toBeInTheDocument();
    expect(screen.getByText("Todos con posición")).toBeInTheDocument();
    expect(screen.getByText("Todos tienen su sitio en el campo.")).toBeInTheDocument();
  });
});
