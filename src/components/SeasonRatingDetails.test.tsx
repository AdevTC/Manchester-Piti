import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SeasonRatingDetails } from "./SeasonRatingDetails";
import { seasonRating } from "../lib/seasonRating";

afterEach(cleanup);
describe("GLOBAL: explicación de la temporada", () => {
  it("discloses weights and missing evidence without presenting missing blocks as zero", () => {
    const rating = seasonRating({ id: "p", naturalPosition: "MED" }, []);
    render(<SeasonRatingDetails rating={rating} />);
    const toggle = screen.getByText("Cómo se calcula GLOBAL");
    expect(toggle.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(toggle);
    expect(toggle.closest("details")).toHaveAttribute("open");
    expect(screen.getByText(/Minutos incompletos/)).toHaveTextContent("6 acciones");
    const passing = screen.getByText("Pase").parentElement!;
    expect(within(passing).getByText("—")).toBeInTheDocument();
    expect(within(passing).getByText("Peso base 25 %")).toBeInTheDocument();
    expect(screen.getByText(/Modelo piti-season-v2/)).toHaveTextContent("no una valoración profesional validada");
  });
  it("prints an evidenced zero and labels partial samples, rather than hiding the number", () => {
    const rating = seasonRating({ id: "p", naturalPosition: "MED" }, []);
    rating.blocks.find(b => b.id === "passing")!.score = 0;
    rating.blocks.find(b => b.id === "passing")!.partial = true;
    render(<SeasonRatingDetails rating={rating} />);
    const passing = screen.getByText("Pase").parentElement!;
    expect(within(passing).getByText("0/100")).toBeInTheDocument();
    expect(passing).toHaveTextContent("muestra parcial");
  });
});
