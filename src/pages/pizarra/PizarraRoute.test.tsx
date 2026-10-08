import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// /pizarra is the new board for everyone: no switch any more (an old `?v2=0` link changes nothing).

vi.mock("./v2/PizarraPage", () => ({ PizarraPage: () => <p>pizarra nueva</p> }));

import { PizarraRoute } from "./PizarraRoute";

describe("/pizarra", () => {
  it("renders the new board", () => {
    render(<PizarraRoute />);
    expect(screen.getByText("pizarra nueva")).toBeInTheDocument();
  });

  it("an old link with the switch off still opens the new board", () => {
    window.history.replaceState(null, "", "/pizarra?v2=0");
    render(<PizarraRoute />);
    expect(screen.getByText("pizarra nueva")).toBeInTheDocument();
    window.history.replaceState(null, "", "/");
  });
});
