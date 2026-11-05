// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnyRouter } from "@tanstack/react-router";
import { warmSections } from "./warmSections";

const router = (pathname: string) => {
  const preloaded: string[] = [];
  const r = { state: { location: { pathname } }, preloadRoute: vi.fn(async ({ to }: { to: string }) => void preloaded.push(to)) };
  return { r: r as unknown as AnyRouter, preloaded };
};
const flush = async () => {
  for (let i = 0; i < 12; i++) {
    await vi.runAllTimersAsync();
  }
};

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, "connection", { value: undefined, configurable: true });
});

describe("warming the sections", () => {
  it("warms the other four sections, one after the other, at idle moments", async () => {
    vi.useFakeTimers();
    const { r, preloaded } = router("/partidos/tabla");
    warmSections(r, 100);
    expect(preloaded).toEqual([]);
    await flush();
    expect(preloaded).toEqual(["/", "/plantilla", "/estadisticas", "/club"]);
  });

  it("warms Estadísticas' headline face with it (no swap from Archivo to Anton after the change of page)", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => []);
    Object.defineProperty(document, "fonts", { value: { load }, configurable: true });
    try {
      warmSections(router("/").r, 100);
      await flush();
      expect(load.mock.calls).toEqual([["1em Anton"]]);
      load.mockClear();
      // (on Estadísticas itself the face came with the page)
      warmSections(router("/estadisticas/juego").r, 100);
      await flush();
      expect(load).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(document, "fonts");
    }
  });

  it("does nothing on a connection that asks to save data", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    const { r, preloaded } = router("/");
    warmSections(r, 100);
    await flush();
    expect(preloaded).toEqual([]);
  });
});
