import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { analysePlayer } from "../../lib/clubAnalytics";
import type { ClubMatch } from "../../lib/clubData";
import { Explorar } from "./Explorar";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a> }));
const games: ClubMatch[] = [1,2,3].map(n => ({ id: `j${n}`, rival: `Rival ${n}`, status: "finished", date: Date.UTC(2026, 9, n), goalsFor: 1, goalsAgainst: 0, events: [{ id: `g${n}`, type: "goal", playerId: "p1", minute: 5 }] }));
const view = (matches: ClubMatch[]) => <Explorar rows={[analysePlayer({ id: "p1", shirtName: "Pepe" }, matches)]} games={matches} section="evolution" onSection={() => {}} nameOf={() => "Pepe"}/>;
describe("Explorar scope changes", () => {
  it("clamps the selected match when a filter reduces the period", () => {
    const { rerender } = render(view(games));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    expect(screen.getByText("Partido 3 de 3")).toBeInTheDocument();
    rerender(view(games.slice(0, 1)));
    expect(screen.getByText("Partido 1 de 1")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("0");
    expect(screen.getByRole("link", { name: /Rival 1/ })).toBeInTheDocument();
    rerender(view([]));
    expect(screen.getByText("No hay partidos finalizados.")).toBeInTheDocument();
  });
});
