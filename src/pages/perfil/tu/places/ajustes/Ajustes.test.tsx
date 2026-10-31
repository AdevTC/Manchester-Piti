import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaceProps } from "../types";

// Ajustes with production-shaped data: the index and its hints, Tu nombre's two forms with their own busy flags,
// Cuenta's ?salir=1 and the baja's «Entiendo…» step, Capitanía's door notice following the device.
const st = vi.hoisted(() => ({
  ready: true,
  navigate: vi.fn(),
  toggleTopic: vi.fn(async (..._a: unknown[]) => undefined),
}));
vi.mock("../../../bandeja/device", () => ({
  useThisDevice: () => ({ kind: st.ready ? "listo" : "bloqueados", ready: st.ready, line: "Todo", choice: "todo", vibrate: true, pause: null, words: {}, blocked: "", setPreset: vi.fn(), setVibrate: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => st.navigate }));
vi.mock("../../../../../lib/push", () => ({ toggleTopic: st.toggleTopic, pushSaveError: () => "No se ha podido guardar." }));
vi.mock("../../../../../lib/clubApi", () => ({ apiError: (e: { message?: string }) => e.message ?? "No se ha podido guardar" }));
vi.mock("./Avisos", () => ({ default: () => <p>A medida</p> }));

const { Ajustes } = await import("../Ajustes");

const NOW = Date.UTC(2026, 9, 31, 12);
type Over = { aj?: PlaceProps["screen"]["aj"]; kind?: "jugador" | "socio"; captain?: boolean; salir?: boolean; superadmin?: boolean; topics?: string[] };
function props(o: Over = {}) {
  const actions = {
    setShirtName: vi.fn(async (n: string) => ({ shirtName: n, previous: "JORDI" })),
    setNickname: vi.fn(async (n: string) => n),
    nicknameTaken: vi.fn(async () => false),
    cancelClaim: vi.fn(),
    requestClaim: vi.fn(),
    proposePositions: vi.fn(),
    signOut: vi.fn(async () => undefined),
    leaveVestuario: vi.fn(async () => undefined),
  };
  const go = vi.fn();
  const say = vi.fn();
  const p = {
    data: {
      uid: "uid-jordi",
      nickname: "jordi",
      isCaptain: !!o.captain,
      isSuperadmin: !!o.superadmin,
      google: { name: "Jordi Sumba", email: "jordi@example.com", photo: null },
      access: { sinceText: "sep 2026", howIn: "Abriste el vestuario", whoOpened: "Nadie: lo abriste tú" },
      shirt: { current: "JORDI", number: "28", squad: [{ id: "p28", name: "JORDI", number: 28 }, { id: "p9", name: "ERIK", number: 9 }], fullName: "Jordi Sumba" },
      card: { number: "28" },
      ficha: { state: o.kind === "socio" ? "ninguna" : "vinculada", playerId: o.kind === "socio" ? null : "p28", claim: null },
      freeFichas: [],
      captain: o.captain ? { doorRequests: [{ uid: "u9", status: "pending", googleName: "Kevin", email: "k@x.es", photo: "", playerId: "p9", playerName: "ERIK", name: "Kevin Pérez", at: NOW - 3600_000 }], pendingClaims: [] } : null,
    },
    pending: { items: [], open: 0, inbox: { topics: o.topics ?? [] } },
    who: { kind: o.kind ?? "jugador", captain: !!o.captain },
    screen: { page: "perfil", sec: "ajustes", aj: o.aj ?? null, open: null },
    go,
    actions,
    say,
    now: NOW,
    maq: null,
    card: { setTyped: vi.fn() },
    query: { hash: "", salir: o.salir },
  } as unknown as PlaceProps;
  return { p, actions, go, say };
}

beforeEach(() => {
  st.ready = true;
  st.navigate.mockClear();
  st.toggleTopic.mockClear();
});

describe("the index", () => {
  it("lists his sections with their hints; on a desktop the first one is shown", () => {
    const { p, go } = props({ captain: true });
    render(<Ajustes {...p} />);
    const nav = screen.getByRole("navigation", { name: "Ajustes" });
    expect(nav).toHaveTextContent("Tu nombreJORDI · @jordi");
    expect(nav).toHaveTextContent("Capitanía1 llama a la puerta");
    expect(screen.getByRole("button", { name: /Tu nombre/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 2, name: "Tu nombre" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cuenta/ }));
    expect(go).toHaveBeenCalledWith({ page: "perfil", sec: "ajustes", aj: "cuenta", open: null });
  });
  it("a player has no Capitanía", () => {
    const { p } = props();
    render(<Ajustes {...p} />);
    expect(screen.queryByRole("button", { name: /Capitanía/ })).toBeNull();
  });
});

describe("Tu nombre", () => {
  it("the inputs stop at the rule and the apodo's check ends with one stop", async () => {
    vi.useFakeTimers();
    const { p } = props({ aj: "nombre" });
    render(<Ajustes {...p} />);
    expect(screen.getByLabelText(/Lo que va a tu espalda/)).toHaveAttribute("maxLength", "12");
    const nick = screen.getByLabelText(/Apodo/);
    expect(nick).toHaveAttribute("maxLength", "15");
    fireEvent.change(nick, { target: { value: "jordis" } });
    expect(screen.getByText("Comprobando si está libre…")).toBeInTheDocument();
    vi.useRealTimers();
  });
  it("stamping and saving the apodo have their own busy flags; Deshacer puts the old name back", async () => {
    let release: (v: { shirtName: string; previous: string }) => void = () => undefined;
    const { p, actions, say } = props({ aj: "nombre" });
    actions.setShirtName.mockImplementationOnce(() => new Promise((r) => (release = r)));
    actions.nicknameTaken.mockResolvedValue(false);
    render(<Ajustes {...p} />);
    fireEvent.change(screen.getByLabelText(/Lo que va a tu espalda/), { target: { value: "jordi s" } });
    fireEvent.click(screen.getByRole("button", { name: "Estampar" }));
    expect(screen.getByRole("button", { name: "Estampando…" })).toHaveAttribute("aria-disabled", "true");
    // the apodo still answers while the back is being stamped
    fireEvent.change(screen.getByLabelText(/Apodo/), { target: { value: "jordis" } });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });
    const guardar = screen.getByRole("button", { name: "Guardar" });
    expect(guardar).not.toHaveAttribute("aria-disabled");
    await act(async () => {
      release({ shirtName: "JORDI S", previous: "JORDI" });
    });
    expect(actions.setShirtName).toHaveBeenCalledWith("JORDI S");
    const [text, undo] = say.mock.calls.find((c) => c[0] === "Estampado: así sale ya en tu ficha.") ?? [];
    expect(text).toBeTruthy();
    await act(async () => {
      (undo as () => void)();
    });
    expect(actions.setShirtName).toHaveBeenLastCalledWith("JORDI");
    expect(say).toHaveBeenLastCalledWith("Deshecho: vuelve «JORDI» a tu espalda.");
  });
  it("a refusal says why (the server's words)", async () => {
    const { p, actions, say } = props({ aj: "nombre" });
    actions.setShirtName.mockRejectedValueOnce({ code: "functions/already-exists", message: "Ya la lleva el 9 (ERIK): elige otro" });
    render(<Ajustes {...p} />);
    fireEvent.change(screen.getByLabelText(/Lo que va a tu espalda/), { target: { value: "jordi s" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Estampar" }));
    });
    expect(say).toHaveBeenCalledWith("Ya la lleva el 9 (ERIK): elige otro.");
  });
  it("a socio only has his apodo", () => {
    const { p } = props({ aj: "nombre", kind: "socio" });
    render(<Ajustes {...p} />);
    expect(screen.queryByText("En la espalda")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Tu apodo" })).toBeInTheDocument();
  });
});

describe("Cuenta", () => {
  it("?salir=1 opens the confirmation", () => {
    const { p, actions } = props({ aj: "cuenta", salir: true });
    render(<Ajustes {...p} />);
    expect(screen.getByText("¿Salir aquí?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí, salir" }));
    expect(actions.signOut).toHaveBeenCalledTimes(1);
  });
  it("la baja asks «Entiendo…» first", () => {
    const { p, actions } = props({ aj: "cuenta" });
    render(<Ajustes {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Quiero darme de baja" }));
    fireEvent.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect(actions.leaveVestuario).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Entiendo que dejo el vestuario/ }));
    fireEvent.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect(actions.leaveVestuario).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Te has dado de baja.");
  });
  it("the superadmin can't leave", () => {
    const { p } = props({ aj: "cuenta", superadmin: true });
    render(<Ajustes {...p} />);
    expect(screen.queryByRole("button", { name: "Quiero darme de baja" })).toBeNull();
    expect(screen.getByText(/esta cuenta no se puede dar de baja/)).toBeInTheDocument();
  });
});

describe("Capitanía", () => {
  it("who knocks, the door notice from the device's topics, and where to go", async () => {
    const { p } = props({ aj: "capitania", captain: true, topics: ["door"] });
    render(<Ajustes {...p} />);
    expect(screen.getByText("Una petición espera tu sí o tu no.")).toBeInTheDocument();
    expect(screen.getByText("Pide la carta del 9 (ERIK)")).toBeInTheDocument();
    const tog = screen.getByRole("button", { name: "Aviso de la puerta: activado en este móvil" });
    expect(tog).toHaveAttribute("aria-pressed", "true");
    await act(async () => {
      fireEvent.click(tog);
    });
    expect(st.toggleTopic).toHaveBeenCalledWith("door", false);
    fireEvent.click(screen.getByRole("button", { name: "Abrir La puerta" }));
    expect(st.navigate).toHaveBeenCalledWith({ to: "/vestuario/puerta" });
    fireEvent.click(screen.getByRole("button", { name: "Ir a la Sala de control" }));
    expect(st.navigate).toHaveBeenCalledWith({ to: "/admin" });
    expect(screen.queryByText("Convocatoria")).toBeNull();
  });
});
