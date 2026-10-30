import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchEvent, MatchSheet } from "../../../../../functions/src/matchEngine";
import { defaultSheet, toPayload } from "../../acta/sheetModel";
import { reviewMatch } from "../../acta/review";
import { NarracionScreen } from "./Narracion";

const state = vi.hoisted(() => ({ matchId: "m", sheet: null as MatchSheet | null, update: vi.fn(), show: vi.fn() }));
vi.mock("./sheetSession", () => ({ useSheetSession: () => ({
  match: { id: state.matchId }, sheet: state.sheet, value: state.sheet, j: "J2", loading: false,
  update: state.update, info: (id: string) => ({ name: id.toUpperCase(), number: 7 }),
}) }));
vi.mock("./parts", () => ({ ActaNav: () => null, ActaFoot: () => null }));
vi.mock("../../partido/partidoContext", () => ({ usePartido: () => ({ match: { id: state.matchId } }) }));
vi.mock("../../palette/matchShortcuts", () => ({ useMatchShortcuts: () => {} }));
vi.mock("../../shell/salaHref", () => ({ useSalaGo: () => vi.fn() }));
vi.mock("../../shell/statusContext", () => ({ useStatus: () => ({ show: state.show }) }));
vi.mock("../../partidos/NarrationHistory", () => ({ NarrationHistory: () => null }));

const events: MatchEvent[] = [
  { id: "sub", type: "substitution", minute: 1, playerId: "a", inPlayerId: "h" },
  { id: "goal", type: "goal", minute: 3, playerId: "a", assistReviewed: true },
];
function paste(actions = events, extra = {}) {
  fireEvent.change(screen.getByLabelText("O pega el análisis estructurado"), { target: { value: JSON.stringify({ format: "piti-actions/v1", matchId: state.matchId, baseRevision: 0, events: actions, ...extra }) } });
}
function review(actions = events, extra = {}) {
  paste(actions, extra);
  fireEvent.click(screen.getByRole("button", { name: "Revisar importación" }));
}
beforeEach(() => {
  sessionStorage.clear();
  state.matchId = "m";
  state.sheet = defaultSheet("s", { rival: "Rival", date: 1, starters: ["a", "b", "c", "d", "e", "f", "g"], bench: ["h"], status: "finished", events: [] });
  state.update.mockReset();
  state.show.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

describe("Narración · borrador con incidencias", () => {
  it("requires explicit acceptance, preserves the score and warns until the missing return is corrected", () => {
    const { rerender } = render(<NarracionScreen />);
    review();
    expect(screen.getByRole("button", { name: "Incorporar al acta" })).toBeDisabled();
    expect(screen.getByText(/no podrás publicar el acta hasta resolver/)).toBeInTheDocument();
    expect(state.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Incorporar al borrador con incidencias" }));
    expect(state.update).toHaveBeenCalledTimes(1);
    state.sheet = state.update.mock.calls[0][0](state.sheet);
    expect(state.sheet).toMatchObject({ events, goalsFor: 1 });
    expect(toPayload(state.sheet!, true, id => id ?? "")).toMatchObject({ ok: true, sheet: { goalsFor: 1 } });
    expect(reviewMatch(state.sheet!, [...state.sheet!.starters, ...state.sheet!.bench], Date.now(), false, id => id ?? "").cuadra).toBe(false);
    rerender(<NarracionScreen />);
    expect(screen.getByText("Minutos provisionales")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ver 1 incidencias de la secuencia"));
    expect(screen.getByText(/el jugador no está disponible en el campo/)).toBeVisible();
    state.sheet = { ...state.sheet!, events: [...state.sheet!.events, { id: "return", type: "substitution", minute: 2, playerId: "h", inPlayerId: "a" }] };
    rerender(<NarracionScreen />);
    expect(screen.queryByText("Minutos provisionales")).not.toBeInTheDocument();
  });

  it("requires a fresh comparison if the draft changed during the review", () => {
    const { rerender } = render(<NarracionScreen />);
    review();
    state.sheet = { ...state.sheet!, report: "Corrección remota" };
    rerender(<NarracionScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Incorporar al borrador con incidencias" }));
    expect(state.update).not.toHaveBeenCalled();
    expect(screen.getByText(/El borrador ha cambiado durante la revisión/)).toBeInTheDocument();
  });

  it.each([
    { actions: [{ id: "goal", type: "goal", minute: 3, playerId: "outsider" }] as MatchEvent[], extra: {} },
    { actions: events, extra: { unresolved: ["¿Quién vuelve al campo?"] } },
  ])("does not offer the exception for unknown identities or unanswered questions", ({ actions, extra }) => {
    render(<NarracionScreen />);
    review(actions, extra);
    expect(screen.getByRole("button", { name: "Incorporar al acta" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Incorporar al borrador con incidencias" })).not.toBeInTheDocument();
    expect(state.update).not.toHaveBeenCalled();
  });

  it("automatically reviews pasted actions but waits for explicit draft acceptance", async () => {
    vi.useFakeTimers();
    render(<NarracionScreen />);
    paste();
    expect(screen.queryByRole("region", { name: "Revisión de la importación" })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(screen.getByRole("button", { name: "Incorporar al borrador con incidencias" })).toBeEnabled();
    expect(state.update).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem("mp_narr_import_m")!).text).toContain('"matchId":"m"');
    fireEvent.click(screen.getByRole("button", { name: "Incorporar al borrador con incidencias" }));
    expect(sessionStorage.getItem("mp_narr_import_m")).toBeNull();
    expect(screen.getByText(/Pulsa «Guardar borrador»/)).toBeInTheDocument();
  });

  it("a manual review cancels the automatic timer so a changed draft still needs a fresh comparison", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<NarracionScreen />);
    review();
    state.sheet = { ...state.sheet!, report: "Otra corrección remota" };
    rerender(<NarracionScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    fireEvent.click(screen.getByRole("button", { name: "Incorporar al borrador con incidencias" }));
    expect(state.update).not.toHaveBeenCalled();
    expect(screen.getByText(/El borrador ha cambiado durante la revisión/)).toBeInTheDocument();
  });

  it("restores each match's pending import without copying it into another match", async () => {
    vi.useFakeTimers();
    const first = render(<NarracionScreen />);
    paste();
    const stored = sessionStorage.getItem("mp_narr_import_m");
    first.unmount();
    const restored = render(<NarracionScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(screen.getByRole("button", { name: "Incorporar al borrador con incidencias" })).toBeEnabled();
    state.matchId = "other";
    restored.rerender(<NarracionScreen />);
    expect(screen.getByLabelText("O pega el análisis estructurado")).toHaveValue("");
    expect(sessionStorage.getItem("mp_narr_import_other")).toBeNull();
    expect(sessionStorage.getItem("mp_narr_import_m")).toBe(stored);
    expect(state.update).not.toHaveBeenCalled();
  });
});
