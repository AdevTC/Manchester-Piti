import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SalaSheet } from "../shell/Sheet";
import { FrameContext, frameOf } from "./frame";
import { ConfirmModal, LayerProvider } from "./layers";

/** A fake sala: the app (made inert by modal layers) + the layer host. */
function Harness({ children, width = 1440 }: { children: React.ReactNode; width?: number }) {
  const app = useRef<HTMLDivElement>(null);
  return (
    <FrameContext.Provider value={frameOf(width)}>
      <LayerProvider appRef={app}>
        <div ref={app} data-testid="app">
          {children}
        </div>
      </LayerProvider>
    </FrameContext.Provider>
  );
}

function Opener({ danger = false, alt = false, error }: { danger?: boolean; alt?: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState("");
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <p>{done}</p>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        title={danger ? "¿Borrar el partido contra Red Demons?" : "¿Salir en este dispositivo?"}
        lede="Lo que pasa, en una línea."
        consequences={["La primera cosa", "La segunda cosa"]}
        confirmLabel={danger ? "Borrar partido" : "Salir"}
        confirmTone={danger ? "redf" : "sky"}
        alt={alt ? { label: "Guardar y salir", onClick: () => setDone("alt") } : undefined}
        error={error}
        onConfirm={() => {
          setDone("confirmado");
          setOpen(false);
        }}
      />
    </>
  );
}

describe("ConfirmModal (the sala's sheet)", () => {
  it("is a centred alertdialog on the sheet: described by its line, focus inside, Tab trapped, Esc closes and the focus goes back", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Opener />
      </Harness>,
    );
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog", { name: "¿Salir en este dispositivo?" });
    expect(dialog).toHaveClass("sc-sheet", "sc-sheet--center", "sc-confirm");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Lo que pasa, en una línea.");
    expect(dialog).toHaveFocus();
    expect(screen.getByTestId("app")).toHaveAttribute("inert");
    expect(dialog.querySelectorAll(".sc-confirm__cs li")).toHaveLength(2);
    // Tab cycles inside: Cerrar → Cancelar → Salir → back to Cerrar.
    await user.tab();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Salir" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("app")).not.toHaveAttribute("inert");
    expect(trigger).toHaveFocus();
  });

  it("Vidrio buttons at its foot: the alternative, «Cancelar», then the confirmation (the one primary)", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Opener alt />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const foot = screen.getByRole("alertdialog").querySelector(".sc-sheet__f")!;
    const buttons = within(foot as HTMLElement).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Guardar y salir", "Cancelar", "Salir"]);
    for (const b of buttons) expect(b).toHaveClass("vd-btn", "vd-glass", "vd-press");
    expect(buttons[2]).toHaveClass("vd-btn--pri");
    expect(buttons.filter((b) => b.classList.contains("vd-btn--pri"))).toHaveLength(1);
    expect(document.querySelector(".btn")).toBeNull();
    await user.click(buttons[0]);
    expect(screen.getByText("alt")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salir" }));
    expect(screen.getByText("confirmado")).toBeInTheDocument();
  });

  it("a destructive one says so in a word and an icon, not only in its colour", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Opener danger />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const dialog = screen.getByRole("alertdialog", { name: "¿Borrar el partido contra Red Demons?" });
    expect(dialog).toHaveClass("is-danger");
    const go = screen.getByRole("button", { name: "Borrar partido" });
    expect(go).toHaveClass("sc-danger");
    expect(go).not.toHaveClass("vd-btn--pri");
    expect(go.querySelector("svg.sc-confirm__warn")).not.toBeNull();
    // every consequence carries the warning mark
    expect(dialog.querySelectorAll(".sc-confirm__cs svg.sc-confirm__warn")).toHaveLength(2);
  });

  it("an error is an alert above the buttons; busy and disabled keep the confirmation focusable and inert", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function C({ busy = false }: { busy?: boolean }) {
      const [open, setOpen] = useState(true);
      return <ConfirmModal open={open} onClose={() => setOpen(false)} title="Crear temporada" confirmLabel="Crear" confirmDisabled={!busy} busy={busy} error="No se ha podido: sin conexión" onConfirm={onConfirm} />;
    }
    const { unmount } = render(
      <Harness>
        <C />
      </Harness>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido: sin conexión");
    await user.click(screen.getByRole("button", { name: "Crear" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear" })).toHaveAttribute("aria-disabled", "true");
    // the scrim closes it
    fireEvent.click(document.querySelector(".sc-scrim")!);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    unmount();
    render(
      <Harness>
        <C busy />
      </Harness>,
    );
    const wait = screen.getByRole("button", { name: "Un momento…" });
    expect(wait).toHaveAttribute("aria-disabled", "true");
    await user.click(wait);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("over another sheet: the sheet below goes inert and Esc closes only the top one", async () => {
    const user = userEvent.setup();
    function Two() {
      const [sheet, setSheet] = useState(false);
      const [ask, setAsk] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setSheet(true)}>
            Abrir ficha
          </button>
          <SalaSheet open={sheet} onClose={() => setSheet(false)} title="ERIK">
            <button type="button" onClick={() => setAsk(true)}>
              Dar de baja
            </button>
          </SalaSheet>
          <ConfirmModal open={ask} onClose={() => setAsk(false)} title="¿Dar de baja a ERIK?" confirmLabel="Dar de baja a ERIK" confirmTone="redf" onConfirm={() => setAsk(false)} />
        </>
      );
    }
    render(
      <Harness>
        <Two />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Abrir ficha" }));
    await user.click(screen.getByRole("button", { name: "Dar de baja" }));
    // (covered, it is aria-hidden too: no accessible name to find it by)
    const sheet = document.querySelector(".sc-sheet:not(.sc-confirm)")!;
    expect(sheet).toHaveAttribute("inert");
    expect(sheet).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "ERIK" })).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Dar de baja" })).toHaveFocus();
  });
});
