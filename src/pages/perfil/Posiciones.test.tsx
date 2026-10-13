import { act, fireEvent, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PositionsInfo } from "./profileData";
import { fakeActions, makeData, noIntro, setUrl, view } from "./testkit";

// /profile › Tu carta › «Tus posiciones»: the player marks where he plays on the map and sends it to the
// captain; the status follows the ficha (pendiente / aprobada / ajustada / rechazada). No Firebase: the
// write is a fake action (its payload is tested in api.test.ts and against the rules).

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, className }: { children?: ReactNode; to: string; params?: Record<string, string>; className?: string }) => (
    <a className={className} href={params ? to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "") : to}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setUrl("");
  noIntro();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const EMPTY: PositionsInfo = { approved: { main: null, also: [] }, proposal: null, state: "ninguna" };
const APPROVED: PositionsInfo = { approved: { main: "MCD", also: ["MC", "DFC"] }, proposal: null, state: "aprobada" };
const PENDING: PositionsInfo = { approved: { main: "MCD", also: ["MC", "DFC"] }, proposal: { main: "MC", also: ["MCO"] }, state: "pendiente" };

const section = () => screen.getByRole("heading", { name: "Tus posiciones" }).closest(".bk") as HTMLElement;
const spot = (code: string) => within(section()).getByRole("button", { name: new RegExp(`^${code} · `) });
const send = () => within(section()).getByRole("button", { name: /Enviar al capitán/ });

describe("Tu carta › Tus posiciones", () => {
  it("va justo después de «Tu ficha», solo con la ficha vinculada", () => {
    const { unmount } = view(makeData({ positions: EMPTY }));
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.indexOf("Tus posiciones")).toBe(headings.indexOf("Tu ficha") + 1);
    expect(within(section()).getByText("Dónde juegas. El capitán lo confirma.")).toBeInTheDocument();
    unmount();
    view(makeData({ state: "pendiente" }));
    expect(screen.queryByRole("heading", { name: "Tus posiciones" })).not.toBeInTheDocument();
  });

  it("sin posiciones: «Aún no has dicho dónde juegas»; marca y envía la propuesta", async () => {
    const actions = fakeActions();
    view(makeData({ positions: EMPTY }), actions);
    expect(within(section()).getByText(/Aún no has dicho dónde juegas/)).toBeInTheDocument();
    expect(send()).toBeDisabled();
    expect(within(section()).queryByRole("button", { name: /Retirar propuesta/ })).not.toBeInTheDocument();
    fireEvent.click(spot("MCD"));
    fireEvent.click(spot("MCD"));
    fireEvent.click(spot("MC"));
    expect(spot("MCD")).toHaveAccessibleName("MCD · Pivote: preferida");
    expect(send()).toBeEnabled();
    await act(async () => {
      fireEvent.click(send());
    });
    expect(actions.proposePositions).toHaveBeenCalledWith({ main: "MCD", also: ["MC"] });
    expect(screen.getByText("Propuesta enviada al capitán")).toBeInTheDocument();
  });

  it("aprobadas: el mapa con las suyas y nada que enviar hasta que cambie algo", () => {
    view(makeData({ positions: APPROVED }));
    expect(within(section()).getByText("Aprobadas por el capitán")).toBeInTheDocument();
    expect(spot("MCD")).toHaveAccessibleName("MCD · Pivote: preferida");
    expect(spot("DFC")).toHaveAccessibleName("DFC · Central: también");
    expect(send()).toBeDisabled();
    fireEvent.click(spot("DC"));
    expect(send()).toBeEnabled();
  });

  it("pendiente: el mapa con la propuesta, lo que hay ahora y «Retirar propuesta»", async () => {
    const actions = fakeActions();
    view(makeData({ positions: PENDING }), actions);
    expect(within(section()).getByText("Pendiente de que el capitán la vea")).toBeInTheDocument();
    expect(within(section()).getByText(/Ahora en tu ficha: Pivote \(MCD\) · también MC, DFC/)).toBeInTheDocument();
    expect(spot("MC")).toHaveAccessibleName("MC · Mediocentro: preferida");
    expect(spot("MCD")).toHaveAccessibleName("MCD · Pivote: sin marcar");
    expect(send()).toBeDisabled();
    await act(async () => {
      fireEvent.click(within(section()).getByRole("button", { name: /Retirar propuesta/ }));
    });
    expect(actions.proposePositions).toHaveBeenCalledWith(null);
    expect(screen.getByText("Propuesta retirada")).toBeInTheDocument();
  });

  it("pendiente: una propuesta nueva sustituye a la anterior", async () => {
    const actions = fakeActions();
    view(makeData({ positions: PENDING }), actions);
    fireEvent.click(spot("DC"));
    expect(send()).toBeEnabled();
    await act(async () => {
      fireEvent.click(send());
    });
    expect(actions.proposePositions).toHaveBeenCalledWith({ main: "MC", also: ["MCO", "DC"] });
  });

  it("ajustada y rechazada: lo dice con palabras (no solo color)", () => {
    const { unmount } = view(makeData({ positions: { ...APPROVED, state: "ajustada" } }));
    expect(within(section()).getByText("El capitán la ajustó")).toBeInTheDocument();
    unmount();
    view(makeData({ positions: { ...APPROVED, state: "rechazada" } }));
    expect(within(section()).getByText("El capitán no la aceptó: siguen las de antes")).toBeInTheDocument();
  });

  it("si no se puede guardar, lo dice en la sección; sin conexión ni lo intenta", async () => {
    const actions = fakeActions({ proposePositions: vi.fn(async () => Promise.reject(new Error("Missing or insufficient permissions."))) });
    view(makeData({ positions: EMPTY }), actions);
    fireEvent.click(spot("DC"));
    await act(async () => {
      fireEvent.click(send());
    });
    expect(within(section()).getByRole("alert")).toHaveTextContent("No se ha podido enviar al capitán. Vuelve a intentarlo.");
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    await act(async () => {
      fireEvent.click(send());
    });
    expect(actions.proposePositions).toHaveBeenCalledTimes(1);
    expect(within(section()).getByRole("alert")).toHaveTextContent(/Sin conexión/);
  });
});
