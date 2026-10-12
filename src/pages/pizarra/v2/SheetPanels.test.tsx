import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AjustesPanel, CompartirPanel, PlanTab } from "./SheetPanels";
import { intro3dWanted, setIntro3dWanted } from "./intro";
import { SHOW0 } from "./prefs";
import { cartelLayout } from "./cartel";
import { chem } from "./quimica";
import { planNote, tacRows } from "./plan";
import { demoSquad, lineupOf } from "./testkit";

// The sheet's tools beyond the bench, on their own.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L = lineupOf(SEVEN, "2-3-1", sq);

describe("Compartir", () => {
  const cartel = cartelLayout(L, sq, chem(L, sq), { short: "J8 · MAD SKY", date: "dom 8 nov", time: "12:00", called: [...SEVEN, "kevin"] }, "Temporada 1");
  const panel = (o: { ready?: boolean; block?: string | null } = {}) => {
    const onShare = vi.fn();
    const r = render(<CompartirPanel cartel={cartel} block={o.block ?? null} busy={false} ready={o.ready} canLink onShare={onShare} onPng={vi.fn()} onLink={vi.fn()} onBack={vi.fn()} />);
    return { ...r, onShare };
  };

  it("while the PNG is being drawn, «Mandar al grupo» waits (Safari needs it ready inside the tap) and says so", () => {
    const { onShare, rerender } = panel({ ready: false });
    const btn = screen.getByRole("button", { name: "Preparando el cartel…" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    fireEvent.click(btn);
    expect(onShare).not.toHaveBeenCalled();
    rerender(<CompartirPanel cartel={cartel} block={null} busy={false} ready canLink onShare={onShare} onPng={vi.fn()} onLink={vi.fn()} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mandar al grupo" }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("the preview carries the day, the consignas and the banquillo", () => {
    panel();
    expect(screen.getByText("J8 · MAD SKY · 2-3-1 · DOM 8 NOV · 12:00")).toBeInTheDocument();
    expect(screen.getByText("Presión media · Línea media · Salida mixta")).toBeInTheDocument();
    expect(screen.getByText("KEVIN")).toBeInTheDocument();
  });
});

describe("Ajustes · «Ver la presentación en 3D»", () => {
  const ajustes = (v3: boolean, onIntro3d = vi.fn()) =>
    render(
      <AjustesPanel
        show={SHOW0}
        cam="tv"
        v3={v3}
        snd={false}
        day={false}
        grid
        seasons={[]}
        seasonId="t1"
        galLeg={[]}
        onShow={vi.fn()}
        onCam={vi.fn()}
        on3d={vi.fn()}
        onSnd={vi.fn()}
        onDay={vi.fn()}
        onGrid={vi.fn()}
        onSeason={vi.fn()}
        onBack={vi.fn()}
        onIntro3d={onIntro3d}
      />,
    );

  it("opts in on this device (and plays it now); off again forgets it", () => {
    setIntro3dWanted(false);
    const play = vi.fn();
    ajustes(true, play);
    const btn = screen.getByRole("button", { name: "Ver la presentación en 3D" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(intro3dWanted()).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(btn);
    expect(intro3dWanted()).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("with the 3D off it can't be asked for, and says why", () => {
    ajustes(false);
    expect(screen.getByRole("button", { name: "Ver la presentación en 3D" })).toBeDisabled();
    expect(screen.getByText("Enciende el Estadio 3D para verla.")).toBeInTheDocument();
  });
});

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
