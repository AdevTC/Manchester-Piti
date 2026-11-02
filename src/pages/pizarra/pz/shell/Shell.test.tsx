// r14 «La pizarra»: the shell's regions per layout, the board bar, the dock, the sheets frame, the toast.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithPz } from "../store/testkit";
import { Shell } from "./Shell";

// the web's chrome and the sky need the router and the live data: stand-ins
vi.mock("../../../../components/celeste/Chrome", () => ({ CelesteHeader: () => <header className="vx-top">top</header> }));
vi.mock("../../../../components/vidrio", () => ({ VidrioSky: () => <div className="vd-sky" /> }));
vi.mock("../../../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark", toggle: () => undefined }) }));
vi.mock("../campo/PiCampo", () => ({ PiCampo: ({ layout }: { layout: string }) => <div data-testid="campo" data-layout={layout} /> }));
import "../places";
import "../sheets";

describe("the shell", () => {
  it("desktop: the board bar with the places and their sublabels, lead · stage · side", async () => {
    const { r, flush } = renderWithPz(<Shell />);
    await flush();
    expect(screen.getByRole("navigation", { name: "La pizarra" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Siete: 6 de 7" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /^Plan:/ })).toBeTruthy();
    expect(r.container.querySelector(".pz-s__lead")).toBeTruthy();
    expect(r.container.querySelector(".pz-s__side")).toBeTruthy();
    expect(screen.getByTestId("campo").getAttribute("data-layout")).toBe("desktop");
    expect(r.container.querySelector(".pz-s__save")?.textContent).toMatch(/Guardado/);
  });

  it("the bar follows the store (a later change re-renders it)", async () => {
    const h = renderWithPz(<Shell />);
    await h.flush();
    void act(() => h.P.act.place("alcides", 6));
    await h.flush();
    expect(screen.getByRole("button", { name: "Siete: Listo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Deshacer: ALCIDES al DC/ })).toBeTruthy();
    // the toast with «Deshacer»
    const undo = screen.getByRole("button", { name: "Deshacer" });
    void act(() => fireEvent.click(undo));
    await h.flush();
    expect(screen.getByRole("button", { name: "Siete: 6 de 7" })).toBeTruthy();
  });

  it("phone: the one-line header, the sheet with its grabber and the pizarra dock with «Más»", async () => {
    const h = renderWithPz(<Shell />, { layout: "phone" });
    await h.flush();
    const grab = screen.getByRole("button", { name: "Subir la hoja" });
    void act(() => fireEvent.click(grab));
    expect(h.P.state.sheetH).toBe("half");
    void act(() => fireEvent.keyDown(grab, { key: "ArrowUp" }));
    expect(h.P.state.sheetH).toBe("full");
    const dock = screen.getAllByRole("navigation", { name: "La pizarra" }).at(-1) as HTMLElement;
    expect(dock.querySelectorAll("button")).toHaveLength(5);
    void act(() => fireEvent.click(screen.getByRole("button", { name: "Más" })));
    await h.flush();
    expect(screen.getByRole("dialog", { name: "Más" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Volver a la web/ })).toBeTruthy();
  });

  it("desktop sheets open over the side column, Esc closes them", async () => {
    const h = renderWithPz(<Shell />);
    await h.flush();
    void act(() => h.P.act.openSheet("candidatos", { hueco: 6 }));
    await h.flush();
    const dlg = screen.getByRole("dialog", { name: "Candidatos" });
    expect(dlg.closest(".pz-s__side")).toBeTruthy();
    void act(() => fireEvent.keyDown(dlg, { key: "Escape" }));
    expect(h.P.state.sheet).toBeNull();
  });

  it("the states: cargando, error al leer, the 404 inside the pizarra", async () => {
    const h = renderWithPz(<Shell />);
    void act(() => h.attach({ estado: "cargando" }));
    await h.flush();
    expect(screen.getAllByText("Cargando tus tableros…").length).toBeGreaterThan(0);
    void act(() => h.attach({ estado: "error", error: "Sin permiso para leer los tableros" }));
    await h.flush();
    expect(screen.getByText("Sin permiso para leer los tableros")).toBeTruthy();
    void act(() => h.P.setRoute({ place: "perdido", sub: "/pizarra/nada", q: {} }));
    await h.flush();
    expect(screen.getByRole("heading", { name: "Esta parte de la pizarra no existe" })).toBeTruthy();
  });
});
