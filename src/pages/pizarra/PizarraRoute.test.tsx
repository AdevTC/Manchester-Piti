import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The /pizarra switch: `?v2` shows the new board and remembers it on this device, `?v2=0` goes back to
// the current one; without the flag the current board renders as before.

const url = vi.hoisted(() => ({ search: "" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: { location: { searchStr: string } }) => string }) => select({ location: { searchStr: url.search } }),
}));
vi.mock("./Pizarra", () => ({ Pizarra: () => <p>pizarra actual</p> }));
vi.mock("./v2/PizarraV2", () => ({ PizarraV2: () => <p>pizarra nueva</p> }));
vi.mock("../../components/route-states", () => ({ RoutePending: () => <p>cargando</p> }));

import { PizarraRoute } from "./PizarraRoute";
import { V2_KEY } from "./v2/flag";

afterEach(() => {
  localStorage.clear();
  url.search = "";
});

describe("/pizarra · el interruptor de la nueva pizarra", () => {
  it("without the switch, the current board", async () => {
    render(<PizarraRoute />);
    expect(await screen.findByText("pizarra actual")).toBeInTheDocument();
    expect(localStorage.getItem(V2_KEY)).toBeNull();
  });

  it("?v2 turns the new board on and remembers it", async () => {
    url.search = "?v2";
    const { unmount } = render(<PizarraRoute />);
    expect(await screen.findByText("pizarra nueva")).toBeInTheDocument();
    expect(localStorage.getItem(V2_KEY)).toBe("1");
    unmount();
    url.search = "?season=t1";
    render(<PizarraRoute />);
    expect(await screen.findByText("pizarra nueva")).toBeInTheDocument();
  });

  it("?v2=0 turns it off again", async () => {
    localStorage.setItem(V2_KEY, "1");
    url.search = "?v2=0";
    render(<PizarraRoute />);
    expect(await screen.findByText("pizarra actual")).toBeInTheDocument();
    expect(localStorage.getItem(V2_KEY)).toBeNull();
  });
});
