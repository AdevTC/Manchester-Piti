import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeBoard, fakeLineup, fakeWorld, ME_CAPTAIN, ME_PLAYER, renderWithPz } from "../../store/testkit";
import type { PzMatch } from "../../store/types";
import { EMPTY_FEED, type PtFeed } from "./partidoView";

// (the feed reads Firebase: the tests hand the slice in themselves)
vi.mock("./feed", () => ({ PtFeedBridge: () => null }));
const { Partido } = await import("./Partido");

const SEVEN = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];
const CODES = ["POR", "DFC", "LI", "LD", "MC", "MC", "DC"] as const;
const lineup = { system: "3-2-1", slots: SEVEN.map((p, i) => ({ playerId: p, code: CODES[i], x: 10 + i * 10, y: 90 - i * 10 })), boardId: "b1", setAt: 0 };
const feed = (o: Partial<PtFeed> = {}): PtFeed => ({ ...EMPTY_FEED, matchId: "j3", lineup, present: [...SEVEN, "kevin"], ...o });
function world(phase: PzMatch["phase"]) {
  const W = fakeWorld();
  const L = { ...fakeLineup("3-2-1", SEVEN), subs: [{ id: "s1", min: 25, out: "eguzquiza", in: "kevin" }] };
  return { ...W, matches: [{ ...W.matches[0], phase, at: W.now + 50 * 60000 }], boards: [fakeBoard({ isOfficial: true, lineup: L })], official: { boardId: "b1", matchId: "j3" } };
}

describe("Partido · the regions", () => {
  it("before: the countdown, la mesa with «Mandar a la mesa», who goes; the stage shows the official", async () => {
    const h = renderWithPz(<Partido region="lead" layout="desktop" />, { world: world("antes"), place: "partido", me: ME_CAPTAIN });
    act(() => void h.P.slice("pt-feed").set(feed({ lineup: null }), { undoable: false, toast: false }));
    await h.flush();
    expect(screen.getByRole("heading", { level: 1, name: "Faltan 50 min" })).toBeInTheDocument();
    expect(screen.getByText("Sin siete")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mandar a la mesa" }));
    expect(h.P.state.sheet?.name).toBe("pt-mesa");
    expect(h.P.state.stage).toMatchObject({ source: "siete", boardId: "b1" });
  });

  it("live, side: the next change with its ring, the confirm and the H key; a player reads it locked", async () => {
    const h = renderWithPz(<Partido region="side" layout="desktop" />, { world: world("juego"), place: "partido", me: ME_CAPTAIN });
    act(() => void h.P.slice("pt-feed").set(feed({ minute: 23, clock: "first" }), { undoable: false, toast: false }));
    await h.flush();
    expect(screen.getByRole("heading", { level: 2, name: /Entra KEVIN/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Faltan 2 minutos para el cambio" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hacer el cambio/ }));
    await h.flush();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Apuntar en el acta, 23′: entra KEVIN por EGUZQUIZA?");
    const p = renderWithPz(<Partido region="side" layout="desktop" />, { world: world("juego"), place: "partido", me: ME_PLAYER });
    act(() => void p.P.slice("pt-feed").set(feed({ minute: 23, clock: "first" }), { undoable: false, toast: false }));
    await p.flush();
    expect(p.r.container.querySelector(".pt-ro")).toHaveTextContent("Los cambios los apuntan los capitanes");
  });

  it("live, lead: the scoreboard as one heading and «Tú» for a player on the pitch", async () => {
    const h = renderWithPz(<Partido region="lead" layout="desktop" />, { world: world("juego"), place: "partido", me: ME_PLAYER });
    act(() => void h.P.slice("pt-feed").set(feed({ minute: 23, clock: "first", events: [{ id: "g", type: "goal", minute: 6, playerId: "alcides" }] as PtFeed["events"] }), { undoable: false, toast: false }));
    await h.flush();
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(/Manchester Piti 1, Red Demons 0/);
    expect(screen.getByText(/Estás en el campo de LI · 23′ hoy/)).toBeInTheDocument();
    expect(screen.getByText("Gol de ALCIDES")).toBeInTheDocument();
  });

  it("B-PZ-19: «Volver a la mesa» only for who came from la mesa (?desde=mesa)", async () => {
    const a = renderWithPz(<Partido region="lead" layout="desktop" />, { world: world("antes"), place: "partido", me: ME_CAPTAIN });
    await a.flush();
    expect(screen.queryByRole("link", { name: /Volver a la mesa/ })).toBeNull();
    a.r.unmount();
    const b = renderWithPz(<Partido region="lead" layout="desktop" />, { world: world("antes"), place: "partido", me: ME_CAPTAIN, q: { desde: "mesa", partido: "j3" } });
    await b.flush();
    expect(screen.getByRole("link", { name: /Volver a la mesa/ })).toHaveAttribute("href", "/partidos/j3/mesa");
  });

  it("B-PZ-21: one key, one name — H asks for «Hacer el cambio», M proposes «Recalcular desde el 23′»", async () => {
    const h = renderWithPz(<Partido region="lead" layout="desktop" />, { world: world("juego"), place: "partido", me: ME_CAPTAIN });
    act(() => void h.P.slice("pt-feed").set(feed({ minute: 23, clock: "first" }), { undoable: false, toast: false }));
    await h.flush();
    fireEvent.keyDown(document, { key: "h" });
    expect(h.P.slice<{ confirm: string }>("partido").get().confirm).toBe("next");
    fireEvent.keyDown(document, { key: "m" });
    expect(h.P.slice<{ prop: { kind: string } | null }>("partido").get().prop?.kind).toBe("recalc");
  });

  it("B-PZ-22: the match's scorer (not a captain) makes the change; a plain player can't (H does nothing)", async () => {
    const s = renderWithPz(<Partido region="side" layout="desktop" />, { world: world("juego"), place: "partido", me: ME_PLAYER });
    act(() => void s.P.slice("pt-feed").set(feed({ minute: 23, clock: "first", scorer: true }), { undoable: false, toast: false }));
    await s.flush();
    expect(screen.getByRole("button", { name: /Hacer el cambio/ })).toBeEnabled();
    s.r.unmount();
    const p = renderWithPz(<Partido region="lead" layout="desktop" />, { world: world("juego"), place: "partido", me: ME_PLAYER });
    act(() => void p.P.slice("pt-feed").set(feed({ minute: 23, clock: "first" }), { undoable: false, toast: false }));
    await p.flush();
    fireEvent.keyDown(document, { key: "h" });
    expect(p.P.slice<{ confirm: string }>("partido").get().confirm).toBe("");
  });

  it("phone peek: the next change at the thumb, «Sí, apuntar» in place", async () => {
    const h = renderWithPz(<Partido region="peek" layout="phone" />, { world: world("juego"), place: "partido", me: ME_CAPTAIN, layout: "phone" });
    act(() => void h.P.slice("pt-feed").set(feed({ minute: 23, clock: "first" }), { undoable: false, toast: false }));
    await h.flush();
    expect(screen.getByRole("heading", { level: 1, name: "Entra KEVIN" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hacer el cambio/ }));
    await h.flush();
    expect(screen.getByRole("button", { name: /Sí, apuntar/ })).toBeInTheDocument();
  });
});
