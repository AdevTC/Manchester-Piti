import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { JornadaRow, SeasonFigures } from "../../me";
import { focusOf } from "../partidosView";
import { FocusPanel, FocusSheet } from "./Focus";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, params }: { children: ReactNode; className?: string; params: { matchId: string } }) => (
    <a className={className} href={`/partidos/${params.matchId}`}>
      {children}
    </a>
  ),
}));

const T = Date.UTC(2026, 9, 18, 10);
const base: JornadaRow = { matchId: "j1", j: 1, jLabel: "J1", kind: "played", rival: "Orduña", home: true, dateMs: T, status: "finished", gf: 1, ga: 8, result: "P", dur: 50, min: 40, start: true, pos: "LD", posLong: "Lateral derecho", stints: [{ from: 0, to: 40 }], g: 0, a: 0, nota: 4.7, notaText: "4,7", band: "s5", bandWord: "Baja", ledger: [{ k: "recoveries", label: "Recuperaciones", v: 3 }], mvp: false, answer: null, reason: null };
const j2: JornadaRow = { ...base, matchId: "j2", j: 2, jLabel: "J2", kind: "didnt", rival: "Pitutis", home: false, gf: 3, ga: 8, min: null, stints: [], nota: null, notaText: "—", band: "no", bandWord: "Sin nota", ledger: [] };
const rows = [base, j2];
const fig: SeasonFigures = { jornadas: 2, played: 1, minutes: 40, average: 4.7, best: base, goals: 0, assists: 0, ga: 0, mvps: 0 };

describe("the jornada in focus", () => {
  it("desktop: the panel with A's match sheet — the nota and its word, the result with our score first, the minutes, the acta", () => {
    const go = vi.fn();
    render(<FocusPanel fo={focusOf(rows, 0, fig)!} rsvp={null} go={go} panelRef={null} />);
    expect(screen.getByRole("heading", { name: "Tu partido contra Orduña" })).toBeInTheDocument();
    expect(screen.getByText("4,7")).toHaveClass("tf-nb--hero", "is-s5");
    expect(screen.getByText("Baja")).toBeInTheDocument();
    expect(screen.getByText("1–8")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "En el campo del 0′ al 40′, de 50" })).toBeInTheDocument();
    expect(screen.getByText("Recuperaciones")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver el acta/ })).toHaveAttribute("href", "/partidos/j1");
    fireEvent.click(screen.getByRole("button", { name: "Jornada siguiente: J2 contra Pitutis" }));
    expect(go).toHaveBeenCalledWith(1);
  });
  it("phone: the same as a dialog; ← → step, Esc closes", () => {
    const go = vi.fn();
    const onClose = vi.fn();
    render(<FocusSheet fo={focusOf(rows, 1, fig)!} rsvp={null} go={go} onClose={onClose} />);
    const dlg = screen.getByRole("dialog", { name: "Perdimos 3–8 contra Pitutis" });
    expect(dlg).toHaveFocus();
    expect(screen.getByText("No jugaste")).toBeInTheDocument();
    fireEvent.keyDown(dlg, { key: "ArrowLeft" });
    expect(go).toHaveBeenCalledWith(0);
    fireEvent.keyDown(dlg, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
