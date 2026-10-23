import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { DoorRequestRow, InviteRow, PersonRow } from "../live";
import type { VxCtx } from "./ctx";
import type { VxSummary } from "./summary";

const NOW = Date.UTC(2026, 9, 20, 12);
const row = (uid: string, extra: Partial<DoorRequestRow> = {}): DoorRequestRow => ({ uid, status: "pending", googleName: "", email: "", photo: "", playerId: null, playerName: null, name: null, at: NOW, ...extra });
const person = (uid: string, extra: Partial<PersonRow> = {}): PersonRow => ({ uid, nickname: uid, displayName: "", email: "", role: "user", playerId: null, removed: false, ...extra });
const cap = vi.hoisted(() => ({
  state: {
    queue: [] as DoorRequestRow[],
    invites: [] as InviteRow[],
    inside: [] as { uid: string; joinedAt: number; via: string; me: boolean; person?: PersonRow }[],
    linked: new Set<string>(),
    pending: null as null | { row: DoorRequestRow; approve: boolean; playerId?: string; until: number },
  },
  decide: vi.fn(),
  undo: vi.fn(),
  invite: vi.fn(async () => ({ code: "Xb7Qp2", expiresAt: 0 })),
  revokeInvite: vi.fn(async () => true),
  removeMember: vi.fn(async () => true),
}));
vi.mock("../../acceso/useCaptainDoor", () => ({
  useCaptainDoor: () => ({ admin: true, loading: false, busy: "", error: "", clearError: vi.fn(), ...cap.state, decide: cap.decide, undo: cap.undo, invite: cap.invite, revokeInvite: cap.revokeInvite, removeMember: cap.removeMember }),
}));
vi.mock("../../../lib/push", () => ({ pushState: () => "ready", savedTopics: () => [], toggleTopic: vi.fn(async () => ["door"]) }));

const { PuertaBlock } = await import("./Puerta");
const { daysLeft, since } = await import("./puertaModel");

const SQUAD = [
  { id: "pellete", name: "Pellete", num: "20" },
  { id: "almachi", name: "Almachi", num: "21" },
];
const ctx = (extra: Partial<VxCtx> = {}): VxCtx => ({
  me: { uid: "cap", name: "Jordi", playerId: null },
  uid: "cap",
  playerId: null,
  admin: true,
  seasonId: "t1",
  seasonName: "Temporada 1",
  matches: [],
  players: [],
  squad: SQUAD,
  nameOf: (id) => id,
  next: undefined,
  nextLine: "",
  now: NOW,
  summary: {} as VxSummary,
  say: vi.fn(),
  go: vi.fn(),
  pollId: null,
  felicitar: null,
  ...extra,
});

beforeEach(() => {
  cap.state.queue = [];
  cap.state.invites = [];
  cap.state.inside = [];
  cap.state.linked = new Set();
  cap.state.pending = null;
  vi.clearAllMocks();
});

it("words: since when, and when a pass ends", () => {
  expect(since(Date.UTC(2026, 8, 24, 12))).toBe("Dentro desde el 24 de septiembre");
  expect(since(0)).toBe("Dentro");
  expect(daysLeft(NOW + 5 * 86_400_000, NOW)).toBe("Caduca en 5 días");
  expect(daysLeft(NOW + 3_600_000, NOW)).toBe("Caduca hoy");
});

it("three tabs with their counts, and the quiet tunnel", () => {
  cap.state.inside = [{ uid: "cap", joinedAt: 0, via: "", me: true, person: person("cap", { role: "superadmin" }) }];
  render(<PuertaBlock c={ctx()} />);
  const tabs = within(screen.getByRole("tablist", { name: "La puerta" })).getAllByRole("tab");
  expect(tabs.map((t) => t.textContent)).toEqual(["Llamando · 0", "Invitar", "Dentro · 1"]);
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("Túnel en silencio: nadie llamando a la puerta.")).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Avísame cuando alguien llame" })).toHaveAttribute("aria-checked", "false");
});

it("llamando: who knocks, as which ficha, «Abrir» and «No»", () => {
  cap.state.queue = [row("r1", { name: "Pablo G.", playerId: "pellete", playerName: "PELLETE" }), row("r2", { googleName: "sergio.mz" })];
  render(<PuertaBlock c={ctx()} />);
  const items = within(screen.getByRole("list", { name: "Llamando a la puerta" })).getAllByRole("listitem");
  expect(items[0]).toHaveTextContent("Pablo G.");
  expect(items[0]).toHaveTextContent("Quiere entrar como Pellete · 20");
  expect(items[1]).toHaveTextContent("Sin ficha");
  fireEvent.click(screen.getByRole("button", { name: "Abrir a Pablo G." }));
  expect(cap.decide).toHaveBeenCalledWith(cap.state.queue[0], true, "pellete");
  fireEvent.click(screen.getByRole("button", { name: "No abrir a sergio.mz" }));
  expect(cap.decide).toHaveBeenCalledWith(cap.state.queue[1], false);
});

it("a decision waits a moment with «Deshacer»", () => {
  cap.state.pending = { row: row("r1", { name: "Pablo G." }), approve: true, playerId: "pellete", until: NOW + 5000 };
  render(<PuertaBlock c={ctx()} />);
  expect(screen.getByRole("status")).toHaveTextContent("Pellete entra · le llega un aviso.");
  fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(cap.undo).toHaveBeenCalled();
});

it("invitar: a 7-day link for a free ficha, then copy and WhatsApp; live passes revoke", async () => {
  cap.state.linked = new Set(["pellete"]);
  cap.state.invites = [{ code: "abc", byName: "Jordi", expiresAt: NOW + 5 * 86_400_000, maxUses: 1, uses: 0, revoked: false, playerId: "almachi", playerName: null }];
  const c = ctx();
  render(<PuertaBlock c={c} />);
  fireEvent.click(screen.getByRole("tab", { name: "Invitar" }));
  expect(screen.getByText("Un enlace y entra sin esperar. Caduca solo en 7 días.")).toBeInTheDocument();
  const select = screen.getByRole("combobox", { name: "Ficha reservada · opcional" });
  expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Sin ficha · que elija al entrar", "Almachi · 21"]);
  expect(screen.getByRole("button", { name: "Copiar" })).toBeDisabled();
  fireEvent.change(select, { target: { value: "almachi" } });
  fireEvent.click(screen.getByRole("button", { name: "Crear enlace" }));
  expect(cap.invite).toHaveBeenCalledWith({ playerId: "almachi", maxUses: 1, days: 7 });
  expect(await screen.findByText(/\/invitacion\/Xb7Qp2$/)).toHaveClass("cb-code");
  expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toContain(encodeURIComponent("¡Almachi! Te abro el vestuario"));
  const passes = within(screen.getByRole("list", { name: "Pases activos" })).getAllByRole("listitem");
  expect(passes[0]).toHaveTextContent("Para Almachi · 21");
  expect(passes[0]).toHaveTextContent("1 uso · Caduca en 5 días · Sin usar");
  fireEvent.click(within(passes[0]).getByRole("button", { name: /^Revocar/ }));
  expect(cap.revokeInvite).toHaveBeenCalledWith("abc");
});

it("dentro: each account since when, and «Quitar acceso» asks first", () => {
  cap.state.inside = [
    { uid: "cap", joinedAt: 0, via: "", me: true, person: person("cap", { role: "superadmin", nickname: "Jordi" }) },
    { uid: "k", joinedAt: Date.UTC(2026, 8, 24, 12), via: "invite", me: false, person: person("k", { nickname: "Kevin" }) },
  ];
  render(<PuertaBlock c={ctx()} />);
  fireEvent.click(screen.getByRole("tab", { name: "Dentro · 2" }));
  expect(screen.getByText("2 cuentas dentro. Quitar el acceso no borra a nadie de la plantilla.")).toBeInTheDocument();
  const items = within(screen.getByRole("list", { name: "Dentro del vestuario" })).getAllByRole("listitem");
  expect(items[1]).toHaveTextContent("KevinDentro desde el 24 de septiembre");
  expect(within(items[0]).queryByRole("button")).toBeNull();
  fireEvent.click(within(items[1]).getByRole("button", { name: "Quitar acceso a Kevin" }));
  expect(within(items[1]).getByRole("alert")).toHaveTextContent("¿Quitar a Kevin? Se le cierra en todos sus móviles.");
  fireEvent.click(within(items[1]).getByRole("button", { name: "Quitar" }));
  expect(cap.removeMember).toHaveBeenCalledWith("k");
});
