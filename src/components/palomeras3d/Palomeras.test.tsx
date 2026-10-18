import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Palomeras } from "./Palomeras";
import { PalomerasSlices } from "./PalomerasSlices";
import type { PalomerasState } from "./types";

vi.mock("./engine", () => ({
  createEngine: vi.fn(() => {
    throw new Error("WebGL must not start in jsdom");
  }),
}));

const state: PalomerasState = {
  at: Date.UTC(2026, 9, 18, 17, 22),
  floodlights: "on",
  weather: { sky: "cloud", cloud: 70 },
  figures: [{ id: "7", num: "7", name: "ALCIDES", x: 50, y: 50, tag: "gol" }],
  board: "Piti 2, Orduña fc 1",
};

describe("<Palomeras>", () => {
  it("renders on the server: the CSS sky and the still container, nothing interactive", () => {
    const html = renderToString(<Palomeras rig="hero1440" state={state} />);
    expect(html).toContain('class="pm"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pm-still");
    expect(html).toContain("linear-gradient(180deg");
    expect(html).toContain("--pm-hy:");
    expect(html).toContain("<canvas");
  });

  it("mounts in jsdom without WebGL and keeps the still", () => {
    const { container } = render(<Palomeras rig="hero390" state={state} />);
    const root = container.querySelector(".pm");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-mode")).toBe("still");
    expect(container.querySelector(".pm-still")).not.toBeNull();
    expect(container.querySelector("canvas.pm-cv")).not.toBeNull();
  });

  it("renders the slices, one box per view with its overlay", () => {
    const html = renderToString(
      <PalomerasSlices
        views={[
          { rig: "slice", state, w: 372, h: 440, children: <b>J1</b> },
          { rig: "slice", state: { ...state, away: true, floodlights: "off" }, w: 185, h: 440, children: <b>J2</b> },
        ]}
      />,
    );
    expect(html.match(/pm-slice/g)?.length).toBe(3); // the row + two slices
    expect(html).toContain("<b>J1</b>");
    expect(html).toContain("width:372px");
  });
});
