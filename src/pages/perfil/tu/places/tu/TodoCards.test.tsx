import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingItem } from "../../usePending";
import { TodoCards } from "./TodoCards";

const navigate = vi.fn(async () => undefined);
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("../../../bandeja/actions", () => ({ useCandStills: () => () => undefined, isAppPath: (p: string) => p.startsWith("/") && !p.startsWith("//") }));
vi.mock("../../../../../components/vidrio/tu/kit", () => ({ tuGo: (_d: string, f: () => void) => void f() }));

const base = { noticeIds: [], icon: "check" as const, after: "", error: "" };
const flush = () => act(async () => {});

describe("TodoCards", () => {
  it("answers the convocatoria in place, says so with the toast, and moves it to «Lo que ya has hecho»", async () => {
    let value: "yes" | "maybe" | "no" | null = null;
    const pick = vi.fn(async (a: "yes" | "maybe" | "no") => {
      value = a;
    });
    const say = vi.fn();
    const rsvp = (): PendingItem => ({ ...base, kind: "rsvp", key: "rsvp-m3", title: "¿Vas el domingo 8 a Red Demons?", body: "J3 · 18:00 · en casa · contestan 6 de 16", done: !!value, value, busy: false, pick });
    const { rerender } = render(<TodoCards items={[rsvp()]} say={say} calm="Lo próximo: J3." />);
    expect(screen.getByText("Convocatoria · J3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voy" }));
    await flush();
    expect(pick).toHaveBeenCalledWith("yes");
    expect(say).toHaveBeenCalledWith("Apuntado: vas. El capitán ya lo ve.", undefined);
    rerender(<TodoCards items={[rsvp()]} say={say} calm="Lo próximo: J3." />);
    expect(screen.getByText(/Estás al día\./)).toBeTruthy();
    const done = screen.getByRole("list", { name: "Lo que ya has hecho" });
    expect(within(done).getByText(/Vas el domingo 8/)).toBeTruthy();
    // «Cambiar» opens it again
    fireEvent.click(within(done).getByRole("button", { name: /Cambiar/ }));
    expect(screen.getByRole("button", { name: "Voy" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("la caja is private and claims once; the turno offers «Deshacer» through the latest item", async () => {
    const claim = vi.fn(async () => undefined);
    let turnDone = false;
    const mark = vi.fn(async () => {
      turnDone = !turnDone;
    });
    const say = vi.fn();
    const items = (): PendingItem[] => [
      { kind: "caja", key: "caja", title: "Debes 12,50 €", body: "Bizum a Kevin.", owes: true, claimed: false, done: false, busy: false, error: "", claim },
      { ...base, kind: "turno", key: "turno-m3", title: "Te toca el agua", body: "Turnos de la J3. Si no puedes, cámbialo en el vestuario.", done: turnDone, busy: false, mark },
    ];
    const { rerender } = render(<TodoCards items={items()} say={say} />);
    expect(screen.getByText("Solo lo ves tú")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ya la he pagado" }));
    await flush();
    expect(claim).toHaveBeenCalledTimes(1);
    expect(say).toHaveBeenCalledWith("Avisado: el capitán lo apunta en la caja.");
    fireEvent.click(screen.getByRole("button", { name: "Marcar como hecho" }));
    await flush();
    rerender(<TodoCards items={items()} say={say} />);
    const undo: unknown = say.mock.calls.find((c) => c[0] === "Turno hecho. Gracias.")?.[1];
    expect(typeof undo).toBe("function");
    if (typeof undo === "function") undo();
    await flush();
    expect(mark).toHaveBeenCalledTimes(2);
    expect(turnDone).toBe(false);
  });

  it("the porra's steppers and «Guardar pronóstico»; the door goes to La puerta; errors stay on the card", async () => {
    const save = vi.fn(async () => undefined);
    const items: PendingItem[] = [
      { kind: "porra", key: "porra-m3", matchId: "m3", rival: "Red Demons", saved: null, done: false, busy: false, error: "", save },
      { ...base, kind: "door", key: "door", title: "Llaman a la puerta del vestuario", body: "Ana pide entrar.", done: false, path: "/vestuario/puerta" },
      { ...base, kind: "poll", key: "poll-p", title: "Nueva encuesta", body: "Kevin: ¿Cena?", done: false, error: "No se ha guardado tu voto. Inténtalo otra vez.", opts: [{ id: "a", label: "Sí", n: 1, pct: 100, on: false }], pick: vi.fn(async () => undefined) },
    ];
    render(<TodoCards items={items} say={vi.fn()} jornadaOf={() => 3} />);
    expect(screen.getByText("Tu porra · J3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Un gol más del Piti" }));
    fireEvent.click(screen.getByRole("button", { name: "Un gol más del Piti" }));
    fireEvent.click(screen.getByRole("button", { name: "Un gol más del rival" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar pronóstico" }));
    await flush();
    expect(save).toHaveBeenCalledWith(2, 1);
    expect(screen.getByText("1 llama a la puerta")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir La puerta" }));
    await flush();
    expect(navigate).toHaveBeenCalledWith({ href: "/vestuario/puerta" });
    expect(screen.getByRole("alert").textContent).toBe("No se ha guardado tu voto. Inténtalo otra vez.");
  });

  it("nothing open: the calm line", () => {
    render(<TodoCards items={[]} say={vi.fn()} calm="Lo próximo: J3 contra Red Demons." />);
    expect(screen.getByText(/Estás al día\./).parentElement?.textContent).toBe("Estás al día. Lo próximo: J3 contra Red Demons.");
  });
});
