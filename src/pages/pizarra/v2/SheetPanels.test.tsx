import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlanTab } from "./SheetPanels";
import { planNote, tacRows } from "./plan";
import { demoSquad, lineupOf } from "./testkit";

// The sheet's tools beyond the bench, on their own.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L = lineupOf(SEVEN, "2-3-1", sq);

describe("Siete → Plan", () => {
  const plan = (note: string | null) => render(<PlanTab rows={tacRows(L)} ro={false} rep={[]} repTxt="" canRotate={false} note={note} onSet={vi.fn()} onRotate={vi.fn()} />);

  it("in free mode it says the plan moves nobody (and what it still paints)", () => {
    plan(planNote({ ...L, freeMode: true }));
    expect(screen.getByText(/En modo libre el plan no mueve a nadie: colócalos tú/)).toBeInTheDocument();
  });

  it("with a system there is nothing to warn about", () => {
    const { container } = plan(planNote(L));
    expect(container.querySelector(".cav")).toBeNull();
  });
});
