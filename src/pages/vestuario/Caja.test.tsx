import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { EMPTY_CAJA_SETTINGS, type CajaMov, type CajaSettings } from "../../lib/derived/caja";
import type { PlayerDoc } from "../../lib/schemas";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, className }: { children?: ReactNode; to: string; params?: { playerId?: string }; search?: { season?: string }; className?: string }) => (
    <a className={className} href={to.replace("$playerId", params?.playerId ?? "") + (search?.season ? `?season=${search.season}` : "")}>
      {children}
    </a>
  ),
}));
// the caja's one reader (the shared listener the admin reads too)
const caja = vi.hoisted(() => ({
  state: { settings: null as unknown, movs: [] as unknown[], loading: false, error: null as unknown },
  calls: [] as [string | undefined, boolean | undefined][],
}));
vi.mock("./live", () => ({
  useCaja: (seasonId: string | undefined, enabled?: boolean) => {
    caja.calls.push([seasonId, enabled]);
    return caja.state;
  },
}));
const SQUAD: PlayerDoc[] = [
  { id: "erik", shirtName: "ERIK", number: 1, seasons: ["t1"] },
  { id: "pablo", shirtName: "PABLO", number: 4, seasons: ["t1"], seasonDetails: { t1: { shirtName: "PABLITO", number: 14 } } },
  { id: "raul", shirtName: "RAUL", number: 7, seasons: ["t1"] },
  { id: "adri", shirtName: "ADRI", number: 9, seasons: ["t1"] },
] as PlayerDoc[];
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: SQUAD, loading: false, error: null }) }));

const { Caja } = await import("./Caja");

// (es-ES puts a no-break space before «€»)
const eur = (s: string) => s.replace(/ €/g, " €");
let n = 0;
const mov = (extra: Partial<CajaMov>): CajaMov => ({
  id: `m${++n}`,
  seasonId: "t1",
  kind: "cargo",
  playerId: "erik",
  amount: 1000,
  concept: "Cuota Temporada 1",
  date: "2026-10-01",
  matchId: null,
  by: "cap",
  createdAt: n,
  void: false,
  ...extra,
});
const SETTINGS: CajaSettings = { cuota: 3000, cuotaPeriod: "temporada", howToPay: "Bizum a Jordi\n600 000 000\n<b>sin HTML</b>", updatedAt: 1 };
const set = (settings: CajaSettings, movs: CajaMov[], extra: { loading?: boolean; error?: unknown } = {}) => {
  caja.state = { settings, movs, loading: extra.loading ?? false, error: extra.error ?? null };
};
const renderCaja = (extra: Partial<Parameters<typeof Caja>[0]> = {}) =>
  render(<Caja member admin={false} seasonId="t1" playerId="erik" players={SQUAD} {...extra} />);

beforeEach(() => {
  n = 0;
  caja.calls = [];
  set(EMPTY_CAJA_SETTINGS, []);
});

it("members only: a fan renders nothing and never opens the caja's reader", () => {
  const { container } = renderCaja({ member: false });
  expect(container).toBeEmptyDOMElement();
  expect(caja.calls).toEqual([]);
  renderCaja();
  expect(screen.getByRole("heading", { name: "La caja" })).toBeInTheDocument();
  expect(caja.calls.at(-1)).toEqual(["t1", true]);
});

it("no season: nothing to read", () => {
  const { container } = renderCaja({ seasonId: "" });
  expect(container).toBeEmptyDOMElement();
  expect(caja.calls).toEqual([]);
});

it("not opened yet: one short line; a captain also gets the way to the Sala de control", () => {
  const { rerender } = renderCaja();
  expect(screen.getByText("La caja aún no está abierta: la abre un capitán en la sala de control.")).toBeInTheDocument();
  expect(screen.queryByText("Tu saldo")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  rerender(<Caja member admin seasonId="t1" playerId="erik" players={SQUAD} />);
  expect(screen.getByRole("link", { name: "Abrir la caja en la sala de control" })).toHaveAttribute("href", "/admin/caja");
});

it("loading says so instead of the empty line", () => {
  set(EMPTY_CAJA_SETTINGS, [], { loading: true });
  renderCaja();
  expect(screen.getByText("Contando la caja…")).toBeInTheDocument();
  expect(screen.queryByText(/aún no está abierta/)).toBeNull();
});

it("your balance big, the jar, the cuota and «Cómo pagar» as plain text with its line breaks", () => {
  set(SETTINGS, [mov({ amount: 3000 }), mov({ kind: "pago", amount: 1750 }), mov({ kind: "gasto", playerId: null, amount: 500 }), mov({ kind: "ingreso", playerId: null, amount: 1000 })]);
  const { container } = renderCaja();
  expect(container.querySelector(".cj-me .big")?.textContent).toBe(eur("Debes 12,50 €"));
  expect(container.querySelector(".cj-me")).toHaveClass("debe");
  // the jar: pagos + ingresos − gastos (the cargo is owed, not money in)
  expect(container.querySelector(".cj-jar b")?.textContent).toBe(eur("22,50 €"));
  expect(container.querySelector(".cj-jar small")?.textContent).toBe(eur("Cuota: 30,00 € por temporada"));
  const pay = container.querySelector(".cj-pay p") as HTMLElement;
  expect(pay.textContent).toBe("Bizum a Jordi\n600 000 000\n<b>sin HTML</b>");
  expect(pay.querySelector("b")).toBeNull();
});

it("square or in favour: «Al día», with what is in your favour", () => {
  set(SETTINGS, [mov({ amount: 1000 }), mov({ kind: "pago", amount: 1300 })]);
  const { container, rerender } = renderCaja();
  expect(container.querySelector(".cj-me .big")?.textContent).toBe(eur("Al día · +3,00 €"));
  set(SETTINGS, [mov({ amount: 1000 }), mov({ kind: "pago", amount: 1000 })]);
  rerender(<Caja member admin={false} seasonId="t1" playerId="erik" players={SQUAD} />);
  expect(container.querySelector(".cj-me .big")?.textContent).toBe("Al día");
});

it("an unlinked member sees the team but no balance of his own", () => {
  set(SETTINGS, [mov({ amount: 1000 })]);
  renderCaja({ playerId: null });
  expect(screen.getByText("Cuando tu ficha esté vinculada verás aquí tu saldo.")).toBeInTheDocument();
  expect(screen.queryByText(/Tus movimientos/)).toBeNull();
  expect(screen.getByRole("list", { name: "Saldos del equipo" })).toBeInTheDocument();
});

it("everyone's balance: who owes first (the biggest debt first), then by dorsal; a word and an amount each", () => {
  set(SETTINGS, [
    mov({ playerId: "raul", amount: 500 }),
    mov({ playerId: "adri", amount: 2000 }),
    mov({ playerId: "pablo", kind: "pago", amount: 250 }),
    // a void cargo counts nowhere
    mov({ playerId: "erik", amount: 9900, void: true }),
  ]);
  renderCaja();
  const rows = within(screen.getByRole("list", { name: "Saldos del equipo" })).getAllByRole("listitem");
  expect(rows.map((r) => [r.querySelector(".nm")?.textContent, r.querySelector(".st")?.textContent, r.querySelector(".amt")?.textContent])).toEqual([
    ["ADRI", "Debe", eur("20,00 €")],
    ["RAUL", "Debe", eur("5,00 €")],
    ["ERIK · tú", "Al día", ""],
    ["PABLITO", "A favor", eur("+2,50 €")],
  ]);
  // never colour alone: every state has its icon next to its word
  for (const r of rows) expect(r.querySelector(".st svg")).not.toBeNull();
  // the names are the season's, linked to each player's page in the season
  expect(within(rows[3]).getByRole("link", { name: "PABLITO" })).toHaveAttribute("href", "/jugadores/pablo?season=t1");
  expect(rows[3].querySelector(".n")?.textContent).toBe("14");
  expect(screen.getByText("2 deben · primero quien debe")).toBeInTheDocument();
});

it("your movements, folded: newest first, signed, a void one crossed out and «Anulado»", () => {
  set(SETTINGS, [
    mov({ date: "2026-09-01", concept: "Cuota Temporada 1", amount: 3000 }),
    mov({ date: "2026-10-05", concept: "Campo y árbitro · J5 vs Rival", amount: 643, void: true }),
    mov({ date: "2026-10-02", kind: "pago", concept: "Bizum", amount: 2000 }),
    mov({ playerId: "pablo", concept: "No es mío" }),
  ]);
  const { container } = renderCaja();
  const details = container.querySelector("details.cj-mine") as HTMLDetailsElement;
  expect(details.open).toBe(false);
  expect(within(details).getByText("Tus movimientos · 3")).toBeInTheDocument();
  fireEvent.click(within(details).getByText("Tus movimientos · 3"));
  const items = within(screen.getByRole("list", { name: "Tus movimientos" })).getAllByRole("listitem");
  expect(items.map((li) => li.querySelector(".w b, .w s")?.textContent)).toEqual(["Campo y árbitro · J5 vs Rival", "Bizum", "Cuota Temporada 1"]);
  const voided = items[0];
  expect(voided).toHaveClass("void");
  expect(voided.querySelector(".amt s")?.textContent).toBe(eur("−6,43 €"));
  expect(voided.querySelector(".w s")).not.toBeNull();
  expect(within(voided).getByText("Anulado")).toBeInTheDocument();
  expect(items[1].querySelector(".amt")?.textContent).toBe(eur("+20,00 €"));
  expect(items[2].querySelector(".amt")?.textContent).toBe(eur("−30,00 €"));
  expect(items[1].querySelector(".d")?.textContent).toBe("2 oct");
  // the void cargo is left out of the balance: −30 + 20
  expect(container.querySelector(".cj-me .big")?.textContent).toBe(eur("Debes 10,00 €"));
});

it("no movements of your own yet: a line instead of an empty fold", () => {
  set(SETTINGS, [mov({ playerId: "raul" })]);
  renderCaja();
  expect(screen.getByText("Aún no tienes movimientos en la caja.")).toBeInTheDocument();
  expect(screen.queryByText(/Tus movimientos/)).toBeNull();
});

it("an open caja keeps a captain's link to it", () => {
  set(SETTINGS, []);
  renderCaja({ admin: true });
  expect(screen.getByRole("link", { name: "Llevar la caja en la sala de control" })).toHaveAttribute("href", "/admin/caja");
  expect(screen.getByText("Nadie debe nada")).toBeInTheDocument();
});
