import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    loading: false,
  },
  decide: vi.fn(),
  undo: vi.fn(),
  invite: vi.fn(async () => ({ code: "Xb7Qp2", expiresAt: 0 })),
  revokeInvite: vi.fn(async () => true),
  removeMember: vi.fn(async () => true),
}));
vi.mock("../../acceso/useCaptainDoor", () => ({
  useCaptainDoor: () => ({ admin: true, busy: "", error: "", clearError: vi.fn(), ...cap.state, decide: cap.decide, undo: cap.undo, invite: cap.invite, revokeInvite: cap.revokeInvite, removeMember: cap.removeMember }),
}));
vi.mock("../../../lib/push", () => ({ pushState: () => "ready", savedTopics: () => [], toggleTopic: vi.fn(async () => ["door"]) }));

const { PuertaBlock } = await import("./Puerta");
const { ago, askWords, daysLeft, initials, knockOptions, puertaHead, since, tunnelAria, validUntil } = await import("./puertaModel");

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
  cap.state.loading = false;
  vi.clearAllMocks();
});

it("words: since when, and when a pass ends", () => {
  expect(since(Date.UTC(2026, 8, 24, 12))).toBe("Dentro desde el 24 de septiembre");
  expect(since(0)).toBe("Dentro");
  expect(daysLeft(NOW + 5 * 86_400_000, NOW)).toBe("Caduca en 5 días");
  expect(daysLeft(NOW + 3_600_000, NOW)).toBe("Caduca hoy");
  expect(since(NOW - 3_600_000, NOW)).toBe("Dentro desde hoy");
  expect(since(Date.UTC(2026, 8, 24, 12), NOW)).toBe("Dentro desde el 24 de septiembre");
  expect(validUntil(Date.UTC(2026, 10, 7, 12))).toBe("el 7 nov");
});

it("words: the knocker's tag, how long he waits, the tunnel said", () => {
  expect(initials("Marcos Ruiz")).toBe("MR");
  expect(initials("sergio.mz")).toBe("SM");
  expect(initials("Pablo")).toBe("PA");
  expect(ago(NOW - 20 * 60_000, NOW)).toBe("hace 20 min");
  expect(ago(NOW - 2 * 3_600_000, NOW)).toBe("hace 2 h");
  expect(ago(NOW - 3 * 86_400_000, NOW)).toBe("hace 3 días");
  expect(ago(0, NOW)).toBe("");
  expect(tunnelAria(["Marcos", "dani"], 2, 8)).toBe("El túnel: 2 llaman a la puerta (Marcos, dani), 2 pases activos y 8 cuentas dentro.");
  expect(tunnelAria([], 1, 1)).toBe("El túnel: nadie llamando, 1 pase activo y 1 cuenta dentro.");
  expect(puertaHead(1, false).title).toBe("1 llama a la puerta");
  expect(puertaHead(0, false).title).toBe("Túnel en silencio");
  expect(puertaHead(0, true).title).toBe("Mirando quién llama…");
});

it("words: what a knock asks for, as he asked it or as the captain changed it", () => {
  const base = { pickLabel: "Pellete · 20", wantsLabel: "Jorge · 9", wantsTaken: false };
  expect(askWords({ ...base, pick: "jorge", pickLabel: "Jorge · 9", wants: "jorge" })).toEqual({ k: "Quiere entrar como", t: "Jorge · 9", s: "Su ficha está libre: entra con ella." });
  expect(askWords({ ...base, pick: "jorge", pickLabel: "Jorge · 9", wants: "jorge", wantsTaken: true }).s).toBe("Esa ficha ya tiene dueño: cámbiasela o que entre sin ficha.");
  expect(askWords({ ...base, pick: "pellete", wants: "jorge" })).toEqual({ k: "Entrará como", t: "Pellete · 20", s: "Pidió Jorge · 9: la cambias tú." });
  expect(askWords({ ...base, pick: "pellete", wants: "" }).s).toBe("Pidió entrar sin ficha: se la pones tú.");
  expect(askWords({ ...base, pick: "", wants: "jorge" })).toEqual({ k: "Quiere entrar", t: "Sin ficha", s: "Pidió Jorge · 9; entra sin ficha y se la haces tú." });
  expect(askWords({ ...base, pick: "", wants: "" }).s).toBe("No está en la plantilla: el capitán le hace la ficha.");
  expect(knockOptions([SQUAD[1]], "pellete", "Pellete · 20").map((o) => o.t)).toEqual(["Sin ficha · el capitán se la hace", "Pellete · 20", "Almachi · 21"]);
  expect(knockOptions([SQUAD[1]], "", "").map((o) => o.v)).toEqual(["", "almachi"]);
});

it("three tabs with their counts, the head says the tunnel is quiet, and the push switch", async () => {
  cap.state.inside = [{ uid: "cap", joinedAt: 0, via: "", me: true, person: person("cap", { role: "superadmin" }) }];
  const c = ctx();
  render(<PuertaBlock c={c} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Túnel en silencio");
  const tabs = within(screen.getByRole("tablist", { name: "La puerta" })).getAllByRole("tab");
  expect(tabs.map((t) => t.textContent)).toEqual(["Llamando · 0", "Invitar", "Dentro · 1"]);
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("heading", { name: "Túnel en silencio: nadie llamando a la puerta." })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "El túnel: nadie llamando, 0 pases activos y 1 cuenta dentro." })).toBeInTheDocument();
  const sw = screen.getByRole("button", { name: "Avísame cuando alguien llame" });
  expect(sw).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(sw);
  expect(await screen.findByRole("button", { name: "Te avisamos cuando llamen" })).toHaveAttribute("aria-pressed", "true");
  expect(c.say).toHaveBeenCalledWith("Te avisamos en este móvil cuando alguien llame.");
  // arrows and End move between the tabs; «Crear un pase» opens Invitar
  fireEvent.keyDown(tabs[0], { key: "End" });
  expect(screen.getByRole("tab", { name: "Dentro · 1" })).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("button", { name: "Crear un pase" }));
  expect(screen.getByRole("tab", { name: "Invitar" })).toHaveAttribute("aria-selected", "true");
});

it("llamando: who knocks, as which ficha, «Cambiar ficha», «Abrir» and «No»", () => {
  cap.state.queue = [row("r1", { name: "Pablo G.", playerId: "pellete", playerName: "PELLETE", email: "pablo@x.es", at: NOW - 20 * 60_000 }), row("r2", { googleName: "sergio.mz" })];
  render(<PuertaBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2 llaman a la puerta");
  const items = within(screen.getByRole("list", { name: "Llamando a la puerta" })).getAllByRole("listitem");
  expect(items[0]).toHaveTextContent("Pablo G.");
  expect(items[0]).toHaveTextContent("Quiere entrar como Pellete · 20");
  expect(items[0]).toHaveTextContent("hace 20 min");
  expect(within(items[0]).getByText(/pablo@x\.es/)).toHaveClass("nx-vh");
  expect(items[1]).toHaveTextContent("Sin ficha");
  const change = within(items[1]).getByRole("combobox", { name: "Cambiar ficha · ficha para sergio.mz" });
  fireEvent.change(change, { target: { value: "almachi" } });
  expect(items[1]).toHaveTextContent("Entrará como Almachi · 21");
  fireEvent.click(screen.getByRole("button", { name: "Abrir a sergio.mz" }));
  expect(cap.decide).toHaveBeenCalledWith(cap.state.queue[1], true, "almachi");
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
  expect(screen.getByText("Aún no has creado ningún enlace.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Copiar" })).toBeNull();
  fireEvent.change(select, { target: { value: "almachi" } });
  fireEvent.click(screen.getByRole("radio", { name: "Ilimitado" }));
  expect(screen.getByText("Para Almachi · 21 · Ilimitado · 7 días")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "1 uso" }));
  fireEvent.click(screen.getByRole("button", { name: "Crear enlace" }));
  expect(cap.invite).toHaveBeenCalledWith({ playerId: "almachi", maxUses: 1, days: 7 });
  expect(await screen.findByText(/\/invitacion\/Xb7Qp2$/, { selector: "code" })).toHaveClass("vpu-tk__url");
  expect(c.say).toHaveBeenCalledWith("Enlace creado: caduca en 7 días.");
  expect(screen.getByRole("group", { name: "Pase de túnel: para Almachi · 21, 1 uso, válido 7 días" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Crear otro enlace" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toContain(encodeURIComponent("¡Almachi! Te abro el vestuario"));
  expect(screen.getByText(/^¡Almachi! Te abro el vestuario del Manchester Piti/)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Pases activos · 1" })).toBeInTheDocument();
  const passes = within(screen.getByRole("list", { name: "Pases activos" })).getAllByRole("listitem");
  expect(passes[0]).toHaveTextContent("Para Almachi · 21");
  expect(passes[0]).toHaveTextContent("1 uso · Caduca en 5 días · Sin usar");
  fireEvent.click(within(passes[0]).getByRole("button", { name: /^Revocar/ }));
  expect(cap.revokeInvite).toHaveBeenCalledWith("abc");
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Enlace revocado: deja de funcionar al momento."));
});

it("dentro: each account since when, and «Quitar acceso» asks first", () => {
  cap.state.inside = [
    { uid: "cap", joinedAt: 0, via: "", me: true, person: person("cap", { role: "superadmin", nickname: "Jordi" }) },
    { uid: "k", joinedAt: Date.UTC(2026, 8, 24, 12), via: "invite", me: false, person: person("k", { nickname: "Kevin" }) },
  ];
  render(<PuertaBlock c={ctx()} />);
  fireEvent.click(screen.getByRole("tab", { name: "Dentro · 2" }));
  expect(screen.getByRole("heading", { name: "2 cuentas dentro." })).toBeInTheDocument();
  expect(screen.getByText("Quitar el acceso no borra a nadie de la plantilla.")).toBeInTheDocument();
  const items = within(screen.getByRole("list", { name: "Dentro del vestuario" })).getAllByRole("listitem");
  expect(items[0]).toHaveTextContent("Jorditú");
  expect(items[0]).toHaveTextContent("Capitán · dentro");
  expect(items[0]).toHaveTextContent("Tu cuenta");
  expect(items[1]).toHaveTextContent("KevinDentro desde el 24 de septiembre");
  expect(within(items[0]).queryByRole("button")).toBeNull();
  fireEvent.click(within(items[1]).getByRole("button", { name: "Quitar acceso a Kevin" }));
  expect(within(items[1]).getByRole("alertdialog")).toHaveTextContent("¿Quitar a Kevin? Se le cierra en todos sus móviles.");
  fireEvent.click(within(items[1]).getByRole("button", { name: "Quitar" }));
  expect(cap.removeMember).toHaveBeenCalledWith("k");
});

it("loading: «Mirando quién llama…» over the unseen quiet card, which already holds its height (no jump when it comes)", () => {
  cap.state.loading = true;
  const { container } = render(<PuertaBlock c={ctx()} />);
  const wait = container.querySelector(".vpu-wait");
  expect(wait).toHaveTextContent("Mirando quién llama…");
  const hold = wait!.querySelector(".ve-empty.vpu-wait__hold");
  expect(hold).toHaveAttribute("aria-hidden", "true");
  expect(hold).toHaveTextContent("Túnel en silencio: nadie llamando a la puerta.");
  // (out of reach while it only holds the place)
  expect(screen.queryByRole("button", { name: "Crear un pase" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Túnel en silencio: nadie llamando a la puerta." })).toBeNull();
});
