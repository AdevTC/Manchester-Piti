import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CromoCard, CromoNew, LedBoard, LowerThird, Peg, PegRail, PegWall, pegsPerRail, railsOf, ResultMark, resultLetter, ShirtBack } from "./index";

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
    expect(dim.querySelectorAll(".stk i")).toHaveLength(3);
    expect(dim.querySelector(".stk i.y")).not.toBeNull();
    expect(dim.querySelector(".stk i.r")).not.toBeNull();
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

describe("kit · the LED scoreboard", () => {
  it("desktop: PITI, the score, the line under it, the rival and the ticker", () => {
    const { container } = render(<LedBoard rival="MAD SKY" gf={1} ga={1} sub="31:12 · EN JUEGO" ticker="J8 · LIGA · MAD SKY · " />);
    expect(container.querySelector(".sb")).not.toBeNull();
    expect(screen.getByLabelText("PITI 1, MAD SKY 1")).toHaveTextContent("1-1");
    expect(screen.getByText("31:12 · EN JUEGO")).toHaveClass("sub");
    expect(container.querySelector(".tick span")).toHaveTextContent("J8 · LIGA · MAD SKY");
    expect(container.querySelector(".rc svg")).not.toBeNull();
  });
  it("the GOOOL flash replaces the score; the gold FINAL line; the phone board", () => {
    const { rerender, container } = render(<LedBoard rival="MAD SKY" gf={2} ga={1} sub="x" flash={{ text: "ERIK · 31′ · pase de ADRIÁN T.C." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("GOOOL");
    expect(screen.getByText("ERIK · 31′ · pase de ADRIÁN T.C.")).toHaveClass("sub", "gd");
    rerender(<LedBoard rival="MAD SKY" gf={2} ga={1} sub="FINAL · SIN PUBLICAR" subTone="gd" flip={false} />);
    expect(screen.getByText("FINAL · SIN PUBLICAR")).toHaveClass("gd");
    expect(container.querySelector(".led")).not.toHaveClass("fl");
    rerender(<LedBoard rival="MAD SKY" gf={2} ga={1} sub="31:12" size="mob" />);
    expect(container.querySelector(".mbd .pn")).toHaveAccessibleName("PITI 2, MAD SKY 1");
    expect(container.querySelector(".sb")).toBeNull();
  });
});

describe("kit · result mark, cromo, lower third", () => {
  it("V / E / D: the letter, the word, the defeat's hatch class", () => {
    expect(resultLetter(3, 1)).toBe("V");
    expect(resultLetter(1, 1)).toBe("E");
    expect(resultLetter(0, 2)).toBe("D");
    render(<ResultMark r="D" small />);
    const mark = screen.getByRole("img", { name: "Derrota" });
    expect(mark).toHaveClass("ved", "D", "sm");
    expect(mark).toHaveTextContent("D");
  });
  it("the cromo: rating (— before any match), position, shirt, the season line", () => {
    const cromo = { id: "adrian", num: 10, name: "ADRIÁN T.C.", pos: "DEL" as const, rt: 96, stats: { played: 7, goals: 9, assists: 4, minutes: 300, starts: 7, mvps: 2 }, recentMin: 0, recentGA: 0 };
    const { rerender } = render(<CromoCard cromo={cromo} name="ADRIÁN T.C." num={10} pos="DEL" games={7} />);
    const card = screen.getByRole("group", { name: "Cromo de ADRIÁN T.C.: media 96, DEL" });
    expect(within(card).getByText("96")).toHaveClass("rt");
    expect(card.querySelector(".st")).toHaveTextContent("9GOL4ASI7PJ2MVP");
    rerender(<CromoCard cromo={cromo} name="ADRIÁN T.C." num={10} pos="DEL" games={0} />);
    expect(screen.getByText("—")).toHaveClass("rt");
    rerender(<CromoNew name="" num="" />);
    expect(screen.getByText("Percha nueva")).toBeInTheDocument();
    expect(document.querySelector(".cromo.new .sh")).toHaveClass("empty");
    rerender(<CromoNew name="kevin" num="11" />);
    expect(document.querySelector(".cromo.new .sh")).not.toHaveClass("empty");
    expect(document.querySelector(".cromo.new .nm")).toHaveTextContent("KEVIN");
  });
  it("the lower third: the tag, the message and «Deshacer»", async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    const { container, rerender } = render(<LowerThird tag="J8" message="EVANS al siete" action={{ label: "Deshacer", onClick: undo }} />);
    expect(container.querySelector(".lt .k")).toHaveTextContent("J8");
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(undo).toHaveBeenCalled();
    rerender(<LowerThird tag="!" message="No se ha podido" tone="error" />);
    expect(container.querySelector(".lt")).toHaveClass("err");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
