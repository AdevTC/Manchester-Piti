import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RivalMark } from "./RivalMark";

const ring = (logo?: string) => render(<span data-testid="ring"><RivalMark logo={logo}>PI</RivalMark></span>).getByTestId("ring");

describe("RivalMark: what goes inside a rival's crest ring", () => {
  it("the escudo, filling the ring, when there is one", () => {
    const img = ring("https://piti.test/escudos/pitutis.jpg").querySelector("img");
    expect(img).toHaveAttribute("src", "https://piti.test/escudos/pitutis.jpg");
    expect(img).toHaveClass("vd-rivlogo");
    expect(img).toHaveAttribute("alt", "");
  });

  it("the initials without one", () => {
    const r = ring(undefined);
    expect(r.querySelector("img")).toBeNull();
    expect(r).toHaveTextContent("PI");
  });

  it("a link that stops loading (an expired Instagram one) falls back to the initials", () => {
    const r = ring("https://instagram.test/caducado.jpg");
    fireEvent.error(r.querySelector("img")!);
    expect(r.querySelector("img")).toBeNull();
    expect(r).toHaveTextContent("PI");
  });
});
