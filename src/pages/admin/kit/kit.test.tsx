import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { resultLetter } from "./result";
import { Peg, PegRail, PegWall, ShirtBack } from "./ShirtBack";
import { pegsPerRail, railsOf } from "./wall";

// What is left of the admin v2's kit: the drawn shirt back (the Club's rooms draw it while a printed still renders),
// its pegs and the wall it hangs on, and the G/E/P letter of a result.
describe("kit · the shirt, pegs, rails and the wall", () => {
  it("ShirtBack: name over the dorsal, its size, states", () => {
    const { container } = render(<ShirtBack num={9} name="ERIK" size={96} big />);
    const sh = container.querySelector(".sh")!;
    expect(sh).toHaveClass("big");
    expect(sh).toHaveAttribute("aria-hidden", "true");
    expect(sh.querySelector("i")).toHaveTextContent("ERIK");
    expect(sh.querySelector("b")).toHaveTextContent("9");
    expect((sh as HTMLElement).style.getPropertyValue("--w")).toBe("96px");
    const { container: free } = render(<ShirtBack state="empty" />);
    expect(free.querySelector(".sh")).toHaveClass("empty");
    expect(free.querySelector(".sh i")).toBeNull();
  });

  it("Peg: a button when it acts (with its label), a figure otherwise; stickers; the amber line", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PegRail label="El siete · 6 de 7">
        <Peg num={9} shirtName="ERIK" label="ERIK" sub="DEL" onClick={onClick} ariaLabel="ERIK en el siete: tocar para bajarlo al banquillo" fresh />
        <Peg num={21} label="ALMACHI" sub="Duda" subTone="duda" state="dim" stickers={["goal", "yellow", "red"]} />
      </PegRail>,
    );
    expect(screen.getByText("El siete · 6 de 7")).toHaveClass("lbr");
    const btn = screen.getByRole("button", { name: "ERIK en el siete: tocar para bajarlo al banquillo" });
    expect(btn).toHaveClass("peg", "open");
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    const dim = screen.getByText("ALMACHI").closest(".peg")!;
    expect(dim.tagName).toBe("SPAN");
    expect(dim.querySelector(".sh")).toHaveClass("dim");
    expect(screen.getByText("Duda")).toHaveClass("rv", "duda");
    expect(within(dim as HTMLElement).getAllByRole("img")).toHaveLength(3);
    expect(within(dim as HTMLElement).getByRole("img", { name: "1 amarilla" })).toBeInTheDocument();
    expect(within(dim as HTMLElement).getByRole("img", { name: "1 roja" })).toBeInTheDocument();
  });

  it("the wall: 7 per rail, 5 beside the drawer, 3 on phones; empty message", () => {
    expect(pegsPerRail(true, false)).toBe(7);
    expect(pegsPerRail(true, true)).toBe(5);
    expect(pegsPerRail(false, true)).toBe(3);
    expect(railsOf([1, 2, 3, 4, 5, 6, 7, 8], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8]]);
    const { container, rerender } = render(<PegWall items={["a", "b", "c", "d", "e", "f", "g", "h"]} perRail={7} render={(x) => <Peg key={x} label={x} />} />);
    expect(container.querySelectorAll(".wall .rail2")).toHaveLength(2);
    rerender(<PegWall items={[]} perRail={7} render={(x: string) => <Peg key={x} label={x} />} empty="Ninguna camiseta con «zz»." />);
    expect(screen.getByText("Ninguna camiseta con «zz».")).toHaveClass("nores");
  });
});

describe("kit · the result's letter", () => {
  it("G / E / P from the score", () => {
    expect(resultLetter(3, 1)).toBe("G");
    expect(resultLetter(1, 1)).toBe("E");
    expect(resultLetter(0, 2)).toBe("P");
  });
});
