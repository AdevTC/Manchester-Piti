import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { emptyParticipation, type Participation } from "../../functions/src/matchEngine";
import type { ClubMatch } from "../lib/clubData";
import { seasonRating } from "../lib/seasonRating";
import { SeasonRatingDetails } from "./SeasonRatingDetails";

const row = (minutes: number, extra: Partial<Participation> = {}): Participation => ({ ...emptyParticipation(), played: true, minutes, ...extra });
const game = (id: string, day: number, ledger: ClubMatch["ledger"]): ClubMatch => ({ id, seasonId: "s", rival: `Rival ${id}`, status: "finished", date: Date.UTC(2026, 9, day, 17), duration: 50, goalsFor: 1, goalsAgainst: 0, events: [], ledger });
const SEASON = [
  game("a", 4, { p: row(50, { goals: 1, positionsPlayed: { MC: 50 } }), q: row(50, { positionsPlayed: { MC: 50 } }) }),
  game("b", 11, { p: row(20, { positionsPlayed: { MC: 20 } }), q: row(50, { yellowCards: 1, positionsPlayed: { MC: 50 } }) }),
];
const es = (n: number) => n.toLocaleString("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

afterEach(cleanup);
describe("GLOBAL: explicación de la temporada", () => {
  it("opens on demand: each match's nota, newest first, how much it counts and what it came from", () => {
    const rating = seasonRating({ id: "p", naturalPosition: "MED" }, SEASON);
    render(<SeasonRatingDetails rating={rating} />);
    const toggle = screen.getByText("Cómo se calcula GLOBAL");
    expect(toggle.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(toggle);
    expect(toggle.closest("details")).toHaveAttribute("open");
    expect(screen.getByText(`${rating.summary}.`)).toBeInTheDocument();
    expect(screen.getByText(/Cada nota te compara/)).toHaveTextContent("(sobre todo, medios)");
    const rows = [...screen.getByLabelText("Tus notas por partido").children];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Rival b");
    expect(rows[0]).toHaveTextContent("20′");
    expect(rows[0]).toHaveTextContent(es(rating.notes[1].nota));
    expect(rows[0]).toHaveTextContent("Menos de 30′ y sin narrar: cuenta un 33 %");
    expect(rows[1]).toHaveTextContent(es(rating.notes[0].nota));
    expect(rows[1]).toHaveTextContent("Sin narrar: cuenta un 50 %");
    expect(screen.getByLabelText("De dónde sale")).toHaveTextContent("Ataque +1,00 goles");
    expect(screen.getByLabelText("De dónde sale")).toHaveTextContent("Gol +1,00");
    expect(screen.getByText(rating.explanation)).toBeInTheDocument();
    expect(screen.getByText(/Modelo piti-media-v2/)).toHaveTextContent("no una valoración profesional validada");
  });
  it("without a nota yet: says what is missing, no made-up numbers", () => {
    const rating = seasonRating({ id: "p" }, [game("a", 4, { p: row(5) })]);
    render(<SeasonRatingDetails rating={rating} />);
    expect(screen.getByText("Aún sin nota: hace falta un partido con al menos 10 minutos tuyos en el acta.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tus notas por partido")).toBeNull();
    expect(screen.queryByLabelText("De dónde sale")).toBeNull();
    expect(screen.getByText(/Cada nota te compara/)).not.toHaveTextContent("sobre todo");
  });
});
