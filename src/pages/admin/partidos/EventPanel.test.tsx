import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { LayerProvider } from "../ui/layers";
import { EventPanel } from "./EventPanel";
import { fieldAt, pickOptions } from "./pickModel";

const NAMES: Record<string, string> = { a: "ANA", b: "BEA", c: "CRIS", d: "DANI", e: "EVA", f: "FER", g: "GUS", h: "HUGO", i: "IVÁN" };
const info = (id: string) => ({ name: NAMES[id] ?? id, number: Object.keys(NAMES).indexOf(id) + 1 });
const sheet = { starters: ["a", "b", "c", "d", "e", "f", "g"], bench: ["h", "i"], notCalled: [], duration: 50, events: [{ id: "s1", type: "substitution", minute: 10, playerId: "a", inPlayerId: "h" }] as MatchEvent[] };

function Panel({ event = null, onSave }: { event?: MatchEvent | null; onSave: (e: MatchEvent) => void }) {
  const app = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <LayerProvider appRef={app}>
      <div ref={app}>
        <button ref={anchor} type="button">+</button>
        <EventPanel
          group="cam"
          title="Cambios"
          event={event}
          newId="n1"
          duration={50}
          field={pickOptions(sheet.starters, info)}
          bench={pickOptions(sheet.bench, info)}
          fieldAt={(m) => pickOptions(fieldAt(sheet, m, event?.id), info)}
          anchorRef={anchor}
          onSave={onSave}
          onRemove={() => {}}
          onClose={() => {}}
        />
      </div>
    </LayerProvider>
  );
}

describe("EventPanel · «Cambio de sitio»", () => {
  it("asks the minute, then the two on the pitch at it, and saves the swap", () => {
    const onSave = vi.fn();
    render(<Panel onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Cambio de sitio" }));
    expect(screen.getByText(/pon el minuto y te enseño quién estaba en el campo/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Minuto"), { target: { value: "12" } });
    expect(screen.getByText("Cambio de sitio: ¿quiénes se cambian?")).toBeInTheDocument();
    // (at 12′ Hugo is on, Ana is off, Iván is still on the bench)
    expect(screen.getByRole("button", { name: /^Se cambia HUGO/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Se cambia ANA/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Se cambia IVÁN/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Se cambia HUGO/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Se cambia con CRIS/ }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "n1", type: "position_swap", minute: 12, playerId: "h", inPlayerId: "c" }));
  });
  it("won't save a swap with someone off the pitch at that minute", () => {
    const onSave = vi.fn();
    render(<Panel onSave={onSave} event={{ id: "w1", type: "position_swap", minute: 12, playerId: "c", inPlayerId: "d" }} />);
    // moved before the change: Hugo wasn't on yet
    fireEvent.change(screen.getByLabelText("Minuto"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Se cambia con ANA/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "w1", type: "position_swap", minute: 5, playerId: "c", inPlayerId: "a" }));
    onSave.mockClear();
    fireEvent.change(screen.getByLabelText("Minuto"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("En el minuto 20 los dos tienen que estar en el campo.");
    expect(onSave).not.toHaveBeenCalled();
  });
});
