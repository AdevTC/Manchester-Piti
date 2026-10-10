import { describe, expect, it } from "vitest";
import { CHORD_MS, chordStep, isTypingTarget } from "./shortcuts";
import { goHint, goKeys, sectionForGo } from "./nav";

describe("the g + key chord", () => {
  it("g arms; a section's key within the window goes there; anything else disarms", () => {
    const armed = chordStep(null, "g", 1000);
    expect(armed).toEqual({ result: { kind: "armed" }, armedAt: 1000 });
    expect(chordStep(armed.armedAt, "p", 1000 + CHORD_MS)).toEqual({ result: { kind: "go", section: "partidos" }, armedAt: null });
    expect(chordStep(armed.armedAt, "P", 1200).result).toEqual({ kind: "go", section: "partidos" });
    // too late: nothing
    expect(chordStep(armed.armedAt, "p", 1001 + CHORD_MS).result).toEqual({ kind: "none" });
    // a key that is no section disarms
    expect(chordStep(armed.armedAt, "x", 1100)).toEqual({ result: { kind: "none" }, armedAt: null });
    // a section key alone does nothing
    expect(chordStep(null, "h", 1000).result).toEqual({ kind: "none" });
  });

  it("[ folds the rail; g g re-arms", () => {
    expect(chordStep(null, "[", 0).result).toEqual({ kind: "rail" });
    expect(chordStep(5, "g", 10)).toEqual({ result: { kind: "armed" }, armedAt: 10 });
  });

  it("every section has its letter (pLantilla, capitanes = K, cOntenido)", () => {
    expect(["h", "p", "c", "l", "f", "t", "k", "o"].map(sectionForGo)).toEqual(["hoy", "partidos", "convocar", "plantilla", "fichas", "temporadas", "capitanes", "contenido"]);
    expect(goHint("plantilla")).toBe("G L");
    expect(goKeys("capitanes")).toBe("g k");
  });
});

describe("isTypingTarget", () => {
  it("text fields, textareas, selects and contenteditable are typing; buttons and checkboxes aren't", () => {
    const el = (html: string) => {
      const host = document.createElement("div");
      host.innerHTML = html;
      return host.firstElementChild;
    };
    expect(isTypingTarget(el("<input>"))).toBe(true);
    expect(isTypingTarget(el('<input type="search">'))).toBe(true);
    expect(isTypingTarget(el("<textarea></textarea>"))).toBe(true);
    expect(isTypingTarget(el("<select></select>"))).toBe(true);
    const editable = el('<div contenteditable="true"></div>') as HTMLElement;
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(el('<input type="checkbox">'))).toBe(false);
    expect(isTypingTarget(el("<button></button>"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
