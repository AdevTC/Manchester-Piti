import { describe, expect, it } from "vitest";
import { isSearchShortcut } from "./searchShortcut";

const press = (key: string, target: EventTarget | null, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}) =>
  isSearchShortcut({ key, target, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, defaultPrevented: false, ...mods });

describe("isSearchShortcut", () => {
  it("⌘K, Ctrl+K and «/» on the page open the search", () => {
    expect(press("k", document.body, { metaKey: true })).toBe(true);
    expect(press("K", document.body, { ctrlKey: true })).toBe(true);
    expect(press("/", document.body)).toBe(true);
    // «/» is Shift+7 on a Spanish keyboard
    expect(press("/", document.body, { shiftKey: true })).toBe(true);
  });
  it("never inside a field, a text area, a select or an editable block", () => {
    const input = document.createElement("input");
    const area = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    editable.appendChild(inner);
    for (const t of [input, area, select, inner]) {
      expect(press("/", t)).toBe(false);
      expect(press("k", t, { ctrlKey: true })).toBe(false);
    }
  });
  it("not plain K, not with Alt, not once handled", () => {
    expect(press("k", document.body)).toBe(false);
    expect(press("k", document.body, { ctrlKey: true, altKey: true })).toBe(false);
    expect(isSearchShortcut({ key: "/", target: document.body, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, defaultPrevented: true })).toBe(false);
  });
});
