import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// /pizarra/* is the r14 pizarra for everyone (the old v2 page is no longer routed).

vi.mock("./pz/PizarraR14", () => ({ PizarraR14: () => <p>la pizarra r14</p> }));

import { PizarraRoute } from "./PizarraRoute";

describe("/pizarra", () => {
  it("renders the r14 pizarra", () => {
    render(<PizarraRoute />);
    expect(screen.getByText("la pizarra r14")).toBeInTheDocument();
  });

  it("an old link with the switch off still opens it", () => {
    window.history.replaceState(null, "", "/pizarra/siete?v2=0");
    render(<PizarraRoute />);
    expect(screen.getByText("la pizarra r14")).toBeInTheDocument();
    window.history.replaceState(null, "", "/");
  });
});
