// r14 «La pizarra»: the live pitch (source «ahora») with marks: one chip per mark (its icon + the minute, the minute
// once), the plate line under the shirt, in Pizarra and in Grada — with the real store (no mocks).
import { describe, expect, it } from "vitest";
import { renderWithPz } from "../store/testkit";
import { PiCampo } from "./PiCampo";

const marks = { erik: [{ k: "amarilla" as const, t: "Amarilla 17′", short: "17′" }], jordi: [{ k: "tocado" as const, t: "Tocado 21′" }, { k: "tocado" as const, t: "Tocado 21′" }] };

describe("the live pitch's marks", () => {
  for (const camera of ["pizarra", "grada"] as const) {
    it(`one chip per mark, the minute once (${camera})`, () => {
      const { r } = renderWithPz(<div style={{ position: "relative", width: 600, height: 800 }}><PiCampo layout="desktop" show={{ source: "ahora", camera, marks }} /></div>);
      const chips = [...r.container.querySelectorAll(".pz-c__mk")];
      // ERIK's yellow and JORDI's knock (the same knock twice is one chip)
      expect(chips).toHaveLength(2);
      expect(chips.map((c) => c.textContent)).toEqual(["17′", "21′"]);
      expect(chips[0].className).toContain("k-amarilla");
      expect(chips[0].querySelector("i")).not.toBeNull();
      // the chips sit in the plate line, beside the name
      expect(chips[0].closest(".pz-c__pline")?.querySelector(".pz-c__plate")?.textContent).toBe("ERIK");
      // and the button still says it in words (never colour alone)
      expect(r.container.querySelector('[aria-label^="ERIK"]')?.getAttribute("aria-label")).toMatch(/amarilla 17′/);
    });
  }
});
