// The admin's chrome with the device asking for reduced motion (prefers-reduced-motion: reduce): the rail,
// the bar and «Más» render plain elements — no Motion props, no entrance, the classic sheet.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, mountAdmin, setAdminData } from "../../../test/adminKit";

vi.mock("../data/useAdminData", async () => ({ useAdminData: (await import("../../../test/adminMocks")).currentAdminData }));
vi.mock("../../../context/AuthContext", async () => ({ useAuth: (await import("../../../test/adminMocks")).fakeAuth }));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => String(e) }));

const WIDTH = window.innerWidth;

describe("AdminLayout · reduced motion", () => {
  beforeAll(() => {
    // Before Motion reads it for the first time in this file.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({ matches: query.includes("reduce"), media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false }),
    });
  });
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAdminData(adminFixture());
  });
  afterEach(() => Object.defineProperty(window, "innerWidth", { configurable: true, value: WIDTH }));

  it("the rail: no entrance, a static floodlight, plain counters", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    mountAdmin("/admin");
    const nav = await screen.findByRole("navigation", { name: "Sala de control" });
    expect(nav).toHaveAttribute("data-motion", "off");
    expect(nav).not.toHaveClass("in");
    const hoy = within(nav).getByRole("link", { name: /^Hoy/ });
    const flood = hoy.querySelector(".fl");
    expect(flood).not.toBeNull();
    expect(flood).not.toHaveAttribute("style");
    expect(hoy.querySelector(".n")).toHaveAttribute("data-motion", "off");
    expect(document.querySelector(".rspot")).toBeNull();
    // the fold jumps (no in-between phases)
    const user = userEvent.setup();
    await user.click(within(nav).getByRole("button", { name: "Plegar menú" }));
    expect(document.querySelector(".dk")).toHaveAttribute("data-rail", "closed");
  });

  it("phones: the bar and the classic «Más» sheet", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    mountAdmin("/admin");
    const bar = await screen.findByRole("navigation", { name: "Sala de control" });
    expect(bar).toHaveAttribute("data-motion", "off");
    expect(within(bar).getByRole("link", { name: "Hoy · 3 por hacer" }).querySelector(".fl")).not.toHaveAttribute("style");
    await user.click(within(bar).getByRole("button", { name: /^Más/ }));
    const sheet = screen.getByRole("dialog", { name: "Más" });
    expect(sheet).toHaveClass("sheet", "mas");
    expect(sheet).not.toHaveAttribute("style", expect.stringContaining("transform"));
    expect(sheet.querySelector(".mgrab")).toBeNull();
  });
});
