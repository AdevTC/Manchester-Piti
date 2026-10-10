import { render, screen, waitFor } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Count, NavIcon, ThemeIcon } from "./ChromeBits";
import { digitsOf, nextCount, trendOf } from "./chromeMotion";

const withMotion = (reduced: boolean, node: ReactNode) => <MotionConfig reducedMotion={reduced ? "always" : "never"}>{node}</MotionConfig>;
const badge = () => document.querySelector(".n");

describe("the counters' odometer logic", () => {
  it("digits, units last; never negative", () => {
    expect(digitsOf(12)).toEqual(["1", "2"]);
    expect(digitsOf(0)).toEqual(["0"]);
    expect(digitsOf(-3)).toEqual(["0"]);
    expect(digitsOf(4.7)).toEqual(["4"]);
  });
  it("which way it moved, and one bump per rise", () => {
    expect(trendOf(1, 2)).toBe("up");
    expect(trendOf(2, 1)).toBe("down");
    expect(trendOf(2, 2)).toBe("same");
    const a = nextCount({ last: 1, trend: "same", bumps: 0 }, 3);
    expect(a).toEqual({ last: 3, trend: "up", bumps: 1 });
    const b = nextCount(a, 2);
    expect(b).toEqual({ last: 2, trend: "down", bumps: 1 });
    expect(nextCount(b, 2)).toBe(b);
    expect(nextCount(b, 5)).toEqual({ last: 5, trend: "up", bumps: 2 });
  });
});

describe("Count", () => {
  it("rolls: up pops (alternating classes restart the pop) with one ring; down rolls back; 0 fades out", async () => {
    const { rerender } = render(withMotion(false, <Count n={2} className="n" />));
    expect(badge()).toHaveTextContent("2");
    expect(badge()).toHaveAttribute("aria-hidden", "true");
    expect(badge()).toHaveAttribute("data-trend", "same");
    expect(badge()?.querySelector(".ring")).toBeNull();
    rerender(withMotion(false, <Count n={3} className="n" />));
    expect(badge()).toHaveAttribute("data-trend", "up");
    expect(badge()).toHaveClass("odo", "popA");
    expect(badge()?.querySelector(".ring")).not.toBeNull();
    rerender(withMotion(false, <Count n={4} className="n" />));
    expect(badge()).toHaveClass("popB");
    rerender(withMotion(false, <Count n={1} className="n" />));
    expect(badge()).toHaveAttribute("data-trend", "down");
    expect(badge()?.querySelector(".ring")).toBeNull();
    rerender(withMotion(false, <Count n={0} className="n" />));
    await waitFor(() => expect(badge()).toBeNull());
  });

  it("reduced motion: plain text, no Motion props (no inline styles, no odometer)", () => {
    const { rerender } = render(withMotion(true, <Count n={2} className="n" />));
    expect(badge()).toHaveTextContent("2");
    expect(badge()).toHaveAttribute("data-motion", "off");
    expect(badge()).not.toHaveAttribute("style");
    expect(badge()).not.toHaveClass("odo");
    rerender(withMotion(true, <Count n={5} className="n" />));
    expect(badge()).toHaveTextContent("5");
    expect(badge()?.querySelector(".ring")).toBeNull();
    rerender(withMotion(true, <Count n={0} className="n" />));
    expect(badge()).toBeNull();
  });
});

describe("icons", () => {
  it("section icons come in parts (the CSS moves them); others are the plain icon", () => {
    const { container } = render(
      <>
        <NavIcon name="cal" />
        <NavIcon name="shield" />
        <NavIcon name="dots" />
      </>,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs[0]).toHaveClass("nvi", "cal");
    expect(svgs[0].querySelector(".a1")).not.toBeNull();
    // the shine is clipped to the shield by a unique clip path
    const clip = svgs[1].querySelector("clipPath");
    expect(clip?.id).toMatch(/^[a-zA-Z0-9_-]+-sh$/);
    expect(svgs[1].querySelector(`[clip-path="url(#${clip?.id})"]`)).not.toBeNull();
    expect(svgs[2]).not.toHaveClass("nvi");
  });

  it("the theme icon shows the sun at night (go to day) and the moon by day", () => {
    const { rerender } = render(<ThemeIcon dark />);
    const thm = () => document.querySelector(".thm");
    expect(thm()).toHaveClass("is-dark");
    rerender(<ThemeIcon dark={false} />);
    expect(thm()).toHaveClass("is-light");
    expect(screen.queryByRole("img")).toBeNull();
  });
});
