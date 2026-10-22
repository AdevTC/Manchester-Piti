import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { lineupOf, demoSquad } from "./testkit";
import { BoardHarness } from "./testkitBoard";
import { TablerosPanel, type TablerosProps } from "./Tableros";
import { pizarraLinks } from "./links";
import type { CalMatch } from "./boards";

// The pizarra's ways out: «Ver su página» on a player's ficha, the linked match's page under the Partido
// band, and «Convocar» in the Sala de control for admins only. The links are real router links
// (pizarraLinks, PizarraPage's); the Board and Tableros only place what they are given.

vi.mock("../../../components/pitch3d/support", () => ({ unsupportedReason: () => "webdriver", supported: () => false }));

/** Renders `node` on a memory router that knows the routes the links go to. */
async function inRouter(node: ReactNode) {
  const root = createRootRoute({ component: () => <>{node}</> });
  const leaf = (path: string) => createRoute({ getParentRoute: () => root, path, component: () => null });
  const convocar = createRoute({ getParentRoute: () => root, path: "/admin/convocar", validateSearch: z.object({ j: z.string().optional() }), component: () => null });
  const router = createRouter({ routeTree: root.addChildren([leaf("/pizarra"), leaf("/partidos/$matchId"), leaf("/jugadores/$playerId"), convocar]), history: createMemoryHistory({ initialEntries: ["/pizarra"] }) });
  render(<RouterProvider router={router} />);
  await screen.findAllByRole("link");
}

describe("pizarraLinks", () => {
  it("a member: the player's page and the match's page, never Convocar", async () => {
    const l = pizarraLinks(false);
    await inRouter(
      <>
        {l.player("tello")}
        {l.match("m8")}
      </>,
    );
    expect(screen.getByRole("link", { name: "Ver su página" })).toHaveAttribute("href", "/jugadores/tello");
    expect(screen.getByRole("link", { name: "Ver el partido" })).toHaveAttribute("href", "/partidos/m8");
    expect(screen.queryByRole("link", { name: "Convocar" })).toBeNull();
  });

  it("an admin: Convocar that match in the Sala de control", async () => {
    await inRouter(pizarraLinks(true).match("m8"));
    expect(screen.getByRole("link", { name: "Ver el partido" })).toHaveAttribute("href", "/partidos/m8");
    expect(screen.getByRole("link", { name: "Convocar" })).toHaveAttribute("href", "/admin/convocar?j=m8");
    expect(screen.getByRole("link", { name: "Convocar" })).toHaveClass("b3");
  });
});

const stub = { player: (id: string) => <a href={"/jugadores/" + id}>Ver su página</a>, match: (id: string) => <a href={"/partidos/" + id}>Ver el partido</a> };

describe("the ficha · «Ver su página»", () => {
  const SEVEN = ["evans", "illescas", "tello", "brawan", "eguzquiza", "huberoski", "adrian"];
  const openFicha = () => {
    const cromo = screen.getByRole("button", { name: /^ADRIAN, dorsal/ });
    fireEvent.click(cromo);
    fireEvent.click(cromo);
    return screen.getByRole("dialog", { name: "Ficha de ADRIAN" });
  };

  it("his ficha links to his public page, beside the flip; Cerrar stays", () => {
    render(<BoardHarness initial={lineupOf(SEVEN, "2-3-1", demoSquad())} props={{ links: stub }} />);
    const ficha = openFicha();
    expect(within(ficha).getByRole("link", { name: "Ver su página" })).toHaveAttribute("href", "/jugadores/adrian");
    expect(within(ficha).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("without links (no router) the ficha is as it was", () => {
    render(<BoardHarness initial={lineupOf(SEVEN, "2-3-1", demoSquad())} />);
    expect(within(openFicha()).queryByRole("link")).toBeNull();
  });
});

describe("Tableros · Partido · the linked match's ways out", () => {
  const m8: CalMatch = { id: "m8", j: 8, rival: "MAD SKY", dateMs: 0, played: false, gf: null, ga: null, home: true, venue: "" };
  const props = (o: Partial<TablerosProps> = {}): TablerosProps => ({
    tab: "p",
    onTab: vi.fn(),
    onBack: vi.fn(),
    ready: true,
    id: "b1",
    name: "Mi tablero",
    ro: false,
    saveTxt: "Guardado",
    saveCls: "",
    seasonName: "Temporada 1",
    boards: [],
    canDelete: false,
    onRename: vi.fn(async () => {}),
    onDuplicate: vi.fn(),
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onCopy: vi.fn(),
    onDelete: vi.fn(),
    pending: [],
    official: null,
    reactions: null,
    isCap: false,
    scopeMatch: null,
    onScreenOfficial: null,
    canPublish: true,
    pubBlock: null,
    pubWarn: [],
    onViewOfficial: vi.fn(),
    onDupOfficial: vi.fn(),
    onReact: vi.fn(),
    onPublish: vi.fn(async () => {}),
    onUnpublish: vi.fn(),
    calendar: [m8],
    matchId: "m8",
    onLink: vi.fn(),
    seasons: [],
    seasonId: "t1",
    onSeason: vi.fn(),
    matchLinks: stub.match,
    ...o,
  });

  it("under the band of the linked match", () => {
    render(<TablerosPanel {...props()} />);
    const group = screen.getByRole("group", { name: "El J8 · MAD SKY fuera de la pizarra" });
    expect(within(group).getByRole("link", { name: "Ver el partido" })).toHaveAttribute("href", "/partidos/m8");
  });

  it("no linked match (or no links): nothing", () => {
    const { rerender } = render(<TablerosPanel {...props({ matchId: null })} />);
    expect(screen.queryByRole("link", { name: "Ver el partido" })).toBeNull();
    rerender(<TablerosPanel {...props({ matchLinks: undefined })} />);
    expect(screen.queryByRole("link", { name: "Ver el partido" })).toBeNull();
  });
});
