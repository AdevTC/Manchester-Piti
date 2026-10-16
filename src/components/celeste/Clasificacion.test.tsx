import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { StandingRow, Standings } from "../../lib/standings";

// The league table on the public side: the strip («Vamos 3.º de 12 · 18 pts · J8», linking to
// /partidos?view=tabla), the full table (our row in words, the arrows against the previous save, the
// update date) and the route's ?view= validation. The router's Link is stubbed.
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className, to, search, "aria-label": label }: { children?: ReactNode; className?: string; to?: string; search?: { view?: string }; "aria-label"?: string }) => (
    <a className={className} aria-label={label} href={`${to}${search?.view ? `?view=${search.view}` : ""}`}>
      {children}
    </a>
  ),
}));

const { StandingsStrip, StandingsTable } = await import("./Clasificacion");
const { partidosSearchSchema } = await import("../../router");

const row = (team: string, pts: number, isUs = false): StandingRow => ({ team, pj: 8, g: 5, e: 3, p: 0, gf: 20, gc: 9, pts, isUs });
const twelve = Array.from({ length: 12 }, (_, i) => (i === 2 ? row("Manchester Piti", 18, true) : row(`Equipo ${i + 1}`, 30 - i * 2)));
const table = (over: Partial<Standings> = {}): Standings => ({ id: "t1", competition: "Liga F7", jornada: 8, updatedAt: Date.UTC(2026, 9, 12, 10), updatedBy: "u", rows: twelve, ...over });

describe("StandingsStrip", () => {
  it("«Vamos 3.º de 12 · 18 pts · J8», a link to the full table", () => {
    render(<StandingsStrip standings={table()} />);
    const link = screen.getByRole("link", { name: /Vamos 3\.º de 12 · 18 pts · J8\. Ver la clasificación de Liga F7/ });
    expect(link).toHaveAttribute("href", "/partidos?view=tabla");
    expect(link).toHaveTextContent("Vamos 3.º de 12 · 18 pts · J8");
  });
  it("no table: nothing at all", () => {
    const { container } = render(<StandingsStrip standings={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StandingsTable", () => {
  it("our row says «Nosotros» in words (and is the current one), with the update date", () => {
    render(<StandingsTable standings={table()} />);
    expect(screen.getByText("Actualizada el 12 oct · Jornada 8 · Liga F7")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(12);
    const us = rows[2];
    expect(us).toHaveAttribute("aria-current", "true");
    expect(within(us).getByText("Nosotros")).toBeInTheDocument();
    expect(within(us).getByRole("rowheader")).toHaveTextContent("3Manchester PitiNosotros");
    expect(screen.getAllByText("Nosotros")).toHaveLength(1);
    // (goal difference with its sign, points last)
    expect(within(us).getAllByRole("cell").map((c) => c.textContent)).toEqual(["8", "5", "3", "0", "20", "9", "+11", "18"]);
  });

  it("arrows against the previous save: up and down, in words for screen readers; none without one", () => {
    const prev = [twelve[0], twelve[1], twelve[3], twelve[2], ...twelve.slice(4)];
    render(<StandingsTable standings={table({ rowsPrev: prev })} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[2]).getByText("Sube 1 puesto")).toBeInTheDocument();
    expect(within(rows[2]).getByText("↑1")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Baja 1 puesto")).toBeInTheDocument();
    expect(within(rows[3]).getByText("↓1")).toBeInTheDocument();
    expect(within(rows[0]).queryByText(/Sube|Baja/)).toBeNull();
  });

  it("the table scrolls in its own focusable, named box", () => {
    render(<StandingsTable standings={table({ rowsPrev: undefined })} />);
    const box = screen.getByRole("region", { name: "Tabla de la clasificación" });
    expect(box).toHaveClass("st-tablebox");
    expect(box).toHaveAttribute("tabindex", "0");
    expect(screen.queryByText(/Sube|Baja/)).toBeNull();
  });
});

describe("/partidos ?view=", () => {
  it("tabla is the only view; anything else is the calendar", () => {
    expect(partidosSearchSchema.parse({ view: "tabla" })).toEqual({ view: "tabla" });
    expect(partidosSearchSchema.parse({ view: "TABLA" }).view).toBeUndefined();
    expect(partidosSearchSchema.parse({ view: 3 }).view).toBeUndefined();
    expect(partidosSearchSchema.parse({}).view).toBeUndefined();
  });
});
