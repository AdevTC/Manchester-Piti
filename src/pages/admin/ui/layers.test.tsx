import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FrameContext, frameOf } from "./frame";
import { ConfirmModal, Drawer, LayerProvider, Modal, Popover } from "./layers";

vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));

/** A fake admin frame: the app (made inert by modal layers) + the layer host. */
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

function DrawerWithModal() {
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setDrawer(true)}>
        Abrir cajón
      </button>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="ERIK" status={{ text: "● Cambios sin guardar", tone: "warn" }} footer={<button type="button">Guardar</button>}>
        <input aria-label="Nombre" />
        <button type="button" onClick={() => setModal(true)}>
          Dar de baja
        </button>
      </Drawer>
      <ConfirmModal
        open={modal}
        onClose={() => setModal(false)}
        title="¿Dar de baja a ERIK?"
        lede="Deja la plantilla."
        consequences={["Su camiseta deja la percha", "Sus actas y su carta se quedan"]}
        confirmLabel="Dar de baja"
        confirmTone="redf"
        onConfirm={() => setModal(false)}
      />
    </>
  );
}

describe("layers", () => {
  it("a modal focuses itself, traps Tab, closes on Esc and gives the focus back", async () => {
    const user = userEvent.setup();
    function One() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="Nuevo partido" lede="Lo mínimo." footer={<button type="button">Crear partido</button>}>
            <input aria-label="Rival" />
          </Modal>
        </>
      );
    }
    render(
      <Harness>
        <One />
      </Harness>,
    );
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Nuevo partido" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Lo mínimo.");
    expect(dialog).toHaveFocus();
    expect(screen.getByTestId("app")).toHaveAttribute("inert");
    expect(screen.getByTestId("app")).toHaveAttribute("aria-hidden", "true");
    expect(dialog).toHaveClass("md");
    // Tab cycles: Rival → Crear partido → back to Rival.
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Rival" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Crear partido" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Rival" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Crear partido" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("app")).not.toHaveAttribute("inert");
    expect(trigger).toHaveFocus();
  });

  it("stacks: a modal over a drawer makes the drawer inert, Esc closes only the top", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <DrawerWithModal />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Abrir cajón" }));
    const drawer = screen.getByRole("dialog", { name: "ERIK" });
    expect(screen.getByRole("status")).toHaveTextContent("Cambios sin guardar");
    const baja = screen.getByRole("button", { name: "Dar de baja" });
    await user.click(baja);
    const confirm = screen.getByRole("alertdialog", { name: "¿Dar de baja a ERIK?" });
    expect(confirm).toHaveFocus();
    expect(drawer).toHaveAttribute("inert");
    expect(confirm).toHaveClass("md", "dz");
    expect(confirm.querySelectorAll(".cs li")).toHaveLength(2);
    expect(drawer).toHaveClass("drw", "ovl");
    // Two scrims: the second one dims the drawer.
    expect(document.querySelectorAll(".scrim")).toHaveLength(2);
    expect(document.querySelector(".scrim.hi")).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "ERIK" })).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Dar de baja" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir cajón" })).toHaveFocus();
  });

  it("the scrim closes the top layer; aria-disabled confirm does nothing", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function C() {
      const [open, setOpen] = useState(true);
      return <ConfirmModal open={open} onClose={() => setOpen(false)} title="Crear temporada" confirmLabel="Crear" confirmDisabled onConfirm={onConfirm} />;
    }
    render(
      <Harness>
        <C />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Crear" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(document.querySelector(".scrim")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  function PopoverHost() {
    const [open, setOpen] = useState(false);
    const anchor = useRef<HTMLButtonElement>(null);
    return (
      <div className="scr">
        <div style={{ position: "relative" }}>
          <button type="button" ref={anchor} onClick={() => setOpen((o) => !o)}>
            Elegir
          </button>
          <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchor} title="¿Quién marcó?" subtitle="Gol 3 · paso 1 de 2" footer={<button type="button">Lo completo luego</button>}>
            <button type="button">ERIK</button>
          </Popover>
          <button type="button">Fuera</button>
        </div>
      </div>
    );
  }

  it("a popover opens in place, closes on Esc / outside and returns focus to its anchor", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <PopoverHost />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Elegir" }));
    const pop = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    expect(pop).toHaveClass("picker");
    expect(pop).not.toHaveAttribute("aria-modal");
    expect(pop).toHaveFocus();
    expect(pop).toHaveTextContent("Gol 3 · paso 1 de 2");
    expect(screen.getByTestId("app")).not.toHaveAttribute("inert");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Elegir" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Elegir" }));
    await user.click(screen.getByRole("button", { name: "Fuera" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("on a phone-width frame the popover is a bottom sheet (modal)", async () => {
    const user = userEvent.setup();
    render(
      <Harness width={390}>
        <PopoverHost />
      </Harness>,
    );
    await user.click(screen.getByRole("button", { name: "Elegir" }));
    const sheet = screen.getByRole("dialog", { name: "¿Quién marcó?" });
    expect(sheet).toHaveClass("sheet");
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(sheet).toHaveTextContent("Gol 3 · paso 1 de 2");
    expect(screen.getByTestId("app")).toHaveAttribute("inert");
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Elegir" })).toHaveFocus();
  });
});
