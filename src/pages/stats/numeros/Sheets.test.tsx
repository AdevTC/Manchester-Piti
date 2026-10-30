import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Sheets } from "./Sheets";
import type { NuState, NuView } from "./view";

vi.mock("./Screens", () => ({ A: () => null, CardNumbers: () => null, RivalFacts: () => null, RivalGames: () => null }));
afterEach(() => { cleanup(); document.documentElement.style.overflow = ""; });

const view = { infoS: { t: "Qué es la moviola", d: "La temporada jornada a jornada." }, pl: null, rv: null } as unknown as NuView;
const sheets = (sheet: NuState["sheet"], sheetId: string | null = null) =>
  <Sheets v={view} st={{ sheet, sheetId } as NuState} onClose={() => {}} openSearch={() => {}} infoScope={() => {}} numOf={() => ""} sheetRef={{ current: null }} />;

describe("Números sheets", () => {
  it("locks the page only while a sheet is drawn and frees it when it closes", () => {
    const { rerender } = render(sheets("info"));
    expect(document.documentElement.style.overflow).toBe("hidden");
    rerender(sheets(null));
    expect(document.documentElement.style.overflow).toBe("");
  });
  it("leaves the page free when the chosen player is not in the sample (no sheet to close)", () => {
    render(sheets("player", "nadie"));
    expect(document.querySelector(".nu-sheet")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });
});
