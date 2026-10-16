import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisEditor } from "./AnalysisEditor";
import { defaultSheet } from "../acta/sheetModel";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
const original: MatchEvent = { id: "p", type: "pass", minute: 2, playerId: "a", receiverId: "b", outcome: "complete", source: "manual" };
const sheet = defaultSheet("s", { rival: "Rival", date: 1, starters: ["a", "b", "c", "d", "e", "f", "g"], bench: [], status: "finished", events: [original] });
const info = (id: string) => ({ id, name: id.toUpperCase(), number: 7, position: "MC" });
function review(extra = {}) {
  const update = vi.fn();
  render(<AnalysisEditor matchId="m" sheet={sheet} update={update} info={info} />);
  fireEvent.click(screen.getByText("Importar análisis de una narración"));
  fireEvent.change(screen.getByLabelText("Análisis estructurado"), { target: { value: JSON.stringify({ format: "piti-actions/v1", matchId: "m", baseRevision: 0, events: [{ ...original, receiverId: "c", sourceRef: "A se la pasa a C" }], ...extra }) } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar importación" }));
  return update;
}
describe("narration import review", () => {
  it("shows before/after and source, edits the proposal, then applies once", () => {
    const update = review();
    const preview = screen.getByRole("region", { name: "Revisión de la importación" });
    expect(preview).toHaveTextContent("1 correcciones");
    const diff = within(preview).getByText("Receptor").closest("div")!;
    expect(diff).toHaveTextContent("AntesB");
    expect(diff).toHaveTextContent("AhoraC");
    expect(preview).toHaveTextContent("A se la pasa a C");
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(within(preview).getByRole("button", { name: "Corregir acción" }));
    const form = screen.getByRole("group", { name: "Editar acción detallada" });
    expect(screen.getByRole("button", { name: "Incorporar al borrador" })).toBeDisabled();
    fireEvent.change(within(form).getByLabelText("Receptor"), { target: { value: "b" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar acción" }));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Incorporar al borrador" }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0](sheet).events[0]).toMatchObject({ receiverId: "b", sourceRef: "A se la pasa a C" });
  });
  it("clears fields that no longer apply when changing the action type", () => {
    const update = review({ events: [{ id: "g", type: "goal", minute: 3, playerId: "a", assistPlayerId: "b", assistReviewed: true }] });
    fireEvent.click(screen.getByRole("button", { name: "Corregir acción" }));
    const form = screen.getByRole("group", { name: "Editar acción detallada" });
    fireEvent.change(within(form).getByLabelText("Acción"), { target: { value: "shot" } });
    fireEvent.change(within(form).getByLabelText("Resultado"), { target: { value: "off_target" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar acción" }));
    expect(screen.getByRole("button", { name: "Incorporar al borrador" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Incorporar al borrador" }));
    const event = update.mock.calls[0][0](sheet).events.find((e: MatchEvent) => e.id === "g");
    expect(event.type).toBe("shot");
    expect(event.assistPlayerId).toBeUndefined();
  });
  it("blocks unresolved questions, links their players/actions and requires an explicit resolution", () => {
    const update = review({ unresolved: [{ question: "¿C o B?", playerIds: ["b", "c"], eventIds: ["p"], sourceRef: "al otro" }] });
    expect(screen.getByRole("button", { name: "Incorporar al borrador" })).toBeDisabled();
    const doubts = screen.getByRole("region", { name: "Dudas de la narración" });
    expect(doubts).toHaveTextContent("B · C");
    expect(within(doubts).getByRole("button", { name: "Revisar Pase · 2′" })).toBeInTheDocument();
    fireEvent.change(within(doubts).getByLabelText("Resolución de la duda 1"), { target: { value: "Fue C, comprobado en el vídeo." } });
    fireEvent.click(within(doubts).getByRole("button", { name: "Guardar resolución" }));
    expect(screen.getByRole("button", { name: "Incorporar al borrador" })).toBeEnabled();
    expect(update).not.toHaveBeenCalled();
  });
});
