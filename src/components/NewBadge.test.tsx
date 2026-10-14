import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { NewBadge } from "./NewBadge";
import { NEW_FEATURES } from "../lib/derived/isNew";

const released = Date.parse(NEW_FEATURES.perfilNombre);

describe("<NewBadge>", () => {
  it("shows the pill with the page's own class while the feature is new", () => {
    const a = render(<NewBadge feature="perfilNombre" look="nv" now={released + 20 * 86_400_000} />);
    expect(a.container.querySelector("span.nv")?.textContent).toBe("nuevo");
    const b = render(<NewBadge feature="perfilNombre" now={released} />);
    expect(b.container.querySelector("span.st-new")?.textContent).toBe("nuevo");
  });
  it("renders nothing once the 21 days are over", () => {
    const { container } = render(<NewBadge feature="perfilNombre" now={released + 21 * 86_400_000} />);
    expect(container.innerHTML).toBe("");
  });
});
