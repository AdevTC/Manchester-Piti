import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { EMPTY_CAJA_SETTINGS, fmtEuros, type CajaMov } from "../../../lib/derived/caja";
import type { VxCtx } from "./ctx";

// «La caja» room: the title is his status, «Ya la he pagado» writes the claim (its toast can take back exactly that
// claim), «Deshacer el aviso» while it waits, the movements and the closed caja.
const state = vi.hoisted(() => ({
  claimPayment: vi.fn(async (..._a: unknown[]) => ({ id: "claim-1" })),
  unclaimPayment: vi.fn(async (_id: string) => undefined),
}));
vi.mock("../writes", () => ({ claimPayment: state.claimPayment }));
vi.mock("../../match/partido/vestuarioWrites", () => ({ unclaimPayment: state.unclaimPayment }));
vi.mock("../../club/cb/ui", () => ({ Go: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => <a href={href} className={className}>{children}</a> }));

const { CajaBlock } = await import("./Caja");

const mov = (id: string, p: Partial<CajaMov>): CajaMov => ({ id, seasonId: "s1", kind: "cargo", playerId: "kevin", amount: 1250, concept: "Campo de la J2", date: "2026-10-25", matchId: null, by: "cap", createdAt: 1, void: false, ...p });
const MOVS = [mov("a", {}), mov("b", { kind: "pago", amount: 500, concept: "Bizum", date: "2026-10-03", void: true })];
const say = vi.fn();
// (the DOM matchers fold the no-break space of «12,50 €» into a plain one)
const eur = (cents: number) => fmtEuros(cents).replace(/\s/g, " ");
const ctx = (extra: Partial<VxCtx> = {}, caja: { movs?: CajaMov[]; loading?: boolean; error?: boolean } = {}, claim: { id: string } | null = null) =>
  ({
    me: { uid: "u1", name: "Kevin", playerId: "kevin" },
    uid: "u1",
    playerId: "kevin",
    admin: false,
    seasonId: "s1",
    squad: [{ id: "kevin", name: "Kevin", num: "9" }],
    nameOf: (id: string) => id,
    say,
    summary: { caja: { movs: caja.movs ?? MOVS, settings: EMPTY_CAJA_SETTINGS, loading: !!caja.loading, error: !!caja.error }, claim },
    ...extra,
  }) as unknown as VxCtx;

beforeEach(() => {
  vi.clearAllMocks();
});

it("he owes: the title says it, «Ya la he pagado» writes the claim and its toast can take back that claim", async () => {
  render(<CajaBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`Debes ${eur(1250)}`);
  expect(screen.getByText(/Lo último: Campo de la J2, 25 oct\./)).toBeInTheDocument();
  expect(screen.getByText("Pregunta a un capitán cómo pagar.")).toBeInTheDocument();
  expect(screen.queryByText(/^Cuota:/)).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ya la he pagado" })));
  expect(state.claimPayment).toHaveBeenCalledWith(expect.objectContaining({ uid: "u1" }), { seasonId: "s1", concept: "Lo que faltaba de la caja", amount: 1250 });
  expect(say).toHaveBeenCalledWith("Avisado: el capitán lo apunta en la caja.", expect.any(Function));
  const undo = say.mock.calls[0][1] as () => void;
  await act(async () => undo());
  expect(state.unclaimPayment).toHaveBeenCalledWith("claim-1");
  expect(say).toHaveBeenLastCalledWith("Aviso deshecho.");
});

it("a failed claim says why", async () => {
  state.claimPayment.mockRejectedValueOnce(new Error(""));
  render(<CajaBlock c={ctx()} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ya la he pagado" })));
  expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido avisar del pago. Inténtalo otra vez.");
});

it("a claim waiting: «Pago avisado» and «Deshacer el aviso»", async () => {
  render(<CajaBlock c={ctx({}, {}, { id: "c9" })} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pago avisado");
  expect(screen.queryByRole("button", { name: "Ya la he pagado" })).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Deshacer el aviso" })));
  expect(state.unclaimPayment).toHaveBeenCalledWith("c9");
  expect(say).toHaveBeenCalledWith("Aviso deshecho.");
});

it("his movements newest first, a void one crossed out, and the sums", () => {
  render(<CajaBlock c={ctx()} />);
  const rows = within(screen.getByRole("list", { name: "Tus movimientos en la caja" })).getAllByRole("listitem");
  expect(rows[0]).toHaveTextContent("Campo de la J2");
  expect(rows[1]).toHaveTextContent("3 oct · Anulado");
  expect(rows[1]).toHaveClass("is-void");
  expect(screen.getByText(`Cargado: ${eur(1250)}`)).toBeInTheDocument();
  expect(screen.getByText(`Pagado: ${eur(0)}`)).toBeInTheDocument();
});

it("without a ficha: «La caja del equipo», «Sin ficha todavía» and «–»", () => {
  render(<CajaBlock c={ctx({ playerId: null })} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("La caja del equipo");
  expect(screen.getByText("Sin ficha todavía")).toBeInTheDocument();
  expect(screen.getByText("–")).toBeInTheDocument();
});

it("closed, loading and unreadable; a captain's link to the sala de control", () => {
  const { rerender } = render(<CajaBlock c={ctx({ admin: true }, { movs: [] })} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("La caja aún no está abierta");
  expect(screen.getByText("Aquí irán el bote, la cuota y tu saldo")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Abrir la caja en la sala de control" })[0]).toHaveAttribute("href", "/admin/caja");
  rerender(<CajaBlock c={ctx({}, { movs: [], loading: true })} />);
  expect(screen.getByText("Contando la caja…")).toBeInTheDocument();
  rerender(<CajaBlock c={ctx({}, { movs: [], error: true })} />);
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo leer la caja. Prueba a recargar dentro de un rato.");
});
