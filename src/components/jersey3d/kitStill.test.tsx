import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Shirt as PartidosShirt } from "../../pages/partidos/vidrio/bits";
import { Shirt } from "../../pages/home/vidrio/Siete";
import { BACK_PRINT, nameSqueeze } from "./backPrint";
import { KitStillContext, printNames, type KitStills } from "./kitStill";

describe("printNames", () => {
  it("prints each dorsal's name in capitals and skips players without a dorsal or a name", () => {
    const names = printNames([
      { name: "Adrián T.C.", num: "10" },
      { name: "Jordi", num: "28" },
      { name: "Sin dorsal", num: "" },
      { name: " ", num: "4" },
    ]);
    expect([...names]).toEqual([
      ["10", "ADRIÁN T.C."],
      ["28", "JORDI"],
    ]);
  });
  it("prints nobody's name on a dorsal two players share", () => {
    const names = printNames([
      { name: "Uno", num: "7" },
      { name: "Otro", num: "7" },
      { name: "Jordi", num: "28" },
    ]);
    expect(names.has("7")).toBe(false);
    expect(names.get("28")).toBe("JORDI");
  });
});

describe("the back print (BACK_PRINT)", () => {
  it("leaves the measured 34 px between the name's caps and the number's", () => {
    expect(BACK_PRINT.num.top - (BACK_PRINT.name.top + BACK_PRINT.name.cap)).toBe(34);
  });
  it("squeezes a short name as the kit does and condenses a long one to the print's width, never wider", () => {
    // at a 62.857 px face one still px is one css px: caps 44 px
    const font = BACK_PRINT.name.cap / BACK_PRINT.capEm;
    expect(nameSqueeze(125, font)).toBeCloseTo(0.93);
    const long = nameSqueeze(300, font);
    expect(long).toBeLessThan(0.93);
    expect(300 * long).toBeCloseTo(BACK_PRINT.name.maxW);
    expect(nameSqueeze(0, font)).toBe(0.93);
  });
});

const stills =
  (printed: boolean): KitStills =>
  () => ({ src: "blob:still", printed });

describe("Shirt (KitStillContext)", () => {
  it("sets its number over the blank still and the drawn shirt", () => {
    for (const value of [stills(false), () => undefined]) {
      const { container, unmount } = render(
        <KitStillContext.Provider value={value}>
          <Shirt num="28" />
          <PartidosShirt num="28" />
        </KitStillContext.Provider>,
      );
      expect([...container.querySelectorAll("b")].map((b) => b.textContent)).toEqual(["28", "28"]);
      unmount();
    }
  });
  it("sets nothing over the player's own still, which prints his name and number", () => {
    const { container } = render(
      <KitStillContext.Provider value={stills(true)}>
        <Shirt num="28" captain />
        <PartidosShirt num="28" />
      </KitStillContext.Provider>,
    );
    expect(container.querySelectorAll("b")).toHaveLength(0);
    expect(container.querySelector(".vi-shirt--kit")?.getAttribute("style")).toContain("blob:still");
    expect(container.querySelector(".vd-shirt--img")).not.toBeNull();
    expect(container.querySelector(".vi-arm")).not.toBeNull();
  });
  it("asks the page for the player's still by his dorsal", () => {
    const asked: (string | undefined)[] = [];
    render(
      <KitStillContext.Provider
        value={(kit, num) => {
          asked.push(`${kit}:${num}`);
          return undefined;
        }}
      >
        <Shirt num="7" kit="away" />
      </KitStillContext.Provider>,
    );
    expect(asked).toContain("away:7");
  });
});
