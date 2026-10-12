import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { JugadasPanel, type JugadaEditorView, type JugadasPanelProps } from "./JugadasPanel";
import type { ReplayHud } from "./jugadas";

// Writing a paso's title or note while the replay plays: the replay stops when the field gets the focus,
// so the paso on screen (and the field, keyed by it) can't change under the text; the text is kept when
// the field is left, on the paso it was written for.

const hud: ReplayHud = { bugA: "", bugB: "", bugK: "", bugAria: "", ticks: [], pct: "0", lab: "1/3", stepT: "Colocación", stepD: "" };
const editor = (cur: number): JugadaEditorView => ({
  id: "j1",
  name: "Tu jugada 1",
  own: true,
  pasos: [0, 1, 2].map((i) => ({ title: "Paso " + (i + 1), cur: i === cur })),
  cur,
  title: "",
  note: "",
  rivals: 5,
  rivalMarked: false,
  missing: 0,
  gone: 0,
  errors: [],
});
const noop = () => undefined;

/** The board's side of it: the replay plays and, while it plays, a tick moves it to the next paso. */
function Harness({ onTitle, onNote }: { onTitle: (cur: number, v: string) => void; onNote: (cur: number, v: string) => void }) {
  const [playing, setPlaying] = useState(true);
  const [cur, setCur] = useState(0);
  const props: JugadasPanelProps = {
    hud,
    frame: cur,
    n: 3,
    playing,
    v3: false,
    rate: 1,
    onion: false,
    trails: true,
    riv: true,
    ball: true,
    lib: [],
    canEdit: true,
    note3d: null,
    editor: editor(cur),
    onToggle: () => setPlaying((v) => !v),
    onStep: noop,
    onSeek: setCur,
    on3d: noop,
    onRate: noop,
    onOnion: noop,
    onTrails: noop,
    onRiv: noop,
    onBall: noop,
    onPick: noop,
    onAddPaso: noop,
    onNew: noop,
    onCharla: noop,
    onRename: noop,
    onDuplicate: noop,
    onDelete: noop,
    onPaso: setCur,
    onMovePaso: noop,
    onCopyPaso: noop,
    onDelPaso: noop,
    onTitle: (v) => onTitle(cur, v),
    onNote: (v) => onNote(cur, v),
    onAddRival: noop,
    onDelRival: noop,
    onAddMissing: noop,
    onDropGone: noop,
  };
  return (
    <>
      {/* the replay's beat */}
      <button type="button" onClick={() => playing && setCur((c) => (c + 1) % 3)}>
        tick
      </button>
      <JugadasPanel {...props} />
    </>
  );
}

describe("Jugadas · writing a paso while the replay plays", () => {
  it("the replay stops on focus, so the text survives its beat and is kept on the paso it was written for", () => {
    const onTitle = vi.fn();
    const onNote = vi.fn();
    render(<Harness onTitle={onTitle} onNote={onNote} />);
    expect(screen.getByRole("button", { name: "Pausar la repetición" })).toBeInTheDocument();
    const title = screen.getByLabelText("Título del paso 1");
    act(() => title.focus());
    expect(screen.getByRole("button", { name: "Reproducir la repetición" })).toBeInTheDocument();
    fireEvent.change(title, { target: { value: "Arranca el 9" } });
    // the replay's beat comes: nothing moves while it is paused
    fireEvent.click(screen.getByRole("button", { name: "tick" }));
    expect(screen.getByLabelText("Título del paso 1")).toHaveValue("Arranca el 9");
    fireEvent.blur(screen.getByLabelText("Título del paso 1"));
    expect(onTitle).toHaveBeenCalledWith(0, "Arranca el 9");
    // the note too
    const note = screen.getByLabelText("Nota del paso");
    fireEvent.focus(note);
    fireEvent.change(note, { target: { value: "Al primer palo" } });
    fireEvent.blur(note);
    expect(onNote).toHaveBeenCalledWith(0, "Al primer palo");
  });

  it("a paused replay stays paused (focus never starts it)", () => {
    render(<Harness onTitle={vi.fn()} onNote={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pausar la repetición" }));
    fireEvent.focus(screen.getByLabelText("Título del paso 1"));
    expect(screen.getByRole("button", { name: "Reproducir la repetición" })).toBeInTheDocument();
  });
});
