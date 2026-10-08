import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedGuard } from "./guard";
import { GuardProvider } from "./GuardProvider";
import { LayerProvider } from "./layers";
import { useToast } from "./toastContext";
import { ToastProvider } from "./toasts";

vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => (e instanceof Error ? e.message : String(e)) }));

function Frame({ children }: { children: ReactNode }) {
  const app = useRef<HTMLDivElement>(null);
  return (
    <LayerProvider appRef={app}>
      <ToastProvider>
        <GuardProvider>
          <div ref={app}>{children}</div>
        </GuardProvider>
      </ToastProvider>
    </LayerProvider>
  );
}

describe("toasts", () => {
  afterEach(() => vi.useRealTimers());

  it("defer(): shows «Deshacer», commits after the window, undo cancels", async () => {
    vi.useFakeTimers();
    const commit = vi.fn(() => Promise.resolve());
    const onUndo = vi.fn();
    function T() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.defer({ message: "Ficha aprobada · @kevin ya es KEVIN (11).", commit, onUndo })}>
          Aprobar
        </button>
      );
    }
    render(
      <Frame>
        <T />
      </Frame>,
    );
    act(() => screen.getByRole("button", { name: "Aprobar" }).click());
    const status = screen.getAllByRole("status").find((s) => s.classList.contains("adm-toasts"))!;
    expect(status).toHaveTextContent("Ficha aprobada · @kevin ya es KEVIN (11).");
    act(() => screen.getByRole("button", { name: "Deshacer" }).click());
    expect(onUndo).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(commit).not.toHaveBeenCalled();
    // again, without undo: the write happens after 5 s
    act(() => screen.getByRole("button", { name: "Aprobar" }).click());
    await act(async () => {
      vi.advanceTimersByTime(4900);
    });
    expect(commit).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("a second defer() commits the first at once; a failed write shows a red «Reintentar»", async () => {
    vi.useFakeTimers();
    let fail = true;
    const first = vi.fn(() => (fail ? Promise.reject(new Error("sin conexión")) : Promise.resolve()));
    const second = vi.fn(() => Promise.resolve());
    const onError = vi.fn();
    function T() {
      const toast = useToast();
      return (
        <>
          <button type="button" onClick={() => toast.defer({ message: "uno", commit: first, onError, errorMessage: "No se ha podido aprobar la ficha" })}>
            Uno
          </button>
          <button type="button" onClick={() => toast.defer({ message: "dos", commit: second })}>
            Dos
          </button>
        </>
      );
    }
    render(
      <Frame>
        <T />
      </Frame>,
    );
    act(() => screen.getByRole("button", { name: "Uno" }).click());
    await act(async () => {
      screen.getByRole("button", { name: "Dos" }).click();
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se ha podido aprobar la ficha: sin conexión");
    expect(alert.querySelector(".tst.err")).not.toBeNull();
    fail = false;
    await act(async () => {
      screen.getByRole("button", { name: "Reintentar" }).click();
    });
    expect(first).toHaveBeenCalledTimes(2);
  });
});

describe("useUnsavedGuard", () => {
  function Editor({ initialDirty = true, alt }: { initialDirty?: boolean; alt?: () => void }) {
    const [dirty, setDirty] = useState(initialDirty);
    const [open, setOpen] = useState(true);
    const guard = useUnsavedGuard(dirty, { what: "la ficha de ERIK", alt: alt && { label: "Guardar borrador y salir", run: alt } });
    return (
      <div>
        <p>{open ? "cajón abierto" : "cajón cerrado"}</p>
        <button type="button" onClick={() => guard.run(() => setOpen(false))}>
          Cerrar cajón
        </button>
        <button type="button" onClick={() => setDirty(false)}>
          Guardar
        </button>
        {/* a test-only route, outside the app's typed tree */}
        <Link to={"/otra" as "/"}>Ir a otra sección</Link>
      </div>
    );
  }
  function mount(ui: ReactNode) {
    const root = createRootRoute({
      component: () => (
        <Frame>
          <Outlet />
        </Frame>
      ),
    });
    const a = createRoute({ getParentRoute: () => root, path: "/", component: () => <>{ui}</> });
    const b = createRoute({ getParentRoute: () => root, path: "/otra", component: () => <p>otra sección</p> });
    const router = createRouter({ routeTree: root.addChildren([a, b]), history: createMemoryHistory({ initialEntries: ["/"] }) });
    render(<RouterProvider router={router} />);
    return router;
  }

  it("asks before closing a dirty layer: Seguir editando keeps it, Descartar closes it", async () => {
    const user = userEvent.setup();
    mount(<Editor />);
    await user.click(await screen.findByRole("button", { name: "Cerrar cajón" }));
    const ask = screen.getByRole("alertdialog", { name: "¿Salir sin guardar?" });
    expect(ask).toHaveTextContent("Hay cambios sin guardar en la ficha de ERIK · si sales ahora, se pierden.");
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("cajón abierto")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar cajón" }));
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(screen.getByText("cajón cerrado")).toBeInTheDocument());
  });

  it("does not ask when nothing changed", async () => {
    const user = userEvent.setup();
    mount(<Editor initialDirty={false} />);
    await user.click(await screen.findByRole("button", { name: "Cerrar cajón" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("cajón cerrado")).toBeInTheDocument();
  });

  it("blocks a navigation while dirty, and lets it through after «Descartar»", async () => {
    const user = userEvent.setup();
    const router = mount(<Editor />);
    await user.click(await screen.findByRole("link", { name: "Ir a otra sección" }));
    expect(await screen.findByRole("alertdialog", { name: "¿Salir sin guardar?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    await user.click(screen.getByRole("link", { name: "Ir a otra sección" }));
    await user.click(await screen.findByRole("button", { name: "Descartar cambios" }));
    expect(await screen.findByText("otra sección")).toBeInTheDocument();
  });

  it("offers the third action when given", async () => {
    const user = userEvent.setup();
    const alt = vi.fn();
    mount(<Editor alt={alt} />);
    await user.click(await screen.findByRole("button", { name: "Cerrar cajón" }));
    await user.click(screen.getByRole("button", { name: "Guardar borrador y salir" }));
    await waitFor(() => expect(screen.getByText("cajón cerrado")).toBeInTheDocument());
    expect(alt).toHaveBeenCalledTimes(1);
  });
});
