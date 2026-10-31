import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Claim } from "../live";
import type { VxCtx } from "./ctx";
import type { VxSummary } from "./summary";

const live = vi.hoisted(() => ({
  claim: null as Claim | null,
  links: [] as { playerId: string; uid: string }[],
  loading: false,
  claimFn: vi.fn<(req: { playerId: string }) => Promise<{ data: { linked: boolean } }>>(async () => ({ data: { linked: false } })),
}));
vi.mock("../live", () => ({
  useMyClaim: () => ({ data: live.claim, loading: false }),
  usePlayerLinks: () => ({ data: live.links, loading: live.loading }),
}));
vi.mock("../../../lib/clubApi", () => ({ apiError: () => "No se pudo guardar.", requestPlayerClaim: live.claimFn }));
vi.mock("../../club/cb/ui", () => ({ Go: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => <a href={href} className={className}>{children}</a> }));

const { FichaBlock } = await import("./Ficha");

const SQUAD = [
  { id: "jordi", name: "Jordi", num: "7" },
  { id: "pellete", name: "Pellete", num: "20" },
  { id: "almachi", name: "Almachi", num: "21" },
];
const ctx = (extra: Partial<VxCtx> = {}): VxCtx => ({
  me: { uid: "u1", name: "zzz", playerId: null },
  uid: "u1",
  playerId: null,
  admin: false,
  seasonId: "t1",
  seasonName: "Temporada 1",
  matches: [],
  players: [],
  squad: SQUAD,
  nameOf: (id) => SQUAD.find((s) => s.id === id)?.name ?? id,
  next: undefined,
  nextLine: "",
  now: 0,
  summary: {} as VxSummary,
  say: vi.fn(),
  go: vi.fn(),
  pollId: null,
  felicitar: null,
  ...extra,
});
const claim = (extra: Partial<Claim>): Claim => ({ uid: "u1", playerId: "pellete", playerName: "Pellete", nickname: "zzz", email: "", status: "pending", ...extra });

beforeEach(() => {
  live.claim = null;
  live.links = [{ playerId: "jordi", uid: "cap" }];
  live.loading = false;
  vi.clearAllMocks();
});

it("choose: the free shirts are radios, the taken ones pictures; «Es mi ficha» asks for the chosen one", async () => {
  const c = ctx();
  render(<FichaBlock c={c} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("¿Cuál es tu camiseta?");
  expect(screen.getByText("Elige tu nombre. Lo aprueba un capitán; mientras tanto, todo el vestuario funciona igual.")).toBeInTheDocument();
  const group = screen.getByRole("group", { name: "Elige tu nombre" });
  expect(within(group).getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(["Pellete, dorsal 20", "Almachi, dorsal 21"]);
  expect(within(group).getByRole("img", { name: "Jordi, dorsal 7: ocupada" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Es mi ficha" }));
  expect(c.say).toHaveBeenCalledWith("Elige tu nombre primero.");
  fireEvent.click(within(group).getByRole("radio", { name: "Almachi, dorsal 21" }));
  expect(screen.getByRole("heading", { name: "Almachi · 21" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Es mi ficha" }));
  expect(live.claimFn).toHaveBeenCalledWith({ playerId: "almachi" });
  await waitFor(() => expect(c.say).toHaveBeenCalledWith("Solicitud enviada: tu ficha, en revisión."));
});

it("choose: the search narrows the squad, and says when nobody answers", () => {
  render(<FichaBlock c={ctx()} />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Busca tu nombre o dorsal" }), { target: { value: "zz" } });
  expect(screen.getByRole("status")).toHaveTextContent("Nadie con «zz».");
  fireEvent.click(screen.getByRole("button", { name: "Borrar la búsqueda" }));
  expect(screen.getAllByRole("radio")).toHaveLength(2);
});

it("the one that looks like his nickname, after a rejected request", () => {
  live.claim = claim({ status: "rejected" });
  render(<FichaBlock c={ctx({ me: { uid: "u1", name: "pellete99", playerId: null }, players: [{ id: "pellete", shirtName: "PELLETE" }] as unknown as VxCtx["players"] })} />);
  expect(screen.getByText("Tu última solicitud no se aprobó.")).toBeInTheDocument();
  expect(screen.getByText("Se parece a tu nombre")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sí, es mi ficha" }));
  expect(live.claimFn).toHaveBeenCalledWith({ playerId: "pellete" });
});

it("pending: in review, and «No es esa, elegir otra» opens the squad again", () => {
  live.claim = claim({});
  render(<FichaBlock c={ctx()} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Solicitud enviada: tu ficha, en revisión.");
  expect(screen.getByText(/Has pedido la ficha de/)).toHaveTextContent("Has pedido la ficha de Pellete. En cuanto un capitán la apruebe, tu cartel llevará tu nombre y tu dorsal.");
  expect(screen.getByText("En revisión")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "No es esa, elegir otra" }));
  expect(screen.getByRole("group", { name: "Elige tu nombre" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByText("En revisión")).toBeInTheDocument();
});

it("no free ficha: it says so and sends him to ask on the board", () => {
  live.links = SQUAD.map((s) => ({ playerId: s.id, uid: s.id }));
  const c = ctx();
  render(<FichaBlock c={c} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Todas las camisetas tienen dueño");
  expect(screen.getByText(/No queda ninguna ficha libre esta temporada: pídesela a un capitán\. Te hace/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pedírsela en el tablón" }));
  expect(c.go).toHaveBeenCalledWith("/vestuario/tablon");
  expect(screen.queryByRole("radio")).toBeNull();
});

it("linked: says so, lights his shirt and sends him to his ficha", () => {
  live.links = [{ playerId: "pellete", uid: "u1" }];
  render(<FichaBlock c={ctx({ playerId: "pellete" })} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu ficha ya está vinculada: Pellete.");
  expect(screen.getByRole("link", { name: "Ir a mi ficha" })).toHaveAttribute("href", "/perfil");
  expect(screen.getByRole("img", { name: "Pellete, dorsal 20: tu ficha" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Almachi, dorsal 21: libre" })).toBeInTheDocument();
});
